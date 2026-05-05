<div align="center">

[![True North Dreamin' 2026](https://img.shields.io/badge/True%20North%20Dreamin'%202026-Toronto%2C%20ON%20%7C%20May%2011--12-0176d3?style=for-the-badge&logo=salesforce&logoColor=white)](https://truenorthdreamin.com)

<strong>["Build Next-Gen Lightning Apps That Are Fast and Intelligent" by Andrii Sukhetskyi](https://medium.com/@ansukhetskyi/27c79cb5a32c?source=friends_link&sk=4c050394c3c2f5ba34a4eb4737ab6074)</strong>

</div>
<br>

# You are on the `problem` branch

This is a fully functional Opportunity Radar built on Salesforce LWC. It loads a user's open pipeline, scores each opportunity by risk, lets sales reps edit fields, log follow-up tasks, and filter by risk level.

The implementation is Apex-only: every mutation (field edit, task creation) triggers a full Apex reload of the entire feed. There is no caching, no local state, nothing. It works. It just makes users wait for things that don't need a server at all.

## Performance

| DevTools, Chrome for Developers | Description |
|---|---|
| <img width="1000" alt="INP Before" src="https://github.com/user-attachments/assets/0d20fd1b-676e-4a48-bfe4-90500196379e" /> | **INP: 3034ms.** Every time a user does anything, they wait 3 full seconds for Apex to respond and the entire feed to re-render.<br><br>**LCP at 27 seconds**, even though it depends heavily on the native Salesforce lifecycle, our implementation definitely contributed to that number. |

## Try It Yourself

```bash
sf project deploy start --source-dir force-app
```

Seed the org with test opportunities, the script uses your existing Accounts, so make sure you have at least one:

```bash
sf apex run --file scripts/apex/opportunities.apex
```

Open the **Sales app -> Home page**. Edit a Next Step. Watch the feed reload. Refresh the tab. Wait.

## See It Done Right

Switch to the `solution` branch to see the same app rebuilt with `@lwc/state`, `lightning/uiRecordApi`, IndexedDB caching, and cursor-based Apex pagination.

```bash
git checkout solution
```
