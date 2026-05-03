import { LightningElement, track } from 'lwc';
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

export default class OpportunityRadar extends LightningElement {
    @track allOpportunities = [];
    @track snoozedIds = new Set();
    @track selectedOpportunityId = null;
    @track filters = { ...DEFAULT_FILTERS };
    @track isLoading = false;
    @track hasError = false;
    @track errorMessage = '';
    @track lastRefresh = null;
    @track currentPage = 1;

    connectedCallback() {
        this.loadOpportunities();
    }

    handleRefresh() {
        this.filters = { ...DEFAULT_FILTERS };
        this.currentPage = 1;
        this.loadOpportunities();
    }

    handleFilterChange(event) {
        const changed = event.detail;
        this.filters = { ...this.filters, ...changed };
        this.currentPage = 1;
    }

    handleLoadMore() {
        this.currentPage += 1;
    }

    handleCardSelect(event) {
        const { opportunityId } = event.detail;
        this.selectedOpportunityId = this.selectedOpportunityId === opportunityId ? null : opportunityId;
    }

    handleClosePanel() {
        this.selectedOpportunityId = null;
    }

    async handleCreateFollowUpTask(event) {
        const { opportunityId, subject, dueDate } = event.detail;
        try {
            await createFollowUpTask({ opportunityId, subject, dueDate });
            this.patchOpportunity(opportunityId, { lastFollowUpDate: new Date().toISOString().split('T')[0] });
        } catch (error) {
            this.showError(error);
        }
    }

    async handleUpdateNextStep(event) {
        const { opportunityId, nextStep } = event.detail;
        try {
            await updateRecord({ fields: { Id: opportunityId, [NEXTSTEP_FIELD.fieldApiName]: nextStep } });
            this.patchOpportunity(opportunityId, { nextStep });
        } catch (error) {
            this.showError(error);
        }
    }

    async handleUpdateCloseDate(event) {
        const { opportunityId, closeDate } = event.detail;
        try {
            await updateRecord({ fields: { Id: opportunityId, [CLOSEDATE_FIELD.fieldApiName]: closeDate } });
            this.patchOpportunity(opportunityId, { closeDate });
        } catch (error) {
            this.showError(error);
        }
    }

    async handleUpdateStage(event) {
        const { opportunityId, stageName } = event.detail;
        try {
            await updateRecord({ fields: { Id: opportunityId, [STAGENAME_FIELD.fieldApiName]: stageName } });
            this.patchOpportunity(opportunityId, { stageName });
        } catch (error) {
            this.showError(error);
        }
    }

    handleSnooze(event) {
        const { opportunityId } = event.detail;
        const updated = new Set(this.snoozedIds);
        updated.add(opportunityId);
        this.snoozedIds = updated;
        if (this.selectedOpportunityId === opportunityId) {
            this.selectedOpportunityId = null;
        }
    }

    patchOpportunity(id, fieldDelta) {
        this.allOpportunities = this.allOpportunities.map(opp => {
            if (opp.id !== id) return opp;
            return enrichWithRisk({ ...opp, ...fieldDelta });
        });
    }

    async loadOpportunities() {
        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = '';
        try {
            const raw = await getOpportunities();
            this.allOpportunities = raw.map(opp => enrichWithRisk({ ...opp, isSelected: false }));
            this.lastRefresh = new Date().toLocaleTimeString();
            this.currentPage = 1;
        } catch (error) {
            this.hasError = true;
            this.errorMessage = error?.body?.message || 'Failed to load opportunities.';
        } finally {
            this.isLoading = false;
        }
    }

    showError(error) {
        this.hasError = true;
        this.errorMessage = error?.body?.message || 'An error occurred.';
    }

    get filteredOpportunities() {
        let result = this.allOpportunities.filter(opp => {
            if (this.snoozedIds.has(opp.id)) {
                return this.filters.riskFilter === 'SNOOZED';
            }
            if (this.filters.riskFilter === 'SNOOZED') {
                return false;
            }
            if (this.filters.riskFilter !== 'ALL' && opp.riskLevel.toUpperCase() !== this.filters.riskFilter) {
                return false;
            }
            if (this.filters.search) {
                const term = this.filters.search.toLowerCase();
                const matchesName = opp.name && opp.name.toLowerCase().includes(term);
                const matchesAccount = opp.accountName && opp.accountName.toLowerCase().includes(term);
                if (!matchesName && !matchesAccount) {
                    return false;
                }
            }
            return true;
        });

        result = result.slice().sort((a, b) => {
            const order = { Critical: 0, Warning: 1, Healthy: 2 };
            const aRank = order[a.riskLevel] ?? 3;
            const bRank = order[b.riskLevel] ?? 3;
            if (aRank !== bRank) {
                return aRank - bRank;
            }
            return new Date(a.closeDate) - new Date(b.closeDate);
        });

        return result;
    }

    get visibleOpportunities() {
        const paginated = this.filteredOpportunities.slice(0, this.currentPage * this.filters.pageSize);
        return paginated.map(opp => ({
            ...opp,
            isSelected: opp.id === this.selectedOpportunityId
        }));
    }

    get hasOpportunities() {
        return this.filteredOpportunities.length > 0;
    }

    get canLoadMore() {
        return this.filteredOpportunities.length > this.currentPage * this.filters.pageSize;
    }

    get criticalCount() {
        return this.allOpportunities.filter(o => o.riskLevel === 'Critical').length;
    }

    get warningCount() {
        return this.allOpportunities.filter(o => o.riskLevel === 'Warning').length;
    }

    get healthyCount() {
        return this.allOpportunities.filter(o => o.riskLevel === 'Healthy').length;
    }

    get totalPipeline() {
        return this.allOpportunities.reduce((sum, o) => sum + (o.amount || 0), 0);
    }

    get selectedOpportunity() {
        if (!this.selectedOpportunityId) {
            return null;
        }
        return this.allOpportunities.find(o => o.id === this.selectedOpportunityId) || null;
    }
}
