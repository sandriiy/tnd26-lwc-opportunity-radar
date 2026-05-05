public with sharing class OpportunityRadarController {
    @AuraEnabled
    public static void createFollowUpTask(Id opportunityId, String subject, Date dueDate) {
        new OpportunityRadarEngine().createTask(opportunityId, subject, dueDate);
    }

    @AuraEnabled
    public static OpportunityRadarEngine.CursorPage getOpportunitiesPage(Database.PaginationCursor cursor, Integer nextIndex, Integer batchSize) {
        return new OpportunityRadarEngine().fetchOpportunitiesPage(cursor, nextIndex, batchSize);
    }

    @AuraEnabled
    public static List<OpportunityRadarEngine.OpportunityWrapper> getOpportunitiesByIds(List<Id> opportunityIds) {
        return new OpportunityRadarEngine().fetchOpportunitiesByIds(opportunityIds);
    }

    @AuraEnabled
    public static OpportunityRadarEngine.OpportunityWrapper getSingleOpportunity(Id opportunityId) {
        return new OpportunityRadarEngine().fetchSingleOpportunity(opportunityId);
    }

    @AuraEnabled
    public static List<OpportunityRadarEngine.OpportunityWrapper> searchOpportunities(String searchTerm) {
        return new OpportunityRadarEngine().searchOpportunities(searchTerm);
    }
}