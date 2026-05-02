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

    public List<OpportunityWrapper> fetchOpportunities() {
        List<Opportunity> opportunities = queryOpportunities();
        Set<Id> opportunityIds = new Map<Id, Opportunity>(opportunities).keySet();
        Map<Id, Date> lastTaskDateByOppId = getLastTaskDateByOpportunity(opportunityIds);

        List<OpportunityWrapper> result = new List<OpportunityWrapper>();
        for (Opportunity opp : opportunities) {
            result.add(buildWrapper(opp, lastTaskDateByOppId.get(opp.Id)));
        }

        return result;
    }

    public void createTask(Id opportunityId, String subject, Date dueDate) {
        Task t = new Task();
        t.WhatId = opportunityId;
        t.Subject = subject;
        t.ActivityDate = dueDate;
        t.Status = 'Not Started';
        t.Priority = 'Normal';
        insert t;
    }

    public void setNextStep(Id opportunityId, String nextStep) {
        update new Opportunity(Id = opportunityId, NextStep = nextStep);
    }

    public void setCloseDate(Id opportunityId, Date closeDate) {
        update new Opportunity(Id = opportunityId, CloseDate = closeDate);
    }

    public void setStage(Id opportunityId, String stageName) {
        update new Opportunity(Id = opportunityId, StageName = stageName);
    }

    private List<Opportunity> queryOpportunities() {
        Id currentUserId = UserInfo.getUserId();
        String baseQuery = 'SELECT Id, Name, Account.Name, StageName, Amount, CloseDate, Owner.Name, '
            + 'NextStep, LastActivityDate, LastModifiedDate, Probability, ForecastCategoryName '
            + 'FROM Opportunity WHERE IsClosed = false'
            + ' AND OwnerId = :currentUserId'
            + ' ORDER BY CloseDate ASC NULLS LAST LIMIT 50000';

        return Database.query(baseQuery);
    }

    private Map<Id, Date> getLastTaskDateByOpportunity(Set<Id> opportunityIds) {
        Map<Id, Date> result = new Map<Id, Date>();
        for (Task t : [
            SELECT WhatId, ActivityDate
            FROM Task
            WHERE WhatId IN :opportunityIds
            AND ActivityDate != null
            ORDER BY WhatId, ActivityDate DESC
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
