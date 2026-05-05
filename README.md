<div align="center">

[![True North Dreamin' 2026](https://img.shields.io/badge/True%20North%20Dreamin'%202026-Toronto%2C%20ON%20%7C%20May%2011--12-0176d3?style=for-the-badge&logo=salesforce&logoColor=white)](https://truenorthdreamin.com)

<strong>["Build Next-Gen Lightning Apps That Are Fast and Intelligent" by Andrii Sukhetskyi](https://medium.com/@ansukhetskyi/27c79cb5a32c?source=friends_link&sk=4c050394c3c2f5ba34a4eb4737ab6074)</strong>

</div>
<br>

# You are on the `solution` branch

This is the same Opportunity Radar from the `problem` branch: same features, same data, same Salesforce org. The difference is entirely in how the client code is written.

The implementation uses `@lwc/state` for centralized reactive state, `lightning/uiRecordApi` for zero-Apex mutations, IndexedDB for a stale-while-revalidate cache, and `Database.PaginationCursor` for safe pagination over large pipelines.

## Performance

| DevTools, Chrome for Developers | Description |
|---|---|
| <img width="1000" alt="good" src="https://github.com/user-attachments/assets/45d7942e-94c0-419b-a57c-accd1223399b" /> | **INP: 347ms.** Down from 3034ms on the `problem` branch, a **~9x improvement** with zero infrastructure changes.<br><br>**LCP: 0.40s.** Return visits render from IndexedDB cache in ~50ms before the Salesforce response even arrives. |

## What Changed

### Phase 1 — LDS mutations instead of Apex round-trips
`commit: e56d0fdb0abb401ac33925f01058cf15511581c4`

Field edits (NextStep, CloseDate, Stage) now go through `lightning/uiRecordApi`. A local `patchOpportunity` call updates the record in state immediately, the user sees the change before the server responds. No feed reload. No spinner. The Apex mutation methods are gone entirely.

### Phase 2 — Centralized reactive state with `@lwc/state`
`commit: c9010b83830ba09085f270cb1db11bee6fc40890`

All state lives in a single `opportunityRadarState` service module using `defineState`, `atom`, and `computed`. Child components subscribe via `fromContext` instead of receiving `@api` props or dispatching events up a four-level chain. Atomic updates mean only the piece of UI that actually changed re-renders.

### Phase 3 — Browser persistence layer
`commit: fd4fe078a03d9861d1bf86872bfba3cc2d3e394f`

- **IndexedDB** — the feed is cached locally. Return visits render in ~50ms from cache while a background sync runs against Salesforce. Stale records (closed, reassigned) are evicted automatically.
- **localStorage** — risk filter, compact view, and page size survive across sessions.
- **sessionStorage** — selected card survives page navigation within the same tab.

### Phase 4 — Apex cursor pagination
`commit: 8f4d1326bb2b705d65881b6f87dd10e9e20943a2`

`Database.PaginationCursor` (GA in Spring '26) replaces `LIMIT 50000`. Records load in 200-record batches discovered progressively. No timeout risk, no governor limit pressure, regardless of pipeline size.

## Try It Yourself

```bash
sf project deploy start --source-dir force-app
```

Seed the org with test opportunities, the script uses your existing Accounts, so make sure you have at least one:

```bash
sf apex run --file scripts/apex/opportunities.apex
```

Open the **Sales app -> Home page**. Edit a Next Step. Notice there is no reload. Refresh the tab. Notice the feed is instant.

## See Where It Started

Switch to the `problem` branch to see what this looked like before: Apex-only, no caching, full feed reload on every interaction.

```bash
git checkout problem
```
