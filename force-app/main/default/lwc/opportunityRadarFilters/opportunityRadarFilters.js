import { LightningElement, api } from 'lwc';

const RISK_OPTIONS = [
    { label: 'All', value: 'ALL' },
    { label: 'Critical', value: 'CRITICAL' },
    { label: 'Warning', value: 'WARNING' },
    { label: 'Healthy', value: 'HEALTHY' },
    { label: 'Snoozed', value: 'SNOOZED' }
];

export default class OpportunityRadarFilters extends LightningElement {
    @api filters = {};

    handleSearchChange(event) {
        this.dispatchFilterChange({ search: event.target.value });
    }

    handleRiskFilterChange(event) {
        this.dispatchFilterChange({ riskFilter: event.detail.value });
    }

    handleCompactToggle(event) {
        this.dispatchFilterChange({ compactView: event.target.checked });
    }

    dispatchFilterChange(changed) {
        this.dispatchEvent(new CustomEvent('filterchange', { detail: changed }));
    }

    get riskOptions() {
        return RISK_OPTIONS;
    }
}
