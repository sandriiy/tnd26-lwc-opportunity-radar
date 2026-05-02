const HIGH_VALUE_THRESHOLD = 50000;
const EARLY_STAGES = new Set(['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition']);

function todayMidnight() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysUntil(dateString) {
    if (!dateString) return null;
    return Math.round((new Date(dateString) - todayMidnight()) / (1000 * 60 * 60 * 24));
}

function daysSince(dateString) {
    if (!dateString) return null;
    return Math.round((todayMidnight() - new Date(dateString)) / (1000 * 60 * 60 * 24));
}

function buildRiskReasons(stageName, daysToClose, daysSinceFollowUp, daysSinceModified, isHighValue, hasNextStep, isOverdue) {
    const reasons = [];

    if (isOverdue) {
        reasons.push('Close date is already in the past');
    }

    if (daysToClose != null && daysToClose >= 0 && daysToClose <= 7 && daysSinceFollowUp != null && daysSinceFollowUp > 7) {
        reasons.push('Close date is within 7 days with no recent follow-up');
    }

    if (isHighValue && daysSinceFollowUp != null && daysSinceFollowUp > 14) {
        reasons.push('High-value deal with no follow-up in ' + daysSinceFollowUp + ' days');
    }

    if (!hasNextStep && daysToClose != null && daysToClose >= 0 && daysToClose <= 14) {
        reasons.push('Next step is empty and close date is within 14 days');
    }

    if (daysSinceFollowUp != null && daysSinceFollowUp > 10) {
        reasons.push('No follow-up in ' + daysSinceFollowUp + ' days');
    }

    if (!hasNextStep && (daysToClose == null || daysToClose > 14)) {
        reasons.push('Next step is empty');
    }

    if (daysSinceModified != null && daysSinceModified > 14) {
        reasons.push('Opportunity has not been modified in ' + daysSinceModified + ' days');
    }

    if (daysToClose != null && daysToClose >= 0 && daysToClose <= 30 && EARLY_STAGES.has(stageName)) {
        reasons.push('Closing within 30 days but still in early stage');
    }

    return reasons;
}

function resolveRiskLevel(daysToClose, daysSinceFollowUp, daysSinceModified, isHighValue, hasNextStep, isOverdue, stageName) {
    if (isOverdue) {
        return 'Critical';
    }

    if (daysToClose != null && daysToClose >= 0 && daysToClose <= 7 && daysSinceFollowUp != null && daysSinceFollowUp > 7) {
        return 'Critical';
    }

    if (isHighValue && daysSinceFollowUp != null && daysSinceFollowUp > 14) {
        return 'Critical';
    }

    if (!hasNextStep && daysToClose != null && daysToClose >= 0 && daysToClose <= 14) {
        return 'Critical';
    }

    if (daysSinceFollowUp != null && daysSinceFollowUp > 10) {
        return 'Warning';
    }

    if (!hasNextStep) {
        return 'Warning';
    }

    if (daysSinceModified != null && daysSinceModified > 14) {
        return 'Warning';
    }

    if (daysToClose != null && daysToClose >= 0 && daysToClose <= 30 && EARLY_STAGES.has(stageName)) {
        return 'Warning';
    }

    return 'Healthy';
}

function resolveSuggestedAction(riskLevel, hasNextStep, daysSinceFollowUp) {
    if (riskLevel === 'Critical') {
        return hasNextStep
            ? 'Create a follow-up task for today.'
            : 'Add a next step to keep this deal moving.';
    }

    if (riskLevel === 'Warning') {
        if (daysSinceFollowUp != null && daysSinceFollowUp > 10) {
            return 'Schedule a follow-up call or send an update.';
        }

        return hasNextStep
            ? 'Review this opportunity before the close date.'
            : 'Define the next step to keep momentum.';
    }

    return 'Opportunity looks healthy. Keep it moving.';
}

function enrichWithRisk(opp) {
    const daysToClose = daysUntil(opp.closeDate);
    const daysSinceFollowUp = daysSince(opp.lastFollowUpDate);
    const daysSinceModified = daysSince(opp.lastModifiedDate);
    const isHighValue = opp.amount != null && opp.amount >= HIGH_VALUE_THRESHOLD;
    const hasNextStep = opp.nextStep != null && opp.nextStep.trim() !== '';
    const isOverdue = daysToClose != null && daysToClose < 0;

    const riskLevel = resolveRiskLevel(daysToClose, daysSinceFollowUp, daysSinceModified, isHighValue, hasNextStep, isOverdue, opp.stageName);
    const riskReasons = buildRiskReasons(opp.stageName, daysToClose, daysSinceFollowUp, daysSinceModified, isHighValue, hasNextStep, isOverdue);
    const suggestedAction = resolveSuggestedAction(riskLevel, hasNextStep, daysSinceFollowUp);

    return { ...opp, riskLevel, riskReasons, suggestedAction };
}

export { enrichWithRisk };
