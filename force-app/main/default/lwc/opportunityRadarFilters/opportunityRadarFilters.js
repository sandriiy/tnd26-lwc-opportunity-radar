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

    handleRiskFilterChange(event) {
        this.radarState.value.setFilter({ riskFilter: event.detail.value });
    }

    handleCompactToggle(event) {
        this.radarState.value.setFilter({ compactView: event.target.checked });
    }

    get filters() {
        return this.radarState.value.filters;
    }

    get riskOptions() {
        return RISK_OPTIONS;
    }
}
