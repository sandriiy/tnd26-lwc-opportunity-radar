import { defineState } from '@lwc/state';
import { updateRecord } from 'lightning/uiRecordApi';
import { enrichWithRisk } from 'c/opportunityRiskEngine';
import getOpportunitiesPage from '@salesforce/apex/OpportunityRadarController.getOpportunitiesPage';
import getOpportunitiesByIds from '@salesforce/apex/OpportunityRadarController.getOpportunitiesByIds';
import getSingleOpportunity from '@salesforce/apex/OpportunityRadarController.getSingleOpportunity';
import searchOpportunities from '@salesforce/apex/OpportunityRadarController.searchOpportunities';
import createFollowUpTask from '@salesforce/apex/OpportunityRadarController.createFollowUpTask';
import NEXTSTEP_FIELD from '@salesforce/schema/Opportunity.NextStep';
import CLOSEDATE_FIELD from '@salesforce/schema/Opportunity.CloseDate';
import STAGENAME_FIELD from '@salesforce/schema/Opportunity.StageName';
import { readOpportunities, mergeOpportunities, evictFromCache, clearCache } from 'c/opportunityRadarCache';

const PAGE_SIZE = 20;
const CURSOR_BATCH_SIZE = 200;

const DEFAULT_FILTERS = {
    search: '',
    riskFilter: 'ALL',
    compactView: false,
    pageSize: PAGE_SIZE
};

const PREF_KEYS = {
    riskFilter: 'opportunityRadar:v1:riskFilter',
    compactView: 'opportunityRadar:v1:compactView',
    pageSize: 'opportunityRadar:v1:pageSize'
};

const SESSION_KEYS = {
    selectedId: 'opportunityRadar:v1:selectedOpportunityId',
    snoozedIds: 'opportunityRadar:v1:snoozedIds'
};

function readPreferences() {
    try {
        const saved = {};
        const riskFilter = localStorage.getItem(PREF_KEYS.riskFilter);
        const compactView = localStorage.getItem(PREF_KEYS.compactView);
        const pageSize = localStorage.getItem(PREF_KEYS.pageSize);
        if (riskFilter) saved.riskFilter = riskFilter;
        if (compactView !== null) saved.compactView = compactView === 'true';
        if (pageSize !== null) saved.pageSize = Number(pageSize);
        return saved;
    } catch (e) {
        return {};
    }
}

function persistPreferences(f) {
    try {
        localStorage.setItem(PREF_KEYS.riskFilter, f.riskFilter);
        localStorage.setItem(PREF_KEYS.compactView, String(f.compactView));
        localStorage.setItem(PREF_KEYS.pageSize, String(f.pageSize));
    } catch (e) {}
}

function readSession() {
    try {
        const sid = sessionStorage.getItem(SESSION_KEYS.selectedId);
        const snoozedRaw = sessionStorage.getItem(SESSION_KEYS.snoozedIds);
        return {
            selectedId: sid || null,
            snoozedIds: snoozedRaw ? JSON.parse(snoozedRaw) : []
        };
    } catch (e) {
        return { selectedId: null, snoozedIds: [] };
    }
}

function persistSelectedId(id) {
    try {
        if (id) {
            sessionStorage.setItem(SESSION_KEYS.selectedId, id);
        } else {
            sessionStorage.removeItem(SESSION_KEYS.selectedId);
        }
    } catch (e) {}
}

function persistSnoozedIds(ids) {
    try {
        sessionStorage.setItem(SESSION_KEYS.snoozedIds, JSON.stringify(ids));
    } catch (e) {}
}

const RISK_ORDER = { Critical: 0, Warning: 1, Healthy: 2 };

function sortByRisk(records) {
    return [...records].sort((a, b) => {
        const aRank = RISK_ORDER[a.riskLevel] ?? 3;
        const bRank = RISK_ORDER[b.riskLevel] ?? 3;
        if (aRank !== bRank) return aRank - bRank;
        const dateSort = new Date(a.closeDate) - new Date(b.closeDate);
        if (dateSort !== 0) return dateSort;
        return a.id < b.id ? -1 : 1;
    });
}

function mergeServerRecords(byId, enriched) {
    for (const opp of enriched) {
        const existing = byId.get(opp.id);
        if (existing?._localVersion) {
            const serverMs = opp.lastModifiedDate ? new Date(opp.lastModifiedDate).getTime() : 0;
            if (serverMs > existing._localVersion) {
                byId.set(opp.id, opp);
            }
        } else {
            byId.set(opp.id, opp);
        }
    }
}

export default defineState(({ atom, computed, setAtom }) => {
    const savedPrefs = readPreferences();
    const savedSession = readSession();

    const allOpportunities = atom([]);
    const snoozedIds = atom(savedSession.snoozedIds);
    const selectedId = atom(savedSession.selectedId);
    const filters = atom({ ...DEFAULT_FILTERS, ...savedPrefs });
    const isLoading = atom(false);
    const hasError = atom(false);
    const errorMessage = atom('');
    const lastRefresh = atom(null);
    const currentPage = atom(1);
    const isSyncing = atom(false);
    const syncComplete = atom(false);
    const cursorState = atom(null);
    const pendingToast = atom(null);
    const isSearching = atom(false);
    const serverSearchDone = atom(false);
    const refreshingIds = atom(new Set());

    const filteredOpportunities = computed(
        [allOpportunities, snoozedIds, filters],
        (all, snoozed, f) => {
            let result = all.filter(opp => {
                const isSnoozed = snoozed.includes(opp.id);
                if (isSnoozed) return f.riskFilter === 'SNOOZED';
                if (f.riskFilter === 'SNOOZED') return false;
                if (f.riskFilter !== 'ALL' && opp.riskLevel.toUpperCase() !== f.riskFilter) return false;
                if (f.search) {
                    const term = f.search.toLowerCase();
                    const matchesName = opp.name && opp.name.toLowerCase().includes(term);
                    const matchesAccount = opp.accountName && opp.accountName.toLowerCase().includes(term);
                    if (!matchesName && !matchesAccount) return false;
                }
                return true;
            });
            return sortByRisk(result);
        }
    );

    const visibleOpportunities = computed(
        [filteredOpportunities, currentPage, filters, selectedId, refreshingIds],
        (filtered, page, f, sid, rIds) =>
            filtered.slice(0, page * f.pageSize).map(opp => ({
                ...opp,
                isSelected: opp.id === sid,
                isRefreshing: rIds.has(opp.id)
            }))
    );

    const hasOpportunities = computed(
        [filteredOpportunities],
        (filtered) => filtered.length > 0
    );

    const canLoadMore = computed(
        [filteredOpportunities, currentPage, filters, cursorState, isSyncing],
        (filtered, page, f, cs, syncing) => filtered.length > page * f.pageSize || (cs !== null && !syncing)
    );

    const criticalCount = computed(
        [allOpportunities],
        (all) => all.filter(o => o.riskLevel === 'Critical').length
    );

    const warningCount = computed(
        [allOpportunities],
        (all) => all.filter(o => o.riskLevel === 'Warning').length
    );

    const healthyCount = computed(
        [allOpportunities],
        (all) => all.filter(o => o.riskLevel === 'Healthy').length
    );

    const totalPipeline = computed(
        [allOpportunities],
        (all) => all.reduce((sum, o) => sum + (o.amount || 0), 0)
    );

    const selectedOpportunity = computed(
        [allOpportunities, selectedId],
        (all, sid) => (sid ? all.find(o => o.id === sid) || null : null)
    );

    const showError = (error) => {
        setAtom(hasError, true);
        setAtom(errorMessage, error?.body?.message || 'An error occurred.');
    };

    const showToast = (variant, title, message) => {
        setAtom(pendingToast, { variant, title, message });
    };

    const clearToast = () => {
        setAtom(pendingToast, null);
    };

    const patchOpportunity = (id, fieldDelta) => {
        const now = Date.now();
        const updated = allOpportunities.value.map(opp =>
            opp.id !== id ? opp : enrichWithRisk({ ...opp, ...fieldDelta, _localVersion: now })
        );
        setAtom(allOpportunities, updated);
        const patched = updated.find(o => o.id === id);
        if (patched) {
            mergeOpportunities([patched]).catch(() => {});
        }
    };

    const fetchNextBatch = async (cs) => {
        setAtom(isSyncing, true);
        const cursor = cs?.cursor ?? null;
        const nextIndex = cs?.nextIndex ?? 0;
        try {
            const page = await getOpportunitiesPage({ cursor, nextIndex, batchSize: CURSOR_BATCH_SIZE });
            const enriched = page.records.map(opp => enrichWithRisk(opp));
            const byId = new Map(allOpportunities.value.map(o => [o.id, o]));
            mergeServerRecords(byId, enriched);
            setAtom(allOpportunities, Array.from(byId.values()));
            setAtom(cursorState, page.hasMore ? { cursor: page.cursor, nextIndex: page.nextIndex } : null);
            mergeOpportunities(enriched).catch(() => {});
            setAtom(lastRefresh, new Date().toLocaleTimeString());
            setAtom(syncComplete, true);
        } catch (error) {
            const statusCode = error?.body?.statusCode;
            if (statusCode === 401 || statusCode === 403) {
                try { await clearCache(); } catch (e) {}
            }
            if (allOpportunities.value.length === 0) {
                showError(error);
            } else {
                showToast('warning', 'Load Incomplete', 'Could not reach Salesforce. Showing cached data.');
            }
        } finally {
            setAtom(isSyncing, false);
            setAtom(isLoading, false);
        }
    };

    const refreshPageByIds = async (ids) => {
        if (!ids || ids.length === 0) return;
        try {
            const records = await getOpportunitiesByIds({ opportunityIds: ids });
            const returnedIdSet = new Set(records.map(r => r.id));
            const staleIdSet = new Set(ids.filter(id => !returnedIdSet.has(id)));
            const enriched = records.map(r => enrichWithRisk(r));
            const byId = new Map(
                allOpportunities.value.filter(o => !staleIdSet.has(o.id)).map(o => [o.id, o])
            );
            mergeServerRecords(byId, enriched);
            setAtom(allOpportunities, Array.from(byId.values()));
            if (enriched.length > 0) mergeOpportunities(enriched).catch(() => {});
            if (staleIdSet.size > 0) evictFromCache(Array.from(staleIdSet)).catch(() => {});
        } catch (e) {}
    };

    const loadFeed = async () => {
        resetFilters();
        setAtom(hasError, false);
        setAtom(errorMessage, '');
        setAtom(cursorState, null);
        setAtom(syncComplete, false);
        setAtom(serverSearchDone, false);

        let cachedRecords = [];
        try { cachedRecords = await readOpportunities(); } catch (e) {}

        if (cachedRecords.length > 0) {
            setAtom(allOpportunities, cachedRecords);
            setAtom(isLoading, false);
            const firstPageIds = filteredOpportunities.value
                .slice(0, filters.value.pageSize)
                .map(o => o.id);
            refreshPageByIds(firstPageIds);
        } else {
            setAtom(isLoading, true);
        }

        fetchNextBatch(null);
    };

    const resetFilters = () => {
        setAtom(filters, { ...DEFAULT_FILTERS, ...readPreferences() });
        setAtom(currentPage, 1);
    };

    const setFilter = (delta) => {
        const next = { ...filters.value, ...delta };
        setAtom(filters, next);
        setAtom(currentPage, 1);
        persistPreferences(next);
        if ('search' in delta) {
            setAtom(serverSearchDone, false);
        }
    };

    const selectCard = (id) => {
        const next = selectedId.value === id ? null : id;
        setAtom(selectedId, next);
        persistSelectedId(next);
    };

    const dismissSelection = () => {
        setAtom(selectedId, null);
        persistSelectedId(null);
    };

    const loadMore = () => {
        const nextPage = currentPage.value + 1;
        setAtom(currentPage, nextPage);

        const pageSize = filters.value.pageSize;
        const filtered = filteredOpportunities.value;
        const start = (nextPage - 1) * pageSize;
        const end = nextPage * pageSize;

        const pageIds = filtered.slice(start, Math.min(end, filtered.length)).map(o => o.id);
        if (pageIds.length > 0) refreshPageByIds(pageIds);

        if (filtered.length <= end && cursorState.value !== null && !isSyncing.value) {
            fetchNextBatch(cursorState.value);
        }
    };

    const snoozeCard = (id) => {
        const updated = [...snoozedIds.value];
        if (!updated.includes(id)) updated.push(id);
        setAtom(snoozedIds, updated);
        persistSnoozedIds(updated);
        if (selectedId.value === id) {
            setAtom(selectedId, null);
            persistSelectedId(null);
        }
    };

    const createTask = async (opportunityId, subject, dueDate) => {
        try {
            await createFollowUpTask({ opportunityId, subject, dueDate });
            patchOpportunity(opportunityId, { lastFollowUpDate: new Date().toISOString().split('T')[0] });
            showToast('success', 'Task Created', 'Follow-up task created successfully.');
        } catch (error) {
            showToast('error', 'Task Failed', error?.body?.message || 'Failed to create task.');
        }
    };

    const updateNextStep = async (opportunityId, nextStep) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [NEXTSTEP_FIELD.fieldApiName]: nextStep } });
            patchOpportunity(opportunityId, { nextStep });
        } catch (error) {
            showToast('error', 'Update Failed', error?.body?.message || 'Failed to update next step.');
        }
    };

    const updateCloseDate = async (opportunityId, closeDate) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [CLOSEDATE_FIELD.fieldApiName]: closeDate } });
            patchOpportunity(opportunityId, { closeDate });
        } catch (error) {
            showToast('error', 'Update Failed', error?.body?.message || 'Failed to update close date.');
        }
    };

    const updateStage = async (opportunityId, stageName) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [STAGENAME_FIELD.fieldApiName]: stageName } });
            patchOpportunity(opportunityId, { stageName });
        } catch (error) {
            showToast('error', 'Update Failed', error?.body?.message || 'Failed to update stage.');
        }
    };

    const serverSearch = async (term) => {
        const trimmed = (term || '').trim();
        if (trimmed.length < 2) return;
        setAtom(isSearching, true);
        try {
            const records = await searchOpportunities({ searchTerm: trimmed });
            const enriched = records.map(r => enrichWithRisk(r));
            const byId = new Map(allOpportunities.value.map(o => [o.id, o]));
            mergeServerRecords(byId, enriched);
            setAtom(allOpportunities, Array.from(byId.values()));
            mergeOpportunities(enriched).catch(() => {});
            setAtom(serverSearchDone, true);
        } catch (e) {} finally {
            setAtom(isSearching, false);
        }
    };

    const hardRefresh = async () => {
        resetFilters();
        setAtom(hasError, false);
        setAtom(errorMessage, '');
        setAtom(cursorState, null);
        setAtom(syncComplete, false);
        setAtom(serverSearchDone, false);
        setAtom(allOpportunities, []);
        setAtom(isLoading, true);
        try { await clearCache(); } catch (e) {}
        fetchNextBatch(null);
    };

    const refreshCard = async (opportunityId) => {
        const rIds = new Set(refreshingIds.value);
        rIds.add(opportunityId);
        setAtom(refreshingIds, rIds);
        try {
            const record = await getSingleOpportunity({ opportunityId });
            const enriched = enrichWithRisk(record);
            const updated = allOpportunities.value.map(opp => opp.id === opportunityId ? enriched : opp);
            setAtom(allOpportunities, updated);
            mergeOpportunities([enriched]).catch(() => {});
            showToast('success', 'Record Refreshed', enriched.name + ' has been updated.');
        } catch (error) {
            showToast('error', 'Refresh Failed', error?.body?.message || 'Failed to refresh record.');
        } finally {
            const after = new Set(refreshingIds.value);
            after.delete(opportunityId);
            setAtom(refreshingIds, after);
        }
    };

    return {
        selectedId,
        filters,
        isLoading,
        hasError,
        errorMessage,
        lastRefresh,
        visibleOpportunities,
        hasOpportunities,
        canLoadMore,
        criticalCount,
        warningCount,
        healthyCount,
        totalPipeline,
        selectedOpportunity,
        loadFeed,
        setFilter,
        selectCard,
        dismissSelection,
        loadMore,
        snoozeCard,
        createTask,
        updateNextStep,
        updateCloseDate,
        updateStage,
        isSyncing,
        syncComplete,
        isSearching,
        serverSearchDone,
        pendingToast,
        clearToast,
        hardRefresh,
        refreshCard,
        serverSearch
    };
});
