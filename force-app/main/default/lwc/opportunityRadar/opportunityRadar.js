import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import opportunityRadarState from 'c/opportunityRadarState';

export default class OpportunityRadar extends LightningElement {
    radarState = opportunityRadarState();

    connectedCallback() {
        this.radarState.value.loadFeed();
    }

    renderedCallback() {
        const toast = this.radarState.value.pendingToast;
        if (toast) {
            this.dispatchEvent(new ShowToastEvent(toast));
            this.radarState.value.clearToast();
        }
    }

    handleLoadMore() {
        this.radarState.value.loadMore();
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

    get hasOpportunities() {
        return this.radarState.value.hasOpportunities;
    }

    get visibleOpportunities() {
        return this.radarState.value.visibleOpportunities;
    }

    get canLoadMore() {
        return this.radarState.value.canLoadMore;
    }

    get isSyncing() {
        return this.radarState.value.isSyncing;
    }

    get showLoadMore() {
        return this.radarState.value.canLoadMore || this.radarState.value.isSyncing;
    }

    get selectedOpportunity() {
        return this.radarState.value.selectedOpportunity;
    }
}
