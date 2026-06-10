# Content Operation Hub — Wiki

Enterprise workspace for **AEM Edge Delivery** (Document Authoring). Browse folders and pages, fetch deployment status, run bulk preview/publish/removal operations, and open Document Authoring or environment URLs from one place.

| | |
|---|---|
| **Display name** | Content Operation Hub |
| **Technical slug** | `bulk-preview-publish` (folder and URL path unchanged for compatibility) |
| **Entry points** | `tools/bulk-preview-publish/index.html` · `tools/bulk-preview-publish.html` |
| **Requires** | Document Authoring (DA) — Adobe IMS authentication via DA SDK |

---

## Table of contents

1. [Getting started](#getting-started)
2. [Interface overview](#interface-overview)
3. [Navigation and content loading](#navigation-and-content-loading)
4. [Folders (Directories)](#folders-directories)
5. [Pages panel](#pages-panel)
6. [Fetch deployment status](#fetch-deployment-status)
7. [Deployment status panel](#deployment-status-panel)
8. [Page list and browse UI](#page-list-and-browse-ui)
9. [Page selection](#page-selection)
10. [Selection command bar](#selection-command-bar)
11. [Bulk preview and publish](#bulk-preview-and-publish)
12. [Bulk removal and delete](#bulk-removal-and-delete)
13. [Open URLs and Document Authoring](#open-urls-and-document-authoring)
14. [Modals and confirmations](#modals-and-confirmations)
15. [Cancel and stop behavior](#cancel-and-stop-behavior)
16. [Per-row actions](#per-row-actions)
17. [Status legend and filters](#status-legend-and-filters)
18. [URL parameters and debug](#url-parameters-and-debug)
19. [Technical reference](#technical-reference)
20. [Limitations and troubleshooting](#limitations-and-troubleshooting)
21. [Quick workflow reference](#quick-workflow-reference)

---

## Getting started

### How to open the tool

1. Sign in to **Document Authoring** at [https://da.live](https://da.live).
2. Open your site app: `https://da.live/app/{org}/{site}/…`
3. Launch **Content Operation Hub** from the DA Apps menu (register the tool path `tools/bulk-preview-publish` in your DA Apps configuration).

The tool **cannot authenticate** when opened on `.aem.page` / `.aem.live` preview URLs or as a local file. It needs the DA SDK (`https://da.live/nx/utils/sdk.js`), which provides `daFetch` with Bearer tokens for AEM Admin APIs.

### Authentication errors

If you open the tool outside DA, you see a structured error panel:

- **Title:** Sign in to Document Authoring
- **Message:** Sign in to Document Authoring (https://da.live) and open Content Operation Hub from Apps. Preview (.aem.page / .aem.live) URLs cannot authenticate.
- **Steps:** sign in → open site app → launch Content Operation Hub
- **Button:** Open Document Authoring → [https://da.live](https://da.live)

Related messages:

| Situation | Message theme |
|-----------|----------------|
| SDK / `daFetch` unavailable | Sign in to DA, then open Content Operation Hub from Apps |
| Missing org or site | Open from your site app (`da.live/app/your-org/your-site`) |
| 401 / not signed in | You are not signed in — sign in and reopen from Apps |
| Missing IMS client ID | Preview URLs cannot authenticate — use DA |

### First load

- Shows **Loading Content Operation Hub…**
- Resolves **org**, **site**, and **ref** (branch) from the DA app URL
- Auto-loads content at the site root (or at `?path=` / `?ref=` if present in the URL)
- On JS failure: **Content Operation Hub failed to start** — hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) after deploy

---

## Interface overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: title, description, org / site / ref badges                 │
├──────────────────────────────────────────────────────────────────────┤
│  Site content                                                        │
│  ┌─────────────────────┬────────────────────────────────────────────┐│
│  │ Directories         │ Pages                                      ││
│  │  breadcrumb         │  path subtitle · scope · page count        ││
│  │  folder search      │  page count                                ││
│  │  folder list        │  status summary · search/filter · legend   ││
│  │                     │  page list (Name · Modified · DA · dot)    ││
│  └─────────────────────┴────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
     [ Floating selection command bar when pages are selected ]
```

### Header

| Element | Content |
|---------|---------|
| Eyebrow | Adobe Experience Manager · Edge Delivery |
| Title | **Content Operation Hub** |
| Description | Browse folders, select pages, and run bulk preview, publish, or removal at the current directory level. |
| Badges | Current **org**, **site**, and **ref** (branch) |

The app uses a **fixed viewport height** — the page list scrolls internally; the window does not grow when you select pages or open operations.

---

## Navigation and content loading

Content loads automatically. There is no separate **Fetch** button.

| Action | What happens |
|--------|----------------|
| **First open** | Lists folders and pages at site root (or `?path=`) |
| **Click a folder** | Navigates deeper, updates URL `?path=`, reloads content |
| **Breadcrumb segment** | Jump to ancestor folder |
| **Include all subdirectories** | Switches page scope and reloads (see [Pages panel](#pages-panel)) |

### URL sync

- `?path=` — current folder path (normalized; app route treated as site root)
- `?ref=` — branch override when not `main`

### What resets on navigation

| State | Folder navigation | Scope change |
|-------|-------------------|--------------|
| Page selection | Kept for paths still in the new list | Cleared on refetch |
| Deployment status | Cleared (auto-refetches when pages load) | Cleared (auto-refetches) |
| Page filter | Reset to **All pages** | Reset to **All pages** |
| Search queries | Cleared | Cleared |

---

## Folders (Directories)

Left column when subfolders exist or you are inside a subfolder.

| Feature | Details |
|---------|---------|
| **Section title** | Directories + folder count |
| **Breadcrumb** | **Site root** plus clickable segments (`›` separators). Current segment is plain text. Disabled while status is loading. |
| **Find a folder** | `#bulk-pp-folder-search` — minimum **3 characters** to filter. **Escape** clears search. |
| **Folder list** | AEM browse-style rows: folder icon + name. Click row or name to navigate. |

**Empty states**

- Type at least 3 characters to search.
- No folders match this search.
- No subfolders here — pages in this folder are listed on the right.

---

## Pages panel

Right column — main working area for the current folder scope.

### Pages header

| Element | ID / class | Purpose |
|---------|------------|---------|
| **Title** | — | Pages |
| **Path subtitle** | — | Current folder path or **Site root** |
| **Include all subdirectories** | `#bulk-pp-include-subdirectories` | **Off:** pages in this folder only. **On:** recursive list under the folder (`pageScope: tree`). |
| **Page count** | `#bulk-pp-page-count` | Total pages, or **X of Y** when search/filter active |

### Controls row

| Element | ID | Purpose |
|---------|-----|---------|
| **Find a page** | `#bulk-pp-page-search` | Minimum **3 characters**; matches name and path |
| **Status summary** | `#bulk-pp-pages-summary` | Published / preview / not deployed / total counts |
| **Filter by status** | `#bulk-pp-page-filter` | Right-aligned, parallel to page search |
| **Status legend** | `#bulk-pp-pages-legend-row` | Color key above the page list |
| **Selection row** | — | Selection pill + **Select all** / **Clear** |

**Empty states**

- No pages in this scope.
- No pages match this search.
- No pages match this filter.
- No folders or pages in this location.

---

## Fetch deployment status

Deployment status answers: *Has this page been previewed on `.aem.page`? Published on `.aem.live`?*

### How it loads

Whenever pages load (folder navigation, scope change, or first open), deployment status is resolved **automatically** for all pages in the current list.

| Situation | Behavior |
|-----------|----------|
| **All pages cached** (localStorage) | Status appears instantly — no API call, no progress modal |
| **Some pages cached** | Cached rows show immediately; only missing pages are fetched (progress modal opens) |
| **Nothing cached** | Full fetch with progress modal |

Navigating or changing scope clears in-memory status, then rehydrates from **localStorage** before deciding what still needs to be fetched.

### localStorage cache

Per-page deployment status is stored in the browser under `bulk-pp-deployment-status-v1`, keyed by **org · site · ref · helix path**.

| Detail | Value |
|--------|-------|
| **TTL** | 7 days per path |
| **Cap** | 8,000 paths per site |
| **Written** | After each successful fetch, partial stop, or bulk preview/publish job |
| **Read** | On every folder open — avoids re-fetching when navigating back |

To force a fresh check for a folder, hard-refresh the tool or wait for entries to expire. Status changed outside this tool (e.g. directly in DA) may stay stale until cache expires or you revisit after a successful refetch.

### Progress modal

| Phase | Header title | Header actions |
|-------|--------------|----------------|
| In progress | **Fetching deployment status** | **Stop** |
| Complete | **Deployment status ready** | Stop removed — **Close** in body |
| Stopped | **Fetch stopped** | **Close** |
| Failed | **Fetch failed** | **Close** |

Progress shows **N of M pages checked (P%)** with a runtime ETA.

### Completion breakdown (modal + deployment panel)

| Stat | Label |
|------|-------|
| Live | **Published (live)** |
| Preview only | **Preview only** |
| None | **neither previewed nor published** |
| Total | **Total in view** |

### Classification rules

| Condition | Status | Dot color | Legend label |
|-----------|--------|-----------|--------------|
| `publishedAt` present | Published | Green `#15803d` | **Published** |
| Only `previewedAt` | Preview only | Amber `#b45309` | **Preview only** |
| Neither timestamp | Untouched | Red `#c9252d` | **Not previewed** |

Row tooltips: *Published*, *only previewed*, *not previewed*.

### While status is loading

- Cached pages show status immediately; remaining pages update as each is checked
- Summary grid and row dots fill in as results arrive
- Filter and legend stay available

### After a successful run

- `statusFetched` is true; results persisted to localStorage
- Summary, filter, legend, and row dots reflect full status
- **Modified** column on page rows shows latest preview/publish timestamp
- Partial results kept if you stop mid-fetch (also saved to localStorage)

### API behavior (summary)

- Pages checked in parallel batches of **10**, **120 ms** pause between batches
- For **≥ 3 pages**, bulk status API is used unless disabled via URL flags
- Per-page fallback when bulk mapping misses a path
- Rate limit (**429**): wait and navigate again or change scope to retry

---

## Pages status controls

Integrated into the Pages panel — no separate deployment card.

| Row | Content |
|-----|---------|
| **Summary** (`#bulk-pp-pages-summary`) | Published · Preview only · Not deployed · Total in view |
| **Toolbar** | **Find a page** (left) · **Filter by status** (right) |
| **Legend** | Color key, right-aligned above the list |

Summary counts update live while status is fetching. Filter and legend apply to the **current loaded list** (folder vs tree scope, search, and filter).

---

## Page list and browse UI

AEM Assets–style browse list:

| Column | Content |
|--------|---------|
| Checkbox | Page selection |
| Icon | Document (line art) |
| **Name** | Relative page path |
| **Modified** | Latest preview/publish date after status fetch (empty before fetch) |
| **DA** | Open in Document Authoring (single page) |
| Status dot | Deployment indicator |

- **48px row height**, light dividers, subtle hover
- Selected rows: light blue-gray background
- List scrolls inside the panel; at least **5 rows** visible in typical layouts

---

## Page selection

| Control | ID | Behavior |
|---------|-----|----------|
| **Select all** | `#bulk-pp-select-all` | Selects all **currently visible** pages (respects search/filter) |
| **Clear** | `#bulk-pp-select-none` | Clears all selection |
| Row checkbox | `.bulk-pp-page-cb` | Toggle individual pages |

### Selection pill (`#bulk-pp-selection-pill`)

Format: **`N selected out of M`** (M = total pages in current scope)

### Selection persistence

- **Folder navigation:** selection kept for paths that still exist in the new page list
- **Scope change / navigation reset:** selection and status may clear per rules above
- Bulk actions only affect paths in the **current loaded page list** that are selected

---

## Selection command bar

When one or more pages are selected, a **floating command bar** appears at the bottom of the viewport (magenta/pink theme). It overlays content and does not shrink the page list.

| Area | Content |
|------|---------|
| Left | Selection badge (count) · **Clear** |
| Right | **Preview** · **Publish** · **More** ▾ |

### More menu

| Group | Actions |
|-------|---------|
| **Remove** | Remove preview · Remove from live · **Delete from DA** (danger) |
| **Open** | Open in Document Authoring · Open preview site · Open live site |

Bar ID: `#bulk-pp-selection-bar`. Disabled while content loading, status check in progress (before first results), or a job modal is open.

---

## Bulk preview and publish

Triggered from the selection command bar: **Preview** or **Publish**.

| Action | Confirmation | Job modal title |
|--------|--------------|-----------------|
| **Preview** | **Preview selected pages?** → **Preview selected** | Running bulk preview on N pages |
| **Publish** | **Publish to production?** → **Publish to production** | Publishing N pages to production |

### After success

- Refreshes deployment status for affected paths
- Job complete modal shows summary and, for preview/publish:
  - **Copy URLs**
  - **Open all (N)** with tab confirmation
  - Clickable URL list

### Disabled when

- No pages selected
- Content or status loading (before status fetched)
- A bulk job modal is open

### Job completion

| Outcome | Modal title |
|---------|-------------|
| Preview success | **Preview complete** |
| Publish success | **Publish complete** |
| Failure | **Preview failed** / **Publish failed** |
| User stopped tracking | **Job stopped on screen** |

---

## Bulk removal and delete

From **More → Remove** on the selection command bar.

All destructive actions use a **two-step confirmation**:

1. **Keyword step** — type `unpreview`, `unpublish`, or `delete` exactly
2. **Final step** — *This cannot be undone* with a danger confirm button

| Action | Keyword | Final confirm |
|--------|---------|---------------|
| **Remove preview** | `unpreview` | **Yes, remove preview** |
| **Remove from live** | `unpublish` | **Yes, unpublish** |
| **Delete from DA** | `delete` | **Yes, delete permanently** |

### Delete from DA (3-step pipeline)

Permanent removal. Runs in order:

| Step | Label | Action |
|------|-------|--------|
| 1 | Step 1 of 3 · Unpreview | Bulk preview removal job |
| 2 | Step 2 of 3 · Unpublish | Bulk live removal job |
| 3 | Step 3 of 3 · Delete from DA | Sequential `DELETE` on `admin.da.live/source/…` |

- Successfully deleted pages are removed from the UI list and selection
- Job complete modal does **not** include preview/live URLs for destructive operations

---

## Open URLs and Document Authoring

### From selection command bar → More → Open

| Action | Opens |
|--------|-------|
| **Open in Document Authoring** | DA edit URLs for all selected pages |
| **Open preview site** | `{ref}--{site}--{org}.aem.page` |
| **Open live site** | `{ref}--{site}--{org}.aem.live` |

### From job complete modal (preview/publish)

- **Copy URLs** — newline-separated list
- **Open all (N)** — same tab confirmation flow as bulk open

### Open confirmation

**Open URLs in new tabs?**

- **Open N tab(s)** / **Cancel**
- Warning at ≥ 5 tabs (browser limits)
- Stronger warning at ≥ 20 tabs (popup blockers)

### Popup blocked

> Your browser blocked new tabs. Allow pop-ups for this site, or use **Copy URLs** in the job complete modal.

---

## Modals and confirmations

### Standard confirm modal

Used for preview, publish, open tabs, and destructive final step.

- **Escape** or backdrop click → cancel
- Warning variant shows **!** icon

### Keyword destructive modal (step 1)

| Action | Title |
|--------|-------|
| Remove preview | Remove preview for selected pages? |
| Remove from live | Unpublish selected pages from production? |
| Delete | Delete selected pages from Document Authoring? |

- Input: **Type {keyword} to continue**
- **Continue to confirmation** disabled until keyword matches (case-insensitive)

### Progress modals

Shared layout: title, stop button (jobs and status fetch only while running), intro, progress bar, ETA.

**Job stop labels:** Cancel job · Cancel unpreview · Cancel unpublish · Cancel delete

---

## Cancel and stop behavior

> **Important:** Cancel / Stop controls **client-side tracking only**. Work already accepted by AEM Admin or DA may continue on the server.

### Stop (deployment status fetch)

- Aborts in-flight status requests via `AbortController`
- **Partial results kept** if any pages were already checked
- Stop button **removed** from header when fetch completes, fails, or is stopped

### Cancel job

- Stops UI polling and closes tracking
- Server job may still run to completion

### Navigation during status

- Changing folders or scope cancels status and clears deployment display

---

## Per-row actions

Each page row includes:

| Element | Behavior |
|---------|----------|
| **Checkbox** | Add/remove from selection |
| **Label** (relative path) | Clicking focuses the checkbox |
| **DA** | Open single page in Document Authoring |
| **Status dot** | Visual indicator; `aria-label` from status |

### DA button rules

| Selection count | DA button |
|-----------------|-----------|
| 2+ selected | Disabled — use **More → Open in Document Authoring** |
| 1 selected | Works for that row |
| Status loading (no results yet) | Disabled |

Tooltip when disabled (multi-select): *Use More → Open in Document Authoring when multiple pages are selected*

---

## Status legend and filters

### Legend (in deployment panel)

| Dot | Label |
|-----|-------|
| Red | Not previewed |
| Amber | Preview only |
| Green | Published |

### Filter by status (`#bulk-pp-page-filter`)

| Value | Label |
|-------|-------|
| `all` | All pages |
| `never-previewed` | Never previewed |
| `never-published` | Never published |
| `recent-preview` | Recently previewed |
| `recent-publish` | Recently published |
| `oldest-preview` | Oldest previewed |
| `oldest-publish` | Oldest published |

**Notes**

- Locked until deployment status is fetched
- Date-based filters sort by `previewedAt` / `publishedAt`
- Changing folder, scope, or turning status off resets filter to **All pages**

---

## URL parameters and debug

| Parameter | Effect |
|-----------|--------|
| `ref` | Branch override (default from DA context, usually `main`) |
| `path` | Initial folder path |
| `debug` | Log bulk status failures; show job JSON in error UI |
| `hardcodeIndex` | Test mode: only index page gets real status |
| `bulkStatus` | Force bulk status API |
| `noBulk` / `noBulkStatus` | Disable bulk status API |

Example: `?path=/who-we-are&ref=feature-branch`

---

## Technical reference

### Source layout

```
tools/bulk-preview-publish/
├── index.html              # Primary entry
├── bulk-preview-publish.js # App shell, render, handlers
├── bulk-preview-publish.css
├── WIKI.md                 # This document
└── lib/
    ├── api.js              # DA list, bulk jobs, status, delete, auth messages
    ├── modal.js            # Confirm & keyword modals
    ├── progress-modal.js   # Status & job progress UI
    ├── search-ui.js        # Search fields & row patches
    ├── page-history.js     # Status classification & filters
    ├── paths.js            # Path normalization & DA delete paths
    ├── urls.js             # Preview/live/DA URL builders
    ├── state.js            # App state factory & search helpers
    ├── status-estimate.js  # ETA formatting
    ├── status-cache.js     # Platform status cache
    ├── dom.js              # DOM helpers
    └── ui-utils.js         # Clipboard, button feedback, tab open
```

### SDK and authentication

- Dynamic import: `https://da.live/nx/utils/sdk.js` (8 s timeout)
- `wrapDaFetch()` passes through SDK fetch for Admin API calls
- Auth message constants: `DA_AUTH_CONTEXT_MESSAGE`, `DA_LOGIN_REQUIRED_MESSAGE`, `DA_SITE_CONTEXT_MESSAGE`
- `isDaAccessError()` drives the structured sign-in panel in the content area

### API hosts

| Host | Usage |
|------|-------|
| `https://admin.da.live` | List folders/pages, delete source documents |
| `https://admin.hlx.page` | Preview, live, status, and job polling |

### What counts as a “page”

- Document entries (`index`, section pages, etc.)
- **Excluded:** data/config files (`metadata`, `json`, spreadsheets, etc.)
- Homepage paths normalize `/index` ↔ `/`

### Job polling

- Up to **60** polls × **2 s** interval
- Terminal states: `stopped`, `succeeded`, `failed`, `cancelled`, `timeout`
- Timeout message: *timed out — check job status in DA*
- Async forced when **> 5 paths** or delete operations

### Status refresh after tool jobs

After preview, publish, or destructive jobs initiated by this tool, status is refreshed for affected paths via `fetchPlatformStatusForPaths`. Status does **not** auto-refresh when preview/publish happens outside this tool (e.g. directly in DA).

---

## Limitations and troubleshooting

| Issue | Cause / mitigation |
|-------|-------------------|
| Tool won’t start | Sign in at [da.live](https://da.live) and open from Apps, not a preview URL. Hard refresh after deploy. |
| Auth / IMS errors | Use the sign-in panel steps; open from `da.live/app/{org}/{site}`. |
| Buttons disabled | Wait for content/status/job to finish; select at least one page. |
| DA row button disabled | Select only one page, or use **More → Open in Document Authoring**. |
| Command bar missing | Select at least one page in the list. |
| Popup blocker | Allow pop-ups; use **Copy URLs** in job complete modal. |
| Status slow on large trees | Use folder-only scope; stop fetch — partial results kept. |
| 429 rate limit | Wait and reload the folder (navigate away and back) to retry. |
| Stop didn’t undo work | Expected — server jobs continue; modal explains this. |
| Delete partial failure | Per-path errors reported (up to 3 samples in UI). |
| External DA preview/publish | Cached status may be stale for up to 7 days; hard-refresh or wait for cache expiry. |

### Boot and content errors

| Message | Meaning |
|---------|---------|
| Content Operation Hub failed to start | JS init error — check console, hard refresh |
| Sign in to Document Authoring | Opened outside DA — follow panel steps |
| No folders or pages in this location. | Empty folder or invalid path |
| Fetching content… | Content list in progress |

### Deploy note

After pushing code changes, users must hard refresh the DA tool URL (`Cmd+Shift+R` / `Ctrl+Shift+R`) to bypass cached assets.

---

## Quick workflow reference

### Preview several pages

1. Navigate to the folder (breadcrumb or Directories list) — deployment status loads automatically
2. **Select all** or pick checkboxes
4. **Preview** on the command bar → confirm
5. Use **Copy URLs** or **Open all** in the complete modal

### Publish to production

1. Select pages → **Publish** on the command bar
2. Confirm **Publish to production**
3. Wait for job modal → copy or open live URLs from complete modal

### Check deployment status only

1. Navigate to the folder — status fetch starts automatically
2. Wait for **Deployment status ready** (or use partial results while loading)
3. Use filter, legend, summary, and row dots to review

### Remove preview only

1. Select pages → **More → Remove preview**
2. Type `unpreview` → **Yes, remove preview**

### Fully delete from DA

1. Select pages → **More → Delete from DA**
2. Type `delete` → **Yes, delete permanently**
3. Monitor 3-step progress (unpreview → unpublish → DA source delete)

---

*Last updated for Content Operation Hub (`tools/bulk-preview-publish`). Technical slug and paths remain `bulk-preview-publish` for backward compatibility.*
