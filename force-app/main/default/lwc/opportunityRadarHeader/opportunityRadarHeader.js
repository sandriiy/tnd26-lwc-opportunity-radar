import { LightningElement } from 'lwc';
import { fromContext } from '@lwc/state';
import opportunityRadarState from 'c/opportunityRadarState';

export default class OpportunityRadarHeader extends LightningElement {
    radarState = fromContext(opportunityRadarState);

    handleRefresh() {
        this.radarState.value.resetFilters();
        this.radarState.value.loadFeed();
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

    get formattedPipeline() {
        const value = this.totalPipeline;
        if (value == null) return '$0';
        if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
        if (value >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
        return '$' + value.toFixed(0);
    }
}
