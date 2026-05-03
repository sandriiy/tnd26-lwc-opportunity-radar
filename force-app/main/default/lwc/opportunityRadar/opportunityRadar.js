import { LightningElement } from 'lwc';
import opportunityRadarState from 'c/opportunityRadarState';

export default class OpportunityRadar extends LightningElement {
    radarState = opportunityRadarState();

    connectedCallback() {
        this.radarState.value.loadFeed();
    }

    handleRefresh() {
        this.radarState.value.resetFilters();
        this.radarState.value.loadFeed();
    }

    handleFilterChange(event) {
        this.radarState.value.setFilter(event.detail);
    }

    handleLoadMore() {
        this.radarState.value.loadMore();
    }

    handleCardSelect(event) {
        this.radarState.value.selectCard(event.detail.opportunityId);
    }

    handleClosePanel() {
        this.radarState.value.dismissSelection();
    }

    handleCreateFollowUpTask(event) {
        const { opportunityId, subject, dueDate } = event.detail;
        this.radarState.value.createTask(opportunityId, subject, dueDate);
    }

    handleUpdateNextStep(event) {
        const { opportunityId, nextStep } = event.detail;
        this.radarState.value.updateNextStep(opportunityId, nextStep);
    }

    handleUpdateCloseDate(event) {
        const { opportunityId, closeDate } = event.detail;
        this.radarState.value.updateCloseDate(opportunityId, closeDate);
    }

    handleUpdateStage(event) {
        const { opportunityId, stageName } = event.detail;
        this.radarState.value.updateStage(opportunityId, stageName);
    }

    handleSnooze(event) {
        this.radarState.value.snoozeCard(event.detail.opportunityId);
    }

    get filters() {
        return this.radarState.value.filters;
    }

    get visibleOpportunities() {
        return this.radarState.value.visibleOpportunities;
    }

    get hasOpportunities() {
        return this.radarState.value.hasOpportunities;
    }

    get canLoadMore() {
        return this.radarState.value.canLoadMore;
    }

    get criticalCount() {
        return this.radarState.value.criticalCount;
    }

    get warningCount() {
        return this.radarState.value.warningCount;
    }

    get healthyCount() {
        return this.radarState.value.healthyCount;
    }

    get totalPipeline() {
        return this.radarState.value.totalPipeline;
    }

    get lastRefresh() {
        return this.radarState.value.lastRefresh;
    }

    get isLoading() {
        return this.radarState.value.isLoading;
    }

    get hasError() {
        return this.radarState.value.hasError;
    }

    get errorMessage() {
        return this.radarState.value.errorMessage;
    }

    get selectedOpportunity() {
        return this.radarState.value.selectedOpportunity;
    }
}
