import { LightningElement, track } from 'lwc';
import { fromContext } from '@lwc/state';
import { NavigationMixin } from 'lightning/navigation';
import opportunityRadarState from 'c/opportunityRadarState';

export default class OpportunityRadarPanel extends NavigationMixin(LightningElement) {
    radarState = fromContext(opportunityRadarState);

    @track showNextStepForm = false;
    @track nextStepValue = '';
    @track taskSubject = '';
    @track taskDueDate = '';

    connectedCallback() {
        this.resetTaskForm();
    }

    handleClose() {
        this.radarState.value.dismissSelection();
    }

    handleBackdropClick() {
        this.radarState.value.dismissSelection();
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    handleShowNextStepForm() {
        this.nextStepValue = this.opportunity?.nextStep || '';
        this.showNextStepForm = true;
    }

    handleNextStepChange(event) {
        this.nextStepValue = event.target.value;
    }

    handleSaveNextStep() {
        this.radarState.value.updateNextStep(this.opportunity.id, this.nextStepValue);
        this.showNextStepForm = false;
    }

    handleCancelNextStep() {
        this.showNextStepForm = false;
    }

    handleTaskSubjectChange(event) {
        this.taskSubject = event.target.value;
    }

    handleTaskDueDateChange(event) {
        this.taskDueDate = event.target.value;
    }

    handleCreateTask() {
        this.radarState.value.createTask(this.opportunity.id, this.taskSubject, this.taskDueDate);
        this.resetTaskForm();
    }

    handleOpenRecord() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.opportunity.id,
                actionName: 'view'
            }
        });
    }

    resetTaskForm() {
        this.taskSubject = 'Follow up on ' + (this.opportunity?.name || '');
        this.taskDueDate = new Date().toISOString().split('T')[0];
    }

    get opportunity() {
        return this.radarState.value.selectedOpportunity;
    }

    get formattedAmount() {
        const amount = this.opportunity?.amount;
        if (amount == null) {
            return 'No amount';
        } else if (amount >= 1_000_000) {
            return '$' + (amount / 1_000_000).toFixed(1) + 'M';
        } else if (amount >= 1_000) {
            return '$' + (amount / 1_000).toFixed(0) + 'K';
        }
        return '$' + amount.toFixed(0);
    }

    get formattedLastFollowUp() {
        const followUp = this.opportunity?.lastFollowUpDate;
        if (!followUp) {
            return 'No activity recorded';
        }
        const date = new Date(followUp);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round((today - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays <= 30) {
            return `${diffDays} days ago`;
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    get nextStepDisplay() {
        return this.opportunity?.nextStep || 'No next step defined.';
    }
}
