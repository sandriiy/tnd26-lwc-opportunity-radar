public with sharing class OpportunityRadarEngine {
	public class OpportunityWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String accountName;
        @AuraEnabled public String stageName;
        @AuraEnabled public Decimal amount;
        @AuraEnabled public Date closeDate;
        @AuraEnabled public String ownerName;
        @AuraEnabled public String nextStep;
        @AuraEnabled public Decimal probability;
        @AuraEnabled public String forecastCategory;
        @AuraEnabled public Date lastFollowUpDate;
        @AuraEnabled public DateTime lastModifiedDate;
    }

    public class CursorPage {
        @AuraEnabled public List<OpportunityWrapper> records;
        @AuraEnabled public Database.PaginationCursor cursor;
        @AuraEnabled public Integer nextIndex;
        @AuraEnabled public Boolean hasMore;
    }

    private static final Integer DEFAULT_BATCH_SIZE = 200;
    private static final List<String> OPP_FIELDS = new List<String>{
        'Id', 'Name', 'Account.Name', 'StageName', 'Amount', 'CloseDate', 'Owner.Name',
        'NextStep', 'LastActivityDate', 'LastModifiedDate', 'Probability', 'ForecastCategoryName'
    };

    public CursorPage fetchOpportunitiesPage(Database.PaginationCursor cursor, Integer nextIndex, Integer batchSize) {
        Integer size = batchSize != null ? batchSize : DEFAULT_BATCH_SIZE;
        Integer startIndex = nextIndex != null ? nextIndex : 0;

        if (cursor == null) {
            cursor = openPaginationCursor();
        }

        Integer totalRecords = cursor.getNumRecords();
        Integer actualSize = Math.min(size, totalRecords - startIndex);
        Database.CursorFetchResult fetchResult = cursor.fetchPage(startIndex, actualSize);

        List<Opportunity> opportunities = new List<Opportunity>();
        for (SObject s : fetchResult.getRecords()) {
            opportunities.add((Opportunity) s);
        }

        Set<Id> batchIds = new Map<Id, Opportunity>(opportunities).keySet();
        Map<Id, Date> lastTaskDates = getLastTaskDateByOpportunity(batchIds);

        List<OpportunityWrapper> wrappers = new List<OpportunityWrapper>();
        for (Opportunity opp : opportunities) {
            wrappers.add(buildWrapper(opp, lastTaskDates.get(opp.Id)));
        }

        Integer nextIdx = fetchResult.getNextIndex();

        CursorPage page = new CursorPage();
        page.records = wrappers;
        page.cursor = cursor;
        page.nextIndex = nextIdx;
        page.hasMore = nextIdx < totalRecords;

        return page;
    }

    private Database.PaginationCursor openPaginationCursor() {
        Id currentUserId = UserInfo.getUserId();
        return Database.getPaginationCursor(
            'SELECT ' + String.join(OPP_FIELDS, ', ')
            + ' FROM Opportunity WHERE IsClosed = false'
            + ' AND OwnerId = :currentUserId'
            + ' ORDER BY CloseDate ASC NULLS LAST, Id ASC'
        );
    }

    public List<OpportunityWrapper> fetchOpportunitiesByIds(List<Id> ids) {
        if (ids == null || ids.isEmpty()) return new List<OpportunityWrapper>();
        Id userId = UserInfo.getUserId();
        Set<Id> idSet = new Set<Id>(ids);
        List<Opportunity> opps = Database.query(
            'SELECT ' + String.join(OPP_FIELDS, ', ') + ' FROM Opportunity WHERE Id IN :idSet AND IsClosed = false AND OwnerId = :userId'
        );
        Map<Id, Date> lastTaskDates = getLastTaskDateByOpportunity(idSet);
        List<OpportunityWrapper> wrappers = new List<OpportunityWrapper>();
        for (Opportunity opp : opps) {
            wrappers.add(buildWrapper(opp, lastTaskDates.get(opp.Id)));
        }

        return wrappers;
    }

    public List<OpportunityWrapper> searchOpportunities(String searchTerm) {
        if (String.isBlank(searchTerm) || searchTerm.trim().length() < 2) {
            return new List<OpportunityWrapper>();
        }

        Id userId = UserInfo.getUserId();
        String term = '%' + searchTerm.trim() + '%';

        List<Opportunity> opps = Database.query(
            'SELECT ' + String.join(OPP_FIELDS, ', ')
            + ' FROM Opportunity WHERE IsClosed = false AND OwnerId = :userId'
            + ' AND (Name LIKE :term OR Account.Name LIKE :term)'
            + ' ORDER BY CloseDate ASC NULLS LAST LIMIT 2000'
        );

        Set<Id> oppIds = new Map<Id, Opportunity>(opps).keySet();
        Map<Id, Date> lastTaskDates = getLastTaskDateByOpportunity(oppIds);
        List<OpportunityWrapper> wrappers = new List<OpportunityWrapper>();
        for (Opportunity opp : opps) {
            wrappers.add(buildWrapper(opp, lastTaskDates.get(opp.Id)));
        }

        return wrappers;
    }

    public OpportunityWrapper fetchSingleOpportunity(Id opportunityId) {
        List<Opportunity> opps = Database.query(
            'SELECT ' + String.join(OPP_FIELDS, ', ') + ' FROM Opportunity WHERE Id = :opportunityId LIMIT 1'
        );

        if (opps.isEmpty()) {
            throw new QueryException('Opportunity not found.');
        }

        Map<Id, Date> lastTaskDates = getLastTaskDateByOpportunity(new Set<Id>{ opportunityId });
        return buildWrapper(opps[0], lastTaskDates.get(opportunityId));
    }

    public void createTask(Id opportunityId, String subject, Date dueDate) {
        insert new Task(
            WhatId = opportunityId,
            Subject = subject,
            ActivityDate = dueDate,
            Status = 'Not Started',
            Priority = 'Normal'
        );
    }

    private Map<Id, Date> getLastTaskDateByOpportunity(Set<Id> opportunityIds) {
        Map<Id, Date> result = new Map<Id, Date>();
        for (Task t : [
            SELECT WhatId, ActivityDate
            FROM Task
            WHERE WhatId IN :opportunityIds
            AND ActivityDate != null
            ORDER BY WhatId, ActivityDate DESC
            LIMIT 10000
        ]) {
            if (!result.containsKey(t.WhatId)) {
                result.put(t.WhatId, t.ActivityDate);
            }
        }
		
        return result;
    }

    private OpportunityWrapper buildWrapper(Opportunity opp, Date lastTaskDate) {
        OpportunityWrapper w = new OpportunityWrapper();
        w.id = opp.Id;
        w.name = opp.Name;
        w.accountName = opp.Account != null ? opp.Account.Name : null;
        w.stageName = opp.StageName;
        w.amount = opp.Amount;
        w.closeDate = opp.CloseDate;
        w.ownerName = opp.Owner != null ? opp.Owner.Name : null;
        w.nextStep = opp.NextStep;
        w.probability = opp.Probability;
        w.forecastCategory = opp.ForecastCategoryName;

        w.lastModifiedDate = opp.LastModifiedDate;
        w.lastFollowUpDate = resolveLastFollowUp(opp, lastTaskDate);

        return w;
    }

    private Date resolveLastFollowUp(Opportunity opp, Date lastTaskDate) {
        if (opp.LastActivityDate != null) {
            return opp.LastActivityDate;
        }

        if (lastTaskDate != null) {
            return lastTaskDate;
        }

        return opp.LastModifiedDate != null ? opp.LastModifiedDate.date() : null;
    }
}
