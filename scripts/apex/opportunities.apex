List<Account> accounts = [SELECT Id FROM Account LIMIT 10];
if (accounts.isEmpty()) { throw new IllegalStateException('No accounts found — create at least one account first.'); }
Integer accCount = accounts.size();

Id userId = UserInfo.getUserId();
Date today = Date.today();

List<Opportunity> opps = new List<Opportunity>();

// 1. OVERDUE — close date in the past

for (Integer i = 0; i < 5; i++) {
    opps.add(new Opportunity(
        Name = 'Overdue Critical No NextStep ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Negotiation/Review',
        CloseDate = today.addDays(-10 - i),
        Amount = 75000 + i * 5000,
        OwnerId = userId
    ));
}

for (Integer i = 0; i < 5; i++) {
    opps.add(new Opportunity(
        Name = 'Overdue With NextStep ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Proposal/Price Quote',
        CloseDate = today.addDays(-3 - i),
        Amount = 10000 + i * 1000,
        NextStep = 'Follow up with client',
        OwnerId = userId
    ));
}

// 2. CLOSING WITHIN 7 DAYS — stale

for (Integer i = 0; i < 8; i++) {
    opps.add(new Opportunity(
        Name = 'Closing Soon No FollowUp ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Negotiation/Review',
        CloseDate = today.addDays(1 + i),
        Amount = 30000 + i * 2000,
        NextStep = 'Send contract',
        OwnerId = userId
    ));
}

// 3. CLOSING WITHIN 7 DAYS — recent activity

for (Integer i = 0; i < 5; i++) {
    opps.add(new Opportunity(
        Name = 'Closing Soon With FollowUp ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Negotiation/Review',
        CloseDate = today.addDays(2 + i),
        Amount = 40000 + i * 3000,
        NextStep = 'Awaiting signature',
        OwnerId = userId
    ));
}

// 4. HIGH VALUE (≥50k), stale

for (Integer i = 0; i < 8; i++) {
    opps.add(new Opportunity(
        Name = 'HighValue Stale ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Value Proposition',
        CloseDate = today.addDays(30 + i),
        Amount = 50000 + i * 10000,
        NextStep = 'Demo scheduled',
        OwnerId = userId
    ));
}

// 5. HIGH VALUE — active

for (Integer i = 0; i < 5; i++) {
    opps.add(new Opportunity(
        Name = 'HighValue Active ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Proposal/Price Quote',
        CloseDate = today.addDays(45 + i),
        Amount = 80000 + i * 5000,
        NextStep = 'Waiting for legal review',
        OwnerId = userId
    ));
}

// 6. NO NEXT STEP, closing within 14 days

for (Integer i = 0; i < 8; i++) {
    opps.add(new Opportunity(
        Name = 'No NextStep Close14 ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Negotiation/Review',
        CloseDate = today.addDays(5 + i),
        Amount = 20000 + i * 2500,
        OwnerId = userId
    ));
}

// 7. NO FOLLOW-UP in >10 days

for (Integer i = 0; i < 10; i++) {
    opps.add(new Opportunity(
        Name = 'Stale FollowUp Warning ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Qualification',
        CloseDate = today.addDays(20 + i),
        Amount = 15000 + i * 1000,
        NextStep = 'Needs qualification call',
        OwnerId = userId
    ));
}

// 8. NO NEXT STEP, close date >14 days away

for (Integer i = 0; i < 10; i++) {
    opps.add(new Opportunity(
        Name = 'No NextStep Far Close ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Needs Analysis',
        CloseDate = today.addDays(30 + i),
        Amount = 12000 + i * 500,
        OwnerId = userId
    ));
}

// 9. STALE, no activity at all

for (Integer i = 0; i < 8; i++) {
    opps.add(new Opportunity(
        Name = 'Stale No Activity ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Prospecting',
        CloseDate = today.addDays(60 + i),
        Amount = 8000 + i * 500,
        NextStep = 'Initial outreach pending',
        OwnerId = userId
    ));
}

// 10. EARLY STAGE, closing within 30 days

String[] earlyStages = new String[]{'Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition'};
for (Integer i = 0; i < 12; i++) {
    opps.add(new Opportunity(
        Name = 'EarlyStage Close30 ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = earlyStages[Math.mod(i, 4)],
        CloseDate = today.addDays(5 + i),
        Amount = 18000 + i * 1000,
        NextStep = 'Discovery call booked',
        OwnerId = userId
    ));
}

// 11. HEALTHY — all signals green

String[] lateStages = new String[]{'Proposal/Price Quote', 'Negotiation/Review', 'Id. Decision Makers', 'Perception Analysis'};
for (Integer i = 0; i < 20; i++) {
    opps.add(new Opportunity(
        Name = 'Healthy Active ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = lateStages[Math.mod(i, 4)],
        CloseDate = today.addDays(20 + i),
        Amount = 25000 + i * 2000,
        NextStep = 'Contract under review',
        OwnerId = userId
    ));
}

for (Integer i = 0; i < 10; i++) {
    opps.add(new Opportunity(
        Name = 'Healthy LowValue ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Proposal/Price Quote',
        CloseDate = today.addDays(15 + i),
        Amount = 5000 + i * 500,
        NextStep = 'Awaiting client response',
        OwnerId = userId
    ));
}

// 12. EDGE CASES

for (Integer i = 0; i < 5; i++) {
    opps.add(new Opportunity(
        Name = 'Null Amount ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Needs Analysis',
        CloseDate = today.addDays(25 + i),
        OwnerId = userId
    ));
}

for (Integer i = 0; i < 3; i++) {
    opps.add(new Opportunity(
        Name = 'Closing Today ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Negotiation/Review',
        CloseDate = today,
        Amount = 35000 + i * 5000,
        NextStep = 'Final review in progress',
        OwnerId = userId
    ));
}

for (Integer i = 0; i < 3; i++) {
    opps.add(new Opportunity(
        Name = 'Compounding Risk ' + i,
        AccountId = accounts[Math.mod(i, accCount)].Id,
        StageName = 'Prospecting',
        CloseDate = today.addDays(-5 - i),
        Amount = 100000 + i * 20000,
        OwnerId = userId
    ));
}

insert opps;