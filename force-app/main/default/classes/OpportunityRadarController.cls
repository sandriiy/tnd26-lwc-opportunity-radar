public with sharing class OpportunityRadarController {
    @AuraEnabled
    public static List<OpportunityRadarEngine.OpportunityWrapper> getOpportunities() {
        return new OpportunityRadarEngine().fetchOpportunities();
    }

    @AuraEnabled
    public static void createFollowUpTask(Id opportunityId, String subject, Date dueDate) {
        new OpportunityRadarEngine().createTask(opportunityId, subject, dueDate);
    }
}
