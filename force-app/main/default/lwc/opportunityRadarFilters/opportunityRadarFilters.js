import { LightningElement } from 'lwc';
import { fromContext } from '@lwc/state';
import opportunityRadarState from 'c/opportunityRadarState';

const RISK_OPTIONS = [
    { label: 'All', value: 'ALL' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'Warning', value: 'WARNING' },
    { label: 'Healthy', value: 'HEALTHY' },
    { label: 'Snoozed', value: 'SNOOZED' }
];

export default class OpportunityRadarFilters extends LightningElement {
    radarState = fromContext(opportunityRadarState);

    handleSearchChange(event) {
        this.radarState.value.setFilter({ search: event.target.value });
    }

    handleSearchKeyDown(event) {
        if (event.key === 'Enter') {
            this.radarState.value.serverSearch(this.radarState.value.filters.search);
        }
    }

    handleRiskFilterChange(event) {
        this.radarState.value.setFilter({ riskFilter: event.detail.value });
    }

    handleCompactToggle(event) {
        this.radarState.value.setFilter({ compactView: event.target.checked });
    }

    handleServerAction() {
        const state = this.radarState.value;
        if (state.filters.search.length >= 2) {
            state.serverSearch(state.filters.search);
        } else {
            state.loadMore();
        }
    }

    get filters() {
        return this.radarState.value.filters;
    }

    get isSearching() {
        return this.radarState.value.isSearching;
    }

    get showHint() {
        const state = this.radarState.value;
        if (state.isSearching) return true;
        const searchPending = state.filters.search.length >= 2 && !state.serverSearchDone;
        const riskFiltered = state.filters.riskFilter !== 'ALL' && state.filters.riskFilter !== 'SNOOZED';
        return searchPending || riskFiltered;
    }

    get riskOptions() {
        return RISK_OPTIONS;
    }
}
