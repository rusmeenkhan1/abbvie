# Content Operations Hub — Wiki

**Content Operations Hub** is an enterprise workspace inside **Adobe Document Authoring (DA)** for AEM Edge Delivery. Browse site folders, inspect deployment status, and run bulk preview, publish, removal, and delete operations from one place.

| | |
|---|---|
| **Display name** | Content Operations Hub |
| **Technical slug** | `bulk-preview-publish` (folder and URL path unchanged for compatibility) |
| **Entry points** | `tools/bulk-preview-publish/index.html` · `tools/bulk-preview-publish.html` |
| **Requires** | Document Authoring — Adobe IMS authentication via the DA SDK |

---

## Features

### Folder browsing
Navigate the site tree with breadcrumbs, folder search, and AEM-style browse lists. Click any folder to drill down; the URL updates with `?path=` so you can bookmark or share a location.

### Automatic page listing
Pages in the current folder load automatically when you open the tool or change folders. No separate **Fetch** button — content appears as soon as you navigate.

### Subdirectory scope
Toggle **Include all subdirectories** to list pages only in the current folder, or recursively across the entire subtree. Useful for bulk work on a branch of the site without clicking into every folder.

### Deployment status
See whether each page has been previewed (`.aem.page`) or published (`.aem.live`). Status loads automatically whenever pages appear. A summary strip (Published · Preview only · Not deployed · Total) sits in the Pages header; each row shows a color dot and last modified timestamp.

### Smart status cache
Per-page status is stored in **localStorage** for fast back-and-forth navigation. Cached data shows instantly; the tool then **silently refreshes** from the API in the background so changes made directly in DA are picked up without blocking the UI.

### Search and filter
Search folders and pages by name (minimum 3 characters). Filter the page list by deployment state — never previewed, recently published, oldest previewed, and more. Filters work on the currently loaded page set.

### Multi-select and bulk actions
Select individual pages, **Select all** visible results, or **Clear** selection. A floating command bar appears when pages are selected with one-click **Preview** and **Publish**, plus a **More** menu for removal and open actions.

### Bulk preview and publish
Run preview or publish jobs on many pages at once. Progress is tracked in a modal with ETA. On success, copy or open preview/live URLs from the completion dialog.

### Bulk removal and delete
Remove preview, unpublish from live, or permanently delete pages from DA. Destructive actions use a two-step keyword confirmation (`unpreview`, `unpublish`, `delete`). Full delete runs a three-step pipeline: unpreview → unpublish → DA source delete.

### Open in Document Authoring and environments
Open selected pages in DA, on the preview site, or on the live site. Per-row **DA** buttons work for a single page; multi-select uses **More → Open**. Tab-open confirmations warn about popup blockers on large selections.

### Progress and safety modals
Status fetch and bulk jobs show progress with **Stop** / **Cancel** controls. Confirmations protect preview, publish, open-tabs, and destructive workflows. Stop cancels client-side tracking only — server work may continue.

### URL sync and debug
Folder path and branch (`ref`) sync to the browser URL. Debug query flags are available for bulk status API testing and troubleshooting.

---

## Table of contents

1. [Getting started](#getting-started)
2. [Interface overview](#interface-overview)
3. [Navigation and content loading](#navigation-and-content-loading)
4. [Folders (Directories)](#folders-directories)
5. [Pages panel](#pages-panel)
6. [Deployment status](#deployment-status)
7. [Page list](#page-list)
8. [Page selection](#page-selection)
9. [Selection command bar](#selection-command-bar)
10. [Bulk preview and publish](#bulk-preview-and-publish)
11. [Bulk removal and delete](#bulk-removal-and-delete)
12. [Open URLs and Document Authoring](#open-urls-and-document-authoring)
13. [Modals and confirmations](#modals-and-confirmations)
14. [Cancel and stop behavior](#cancel-and-stop-behavior)
15. [Per-row actions](#per-row-actions)
16. [Status legend and filters](#status-legend-and-filters)
17. [URL parameters and debug](#url-parameters-and-debug)
18. [Technical reference](#technical-reference)
19. [Limitations and troubleshooting](#limitations-and-troubleshooting)
20. [Quick workflows](#quick-workflows)

---

## Getting started

### How to open the tool

1. Sign in to **Document Authoring** at [https://da.live](https://da.live).
2. Open your site app: `https://da.live/app/{org}/{site}/…`
3. Launch **Content Operations Hub** from the DA Apps menu (register the tool path `tools/bulk-preview-publish` in your DA Apps configuration).

The tool **cannot authenticate** when opened on `.aem.page` / `.aem.live` preview URLs or as a local file. It needs the DA SDK (`https://da.live/nx/utils/sdk.js`), which provides `daFetch` with Bearer tokens for AEM Admin APIs.

### Authentication errors

If you are not signed in, a centered panel appears:

- **Title:** Sign in required
- **Message:** Sign in using the button in the top right, then reload this tool.

No duplicate error banner is shown at the bottom of the screen.

| Situation | What to do |
|-----------|------------|
| SDK / `daFetch` unavailable | Sign in via the top-right button in DA, reload |
| Missing org or site | Open from your site app in DA |
| 401 / not signed in | Sign in via the top-right button, reload |

### First load

- Shows **Loading Content Operations Hub…**
- Resolves **org**, **site**, and **ref** (branch) from the DA app URL
- Auto-loads content at the site root (or at `?path=` / `?ref=` if present)
- On JS failure: **Content Operations Hub failed to start** — hard refresh after deploy

---

## Interface overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: title, description, org / site / ref badges                 │
├──────────────────────────────────────────────────────────────────────┤
│  Site content                                                        │
│  ┌─────────────────────┬────────────────────────────────────────────┐│
│  │ Directories         │ Pages                                      ││
│  │  breadcrumb         │  title · path · scope    [status summary]  ││
│  │  folder search      │  search · filter · legend · selection      ││
│  │  folder list        │  page list (Name · Modified · DA · dot)    ││
│  └─────────────────────┴────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
     [ Floating selection command bar when pages are selected ]
```

### Header

| Element | Content |
|---------|---------|
| Eyebrow | Adobe Experience Manager · Edge Delivery |
| Title | **Content Operations Hub** |
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
| **Include all subdirectories** | Switches page scope and reloads |

### URL sync

- `?path=` — current folder path (normalized; app route treated as site root)
- `?ref=` — branch override when not `main`

### What resets on navigation

| State | Folder navigation | Scope change |
|-------|-------------------|--------------|
| Page selection | Kept for paths still in the new list | Cleared on refetch |
| Deployment status | Cleared, then reloaded (cache + API) | Cleared, then reloaded |
| Page filter | Reset to **All pages** | Reset to **All pages** |
| Search queries | Cleared | Cleared |

---

## Folders (Directories)

Left column when subfolders exist or you are inside a subfolder.

| Feature | Details |
|---------|---------|
| **Section title** | Directories + folder count |
| **Breadcrumb** | **Site root** plus clickable segments (`›`). Current segment is plain text. Disabled while status is loading. |
| **Find a folder** | `#bulk-pp-folder-search` — minimum **3 characters** to filter. **Escape** clears search. |
| **Folder list** | AEM browse-style rows: folder icon + name. Click to navigate. |

**Empty states:** no subfolders, no search matches, or type at least 3 characters to search.

---

## Pages panel

Right column — main working area for the current folder scope.

### Pages header (merged with status summary)

| Element | ID | Purpose |
|---------|-----|---------|
| **Title** | — | Pages |
| **Path subtitle** | — | Current folder path or **Site root** |
| **Include all subdirectories** | `#bulk-pp-include-subdirectories` | **Off:** this folder only. **On:** recursive tree (`pageScope: tree`). |
| **Status summary** | `#bulk-pp-pages-summary` | Top-right: Published · Preview only · Not deployed · Total in view |

When no pages exist in scope, the summary is hidden and a simple count badge is shown instead.

### Controls

| Element | ID | Purpose |
|---------|-----|---------|
| **Find a page** | `#bulk-pp-page-search` | Minimum **3 characters**; matches name and path |
| **Filter by status** | `#bulk-pp-page-filter` | Right-aligned, parallel to page search |
| **Status legend** | `#bulk-pp-pages-legend-row` | Color key above the list |
| **Selection row** | — | `N selected out of M` · **Select all** · **Clear** |

**Empty states:** no pages in scope, no search matches, no filter matches, or empty folder.

---

## Deployment status

Answers: *Has this page been previewed on `.aem.page`? Published on `.aem.live`?*

### How it loads

Whenever pages load (folder navigation, scope change, or first open), status is resolved **automatically**.

| Situation | Behavior |
|-----------|----------|
| **First open in session** | Content appears first; status loads inline (**Checking deployment status…**) — no blocking modal |
| **All pages cached** | Cached status appears instantly, then **silently re-fetches** in the background (no modal) |
| **Some pages cached** (after first load) | Cached rows show immediately; missing pages fetched (progress modal on folder change) |
| **Nothing cached** (after first load) | Full fetch with progress modal when navigating folders |

Navigating clears in-memory status, rehydrates from **localStorage**, then fetches anything still missing. A full cache hit still triggers a **background refresh** so preview/publish done directly in DA is usually reflected within a few seconds.

### localStorage cache

Stored under `bulk-pp-deployment-status-v1`, keyed by **org · site · ref · helix path**.

| Detail | Value |
|--------|-------|
| **TTL** | 7 days per path |
| **Cap** | 8,000 paths per site |
| **Written** | After successful fetch, partial stop, bulk jobs from this tool |
| **Read** | On every folder open |

If background refresh fails (offline, rate limit), cached values are kept until the next successful fetch.

### Progress modal

Shown only when pages still need to be fetched from the API (not for silent background refresh).

| Phase | Header title | Actions |
|-------|--------------|---------|
| In progress | **Fetching deployment status** | **Stop** |
| Complete | **Deployment status ready** | **Close** |
| Stopped | **Fetch stopped** | **Close** |
| Failed | **Fetch failed** | **Close** |

Progress shows **N of M pages checked (P%)** with a runtime ETA.

### Classification

| Condition | Status | Dot | Legend |
|-----------|--------|-----|--------|
| `publishedAt` present | Published | Green `#15803d` | **Published** |
| Only `previewedAt` | Preview only | Amber `#b45309` | **Preview only** |
| Neither timestamp | Untouched | Red `#c9252d` | **Not previewed** |

While loading, cached pages show status immediately; others update as checked. A subtle **Refreshing status…** or **Updating status…** hint may appear in the legend row.

### API behavior

- Parallel batches of **10** pages, **120 ms** pause between batches
- Bulk status API for **≥ 3 pages** unless disabled via URL flags
- Per-page fallback when bulk mapping misses a path

---

## Page list

AEM browse-style list:

| Column | Content |
|--------|---------|
| Checkbox | Page selection |
| Icon | Document |
| **Name** | Relative page path |
| **Modified** | Latest preview/publish date (after status load) |
| **DA** | Open in Document Authoring (single page) |
| Status dot | Deployment indicator |

- **48px** row height, light dividers, subtle hover
- Selected rows: light blue-gray background
- List scrolls inside the panel; at least **5 rows** visible in typical layouts

---

## Page selection

| Control | ID | Behavior |
|---------|-----|----------|
| **Select all** | `#bulk-pp-select-all` | All **currently visible** pages (respects search/filter) |
| **Clear** | `#bulk-pp-select-none` | Clears selection |
| Row checkbox | `.bulk-pp-page-cb` | Toggle individual pages |

**Selection pill** (`#bulk-pp-selection-pill`): **`N selected out of M`**

- **Folder navigation:** selection kept for paths still in the new list
- **Scope change:** selection cleared on refetch
- Bulk actions only affect selected paths in the **current loaded list**

---

## Selection command bar

Floating bar at the bottom when pages are selected (magenta/pink theme). Overlays content without shrinking the list.

| Area | Content |
|------|---------|
| Left | Selection badge · **Clear** |
| Right | **Preview** · **Publish** · **More** ▾ |

### More menu

| Group | Actions |
|-------|---------|
| **Remove** | Remove preview · Remove from live · **Delete from DA** (danger) |
| **Open** | Open in Document Authoring · Open preview site · Open live site |

Bar ID: `#bulk-pp-selection-bar`. Disabled during content load, status fetch (before first results), or an open job modal.

---

## Bulk preview and publish

From the command bar: **Preview** or **Publish**.

| Action | Confirmation | Job modal |
|--------|--------------|-----------|
| **Preview** | **Preview selected pages?** | Running bulk preview on N pages |
| **Publish** | **Publish to production?** | Publishing N pages to production |

### After success

- Refreshes deployment status for affected paths
- Complete modal: **Copy URLs**, **Open all (N)**, clickable URL list

### Job outcomes

| Outcome | Modal title |
|---------|-------------|
| Preview success | **Preview complete** |
| Publish success | **Publish complete** |
| Failure | **Preview failed** / **Publish failed** |
| User stopped tracking | **Job stopped on screen** |

---

## Bulk removal and delete

From **More → Remove**. Two-step confirmation: type keyword, then confirm.

| Action | Keyword | Final confirm |
|--------|---------|---------------|
| **Remove preview** | `unpreview` | **Yes, remove preview** |
| **Remove from live** | `unpublish` | **Yes, unpublish** |
| **Delete from DA** | `delete` | **Yes, delete permanently** |

### Delete from DA (3-step pipeline)

| Step | Action |
|------|--------|
| 1 | Bulk unpreview job |
| 2 | Bulk unpublish job |
| 3 | Sequential `DELETE` on `admin.da.live/source/…` |

Deleted pages are removed from the UI list. Destructive complete modals do not include preview/live URLs.

---

## Open URLs and Document Authoring

### From More → Open

| Action | Opens |
|--------|-------|
| **Open in Document Authoring** | DA edit URLs for all selected pages |
| **Open preview site** | `{ref}--{site}--{org}.aem.page` |
| **Open live site** | `{ref}--{site}--{org}.aem.live` |

### From job complete modal

- **Copy URLs** — newline-separated list
- **Open all (N)** — tab confirmation (warnings at ≥ 5 and ≥ 20 tabs)

### Popup blocked

> Allow pop-ups for this site, or use **Copy URLs** in the job complete modal.

---

## Modals and confirmations

### Standard confirm

Used for preview, publish, open tabs, and destructive final step. **Escape** or backdrop → cancel.

### Keyword destructive modal (step 1)

Type `unpreview`, `unpublish`, or `delete` (case-insensitive) before the final danger confirm.

### Progress modals

Shared layout: title, stop/cancel while running, progress bar, ETA. Job stop labels: Cancel job · Cancel unpreview · Cancel unpublish · Cancel delete.

---

## Cancel and stop behavior

> **Important:** Stop / Cancel ends **client-side tracking only**. Server jobs may continue.

| Control | Effect |
|---------|--------|
| **Stop** (status fetch) | Aborts requests; partial results kept and saved to cache |
| **Cancel job** | Stops UI polling; server may still complete |
| **Navigate away** | Cancels status fetch and background refresh |

---

## Per-row actions

| Element | Behavior |
|---------|----------|
| **Checkbox** | Add/remove from selection |
| **Label** | Relative path; focuses checkbox |
| **DA** | Open single page in Document Authoring |
| **Status dot** | Visual indicator with `aria-label` |

| Selection count | DA button |
|-----------------|-----------|
| 2+ selected | Disabled — use **More → Open in Document Authoring** |
| 1 selected | Enabled for that row |
| Status loading (no results yet) | Disabled |

---

## Status legend and filters

### Legend (`#bulk-pp-pages-legend-row`)

| Dot | Label |
|-----|-------|
| Red | Not previewed |
| Amber | Preview only |
| Green | Published |

### Filter (`#bulk-pp-page-filter`)

| Value | Label |
|-------|-------|
| `all` | All pages |
| `never-previewed` | Never previewed |
| `never-published` | Never published |
| `recent-preview` | Recently previewed |
| `recent-publish` | Recently published |
| `oldest-preview` | Oldest previewed |
| `oldest-publish` | Oldest published |

Filters apply to the current loaded list (folder vs tree scope). Search further narrows visible rows. Filter is always available — not locked behind status fetch.

---

## URL parameters and debug

| Parameter | Effect |
|-----------|--------|
| `ref` | Branch override (default from DA context) |
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
├── index.html
├── bulk-preview-publish.js   # App shell, render, handlers
├── bulk-preview-publish.css
├── WIKI.md
└── lib/
    ├── api.js              # DA list, bulk jobs, status, delete, auth
    ├── modal.js            # Confirm & keyword modals
    ├── progress-modal.js   # Status & job progress UI
    ├── search-ui.js        # Search fields & row patches
    ├── page-history.js     # Status classification & filters
    ├── paths.js            # Path normalization
    ├── urls.js             # Preview/live/DA URL builders
    ├── state.js            # App state & helpers
    ├── status-cache.js     # localStorage deployment cache
    ├── status-estimate.js  # ETA formatting
    ├── dom.js
    └── ui-utils.js         # Clipboard, tabs, button feedback
```

### SDK and API

- SDK: `https://da.live/nx/utils/sdk.js` (8 s timeout)
- `admin.da.live` — list folders/pages, delete source documents
- `admin.hlx.page` — preview, live, status, job polling

### Pages vs files

Document entries (pages) are listed; data/config files (`metadata`, `json`, spreadsheets, etc.) are excluded. Homepage paths normalize `/index` ↔ `/`.

### Job polling

Up to **60** polls × **2 s**. Terminal: `stopped`, `succeeded`, `failed`, `cancelled`, `timeout`. Async forced when **> 5 paths** or for delete.

### Status refresh

- **From this tool:** status updated after preview, publish, and removal jobs
- **From DA directly:** picked up on next folder open via background revalidate
- **Cache key:** `bulk-pp-deployment-status-v1`

---

## Limitations and troubleshooting

| Issue | Mitigation |
|-------|------------|
| Tool won't start | Sign in at [da.live](https://da.live); open from Apps; hard refresh after deploy |
| Old UI after deploy | Hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`) — DA caches static assets |
| Auth / IMS errors | Follow sign-in panel; open from `da.live/app/{org}/{site}` |
| Buttons disabled | Wait for content/status/job; select at least one page |
| DA row button disabled | Select one page, or use **More → Open in Document Authoring** |
| Command bar missing | Select at least one page |
| Popup blocker | Allow pop-ups; use **Copy URLs** |
| Status slow on large trees | Use folder-only scope; stop fetch — partial results kept |
| 429 rate limit | Wait; navigate away and back to retry |
| Stop didn't undo work | Expected — server jobs continue |
| External DA changes | Background refresh on folder open; brief stale window if refresh fails |
| Delete partial failure | Per-path errors reported (up to 3 samples) |

### Boot messages

| Message | Meaning |
|---------|---------|
| Content Operations Hub failed to start | JS init error — console + hard refresh |
| Sign in to Document Authoring | Opened outside DA |
| No folders or pages in this location. | Empty or invalid path |
| Fetching content… | Content list in progress |

---

## Quick workflows

### Preview several pages

1. Navigate to the folder — status loads automatically
2. **Select all** or pick checkboxes
3. **Preview** on the command bar → confirm
4. **Copy URLs** or **Open all** in the complete modal

### Publish to production

1. Select pages → **Publish** → confirm
2. Wait for job modal → copy or open live URLs

### Review deployment status

1. Open a folder — summary appears top-right; dots fill in as status resolves
2. Use filter, legend, and row details to review

### Remove preview only

1. **More → Remove preview** → type `unpreview` → confirm

### Fully delete from DA

1. **More → Delete from DA** → type `delete` → confirm
2. Monitor 3-step progress (unpreview → unpublish → delete)

---

*Content Operations Hub · `tools/bulk-preview-publish` · technical slug `bulk-preview-publish` for backward compatibility.*
