import { defineState } from '@lwc/state';
import { updateRecord } from 'lightning/uiRecordApi';
import { enrichWithRisk } from 'c/opportunityRiskEngine';
import getOpportunities from '@salesforce/apex/OpportunityRadarController.getOpportunities';
import createFollowUpTask from '@salesforce/apex/OpportunityRadarController.createFollowUpTask';
import NEXTSTEP_FIELD from '@salesforce/schema/Opportunity.NextStep';
import CLOSEDATE_FIELD from '@salesforce/schema/Opportunity.CloseDate';
import STAGENAME_FIELD from '@salesforce/schema/Opportunity.StageName';

const PAGE_SIZE = 20;

const DEFAULT_FILTERS = {
    search: '',
    riskFilter: 'ALL',
    compactView: false,
    pageSize: PAGE_SIZE
};

export default defineState(({ atom, computed, setAtom }) => {
    const allOpportunities = atom([]);
    const snoozedIds = atom([]);
    const selectedId = atom(null);
    const filters = atom({ ...DEFAULT_FILTERS });
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
        setAtom(isLoading, true);
        setAtom(hasError, false);
        setAtom(errorMessage, '');
        try {
            const raw = await getOpportunities();
            setAtom(allOpportunities, raw.map(opp => enrichWithRisk({ ...opp, isSelected: false })));
            setAtom(lastRefresh, new Date().toLocaleTimeString());
            setAtom(currentPage, 1);
        } catch (error) {
            showError(error);
        } finally {
            setAtom(isLoading, false);
        }
    };

    const resetFilters = () => {
        setAtom(filters, { ...DEFAULT_FILTERS });
        setAtom(currentPage, 1);
    };

    const setFilter = (delta) => {
        setAtom(filters, { ...filters.value, ...delta });
        setAtom(currentPage, 1);
    };

    const selectCard = (id) => {
        setAtom(selectedId, selectedId.value === id ? null : id);
    };

    const dismissSelection = () => {
        setAtom(selectedId, null);
    };

    const loadMore = () => {
        setAtom(currentPage, currentPage.value + 1);
    };

    const snoozeCard = (id) => {
        const updated = [...snoozedIds.value];
        if (!updated.includes(id)) updated.push(id);
        setAtom(snoozedIds, updated);
        if (selectedId.value === id) setAtom(selectedId, null);
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
