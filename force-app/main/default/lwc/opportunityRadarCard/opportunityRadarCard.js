import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

const STAGE_OPTIONS = [
    { label: 'Prospecting', value: 'Prospecting' },
    { label: 'Qualification', value: 'Qualification' },
    { label: 'Needs Analysis', value: 'Needs Analysis' },
    { label: 'Value Proposition', value: 'Value Proposition' },
    { label: 'Id. Decision Makers', value: 'Id. Decision Makers' },
    { label: 'Perception Analysis', value: 'Perception Analysis' },
    { label: 'Proposal/Price Quote', value: 'Proposal/Price Quote' },
    { label: 'Negotiation/Review', value: 'Negotiation/Review' },
    { label: 'Closed Won', value: 'Closed Won' },
    { label: 'Closed Lost', value: 'Closed Lost' }
];

const RISK_BADGE_CLASSES = {
    Critical: 'risk-badge risk-badge-critical',
    Warning: 'risk-badge risk-badge-warning',
    Healthy: 'risk-badge risk-badge-healthy',
    Snoozed: 'risk-badge risk-badge-snoozed'
};

export default class OpportunityRadarCard extends NavigationMixin(LightningElement) {
    @api opportunity;
    @api isCompact = false;
    @api isSelected = false;

    @track activeAction = null; // null | 'task' | 'nextStep' | 'closeDate' | 'stage'

    @track taskSubject = '';
    @track taskDueDate = '';
    @track nextStepValue = '';
    @track closeDateValue = '';
    @track stageValue = '';

    handleCardClick() {
        this.dispatchEvent(new CustomEvent('cardselect', {
            detail: { opportunityId: this.opportunity.id }
        }));
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    handleShowTaskForm(event) {
        event.stopPropagation();
        if (this.activeAction === 'task') {
            this.activeAction = null;
            return;
        }

        this.taskSubject = 'Follow up on ' + this.opportunity.name;
        this.taskDueDate = new Date().toISOString().split('T')[0];
        this.activeAction = 'task';
    }

    handleTaskSubjectChange(event) {
        this.taskSubject = event.target.value;
    }

    handleTaskDueDateChange(event) {
        this.taskDueDate = event.target.value;
    }

    handleSaveTask(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('createfollowtask', {
            detail: {
                opportunityId: this.opportunity.id,
                subject: this.taskSubject,
                dueDate: this.taskDueDate
            }
        }));

        this.activeAction = null;
    }

    handleShowNextStepForm(event) {
        event.stopPropagation();
        if (this.activeAction === 'nextStep') {
            this.activeAction = null;
            return;
        }

        this.nextStepValue = this.opportunity.nextStep || '';
        this.activeAction = 'nextStep';
    }

    handleNextStepChange(event) {
        this.nextStepValue = event.target.value;
    }

    handleSaveNextStep(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('updatenextstep', {
            detail: {
                opportunityId: this.opportunity.id,
                nextStep: this.nextStepValue
            }
        }));

        this.activeAction = null;
    }

    handleShowCloseDateForm(event) {
        event.stopPropagation();
        if (this.activeAction === 'closeDate') {
            this.activeAction = null;
            return;
        }

        this.closeDateValue = this.opportunity.closeDate || '';
        this.activeAction = 'closeDate';
    }

    handleCloseDateChange(event) {
        this.closeDateValue = event.target.value;
    }

    handleSaveCloseDate(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('updateclosedate', {
            detail: {
                opportunityId: this.opportunity.id,
                closeDate: this.closeDateValue
            }
        }));

        this.activeAction = null;
    }

    handleShowStageForm(event) {
        event.stopPropagation();
        if (this.activeAction === 'stage') {
            this.activeAction = null;
            return;
        }

        this.stageValue = this.opportunity.stageName || '';
        this.activeAction = 'stage';
    }

    handleStageChange(event) {
        this.stageValue = event.detail.value;
    }

    handleSaveStage(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('updatestage', {
            detail: {
                opportunityId: this.opportunity.id,
                stageName: this.stageValue
            }
        }));

        this.activeAction = null;
    }

    handleCancelAction(event) {
        event.stopPropagation();
        this.activeAction = null;
    }

    handleSnooze(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('snooze', {
            detail: { opportunityId: this.opportunity.id }
        }));
    }

    handleOpenRecord(event) {
        event.stopPropagation();
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.opportunity.id,
                actionName: 'view'
            }
        });
    }

    actionWrapperClass(action) {
        if (!this.activeAction) {
            return 'action-wrapper';
        }
		
        return this.activeAction === action
            ? 'action-wrapper action-wrapper--active'
            : 'action-wrapper action-wrapper--dimmed';
    }

    get showDetails() {
        return !this.isCompact;
    }

    get cardClass() {
        let classes = 'radar-card';
        if (this.isSelected) {
            classes += ' radar-card--selected';
        }
        if (this.isCompact) {
            classes += ' radar-card--compact';
        }

        return classes;
    }

    get riskBadgeClass() {
        return RISK_BADGE_CLASSES[this.opportunity?.riskLevel] || 'risk-badge';
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

    get formattedCloseDate() {
        const closeDate = this.opportunity?.closeDate;
        if (!closeDate) return 'No close date';

        const date = new Date(closeDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = date - today;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return `${Math.abs(diffDays)} days ago (overdue)`;
        } else if (diffDays === 0) {
            return 'today';
        } else if (diffDays === 1) {
            return 'tomorrow';
        } else if (diffDays <= 30) {
            return `in ${diffDays} days`;
        }

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    get closeDateClass() {
        const closeDate = this.opportunity?.closeDate;
        if (!closeDate) return 'card-close-date';

        const date = new Date(closeDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return 'card-close-date card-close-date--overdue';
        } else if (diffDays <= 7) {
            return 'card-close-date card-close-date--urgent';
        }

        return 'card-close-date';
    }

    get formattedLastFollowUp() {
        const followUp = this.opportunity?.lastFollowUpDate;
        if (!followUp) return 'No activity recorded';

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

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    get stageOptions() {
        return STAGE_OPTIONS;
    }

    get isTaskActive() {
        return this.activeAction === 'task';
    }

    get isNextStepActive() {
        return this.activeAction === 'nextStep';
    }

    get isCloseDateActive() {
        return this.activeAction === 'closeDate';
    }

    get isStageActive() {
        return this.activeAction === 'stage';
    }

    get taskWrapperClass() {
        return this.actionWrapperClass('task');
    }

    get nextStepWrapperClass() {
        return this.actionWrapperClass('nextStep');
    }

    get closeDateWrapperClass() {
        return this.actionWrapperClass('closeDate');
    }

    get stageWrapperClass() {
        return this.actionWrapperClass('stage');
    }

    get snoozeWrapperClass() {
        return this.activeAction ? 'action-wrapper action-wrapper--dimmed' : 'action-wrapper';
    }
}
