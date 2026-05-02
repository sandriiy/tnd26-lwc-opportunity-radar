import { LightningElement, api } from 'lwc';

export default class OpportunityRadarHeader extends LightningElement {
    @api criticalCount = 0;
    @api warningCount = 0;
    @api healthyCount = 0;
    @api totalPipeline = 0;
    @api lastRefresh = null;
    @api isLoading = false;

    handleRefresh() {
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    get formattedPipeline() {
        if (this.totalPipeline == null) {
            return '$0';
        } else if (this.totalPipeline >= 1_000_000) {
            return '$' + (this.totalPipeline / 1_000_000).toFixed(1) + 'M';
        } else if (this.totalPipeline >= 1_000) {
            return '$' + (this.totalPipeline / 1_000).toFixed(0) + 'K';
        }
        return '$' + this.totalPipeline.toFixed(0);
    }
}
