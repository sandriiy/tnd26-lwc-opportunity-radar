import { defineState } from '@lwc/state';
import { updateRecord } from 'lightning/uiRecordApi';
import { enrichWithRisk } from 'c/opportunityRiskEngine';
import getOpportunities from '@salesforce/apex/OpportunityRadarController.getOpportunities';
import createFollowUpTask from '@salesforce/apex/OpportunityRadarController.createFollowUpTask';
import NEXTSTEP_FIELD from '@salesforce/schema/Opportunity.NextStep';
import CLOSEDATE_FIELD from '@salesforce/schema/Opportunity.CloseDate';
import STAGENAME_FIELD from '@salesforce/schema/Opportunity.StageName';
import { readOpportunities, writeOpportunities, clearCache, markSynced } from 'c/opportunityRadarCache';

const PAGE_SIZE = 20;

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
            return result.slice().sort((a, b) => {
                const order = { Critical: 0, Warning: 1, Healthy: 2 };
                const aRank = order[a.riskLevel] ?? 3;
                const bRank = order[b.riskLevel] ?? 3;
                if (aRank !== bRank) return aRank - bRank;
                return new Date(a.closeDate) - new Date(b.closeDate);
            });
        }
    );

    const visibleOpportunities = computed(
        [filteredOpportunities, currentPage, filters, selectedId],
        (filtered, page, f, sid) =>
            filtered.slice(0, page * f.pageSize).map(opp => ({ ...opp, isSelected: opp.id === sid }))
    );

    const hasOpportunities = computed(
        [filteredOpportunities],
        (filtered) => filtered.length > 0
    );

    const canLoadMore = computed(
        [filteredOpportunities, currentPage, filters],
        (filtered, page, f) => filtered.length > page * f.pageSize
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

    const patchOpportunity = (id, fieldDelta) => {
        setAtom(
            allOpportunities,
            allOpportunities.value.map(opp =>
                opp.id !== id ? opp : enrichWithRisk({ ...opp, ...fieldDelta })
            )
        );
    };

    const loadFeed = async () => {
        setAtom(hasError, false);
        setAtom(errorMessage, '');
        setAtom(currentPage, 1);

        let hasCachedData = false;
        try {
            const cached = await readOpportunities();
            if (cached.length > 0) {
                setAtom(allOpportunities, cached);
                hasCachedData = true;
            }
        } catch (e) {}

        if (!hasCachedData) {
            setAtom(isLoading, true);
        }

        try {
            const raw = await getOpportunities();
            const enriched = raw.map(opp => enrichWithRisk({ ...opp, isSelected: false }));
            setAtom(allOpportunities, enriched);
            setAtom(lastRefresh, new Date().toLocaleTimeString());
            try {
                await writeOpportunities(enriched);
                markSynced();
            } catch (e) {}
        } catch (error) {
            const statusCode = error?.body?.statusCode;
            if (statusCode === 401 || statusCode === 403) {
                try { await clearCache(); } catch (e) {}
            }
            if (!hasCachedData) {
                showError(error);
            }
        } finally {
            setAtom(isLoading, false);
        }
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
        setAtom(currentPage, currentPage.value + 1);
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
        } catch (error) {
            showError(error);
        }
    };

    const updateNextStep = async (opportunityId, nextStep) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [NEXTSTEP_FIELD.fieldApiName]: nextStep } });
            patchOpportunity(opportunityId, { nextStep });
        } catch (error) {
            showError(error);
        }
    };

    const updateCloseDate = async (opportunityId, closeDate) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [CLOSEDATE_FIELD.fieldApiName]: closeDate } });
            patchOpportunity(opportunityId, { closeDate });
        } catch (error) {
            showError(error);
        }
    };

    const updateStage = async (opportunityId, stageName) => {
        try {
            await updateRecord({ fields: { Id: opportunityId, [STAGENAME_FIELD.fieldApiName]: stageName } });
            patchOpportunity(opportunityId, { stageName });
        } catch (error) {
            showError(error);
        }
    };

    return {
        allOpportunities,
        snoozedIds,
        selectedId,
        filters,
        isLoading,
        hasError,
        errorMessage,
        lastRefresh,
        currentPage,
        filteredOpportunities,
        visibleOpportunities,
        hasOpportunities,
        canLoadMore,
        criticalCount,
        warningCount,
        healthyCount,
        totalPipeline,
        selectedOpportunity,
        loadFeed,
        resetFilters,
        setFilter,
        selectCard,
        dismissSelection,
        loadMore,
        snoozeCard,
        patchOpportunity,
        createTask,
        updateNextStep,
        updateCloseDate,
        updateStage,
        showError
    };
});
