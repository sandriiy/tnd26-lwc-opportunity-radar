public with sharing class OpportunityRadarController {
    @AuraEnabled
    public static List<OpportunityRadarEngine.OpportunityWrapper> getOpportunities() {
        return new OpportunityRadarEngine().fetchOpportunities();
    }

    @AuraEnabled
    public static void createFollowUpTask(Id opportunityId, String subject, Date dueDate) {
        new OpportunityRadarEngine().createTask(opportunityId, subject, dueDate);
    }

    @AuraEnabled
    public static void updateNextStep(Id opportunityId, String nextStep) {
        new OpportunityRadarEngine().setNextStep(opportunityId, nextStep);
    }

    @AuraEnabled
    public static void updateCloseDate(Id opportunityId, Date closeDate) {
        new OpportunityRadarEngine().setCloseDate(opportunityId, closeDate);
    }

    @AuraEnabled
    public static void updateStage(Id opportunityId, String stageName) {
        new OpportunityRadarEngine().setStage(opportunityId, stageName);
    }
}
