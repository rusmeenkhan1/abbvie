# Content Operations Hub — Wiki

Bulk workspace for **AEM Edge Delivery** inside **Adobe Document Authoring (DA)**. Browse folders, check preview/publish status, and run bulk operations without opening pages one by one.

| | |
|---|---|
| **Display name** | Content Operations Hub |
| **Technical slug** | `bulk-preview-publish` |
| **Entry points** | `tools/bulk-preview-publish/index.html` · `tools/bulk-preview-publish.html` |
| **Requires** | DA session + SDK (`daFetch` / IMS) |

---

## Why it's useful

- **One place for bulk work** — preview, publish, unpreview, unpublish, or delete many pages from the current folder (or entire subtree).
- **See deployment state at a glance** — which pages are on `.aem.page` (preview) vs `.aem.live` (live), with counts and color-coded rows.
- **Faster than DA alone** — multi-select, filters, search, and a command bar replace repetitive per-page actions.
- **Safe destructive flows** — keyword confirmations before remove/delete; progress tracking for jobs.
- **Remembers status locally** — revisiting folders is instant; background refresh picks up changes made elsewhere in DA.
- **Shareable context** — URL keeps `?path=` and `?ref=` so you can bookmark or return to the same folder/branch.

---

## Setup

### 1. Register the tool in DA Apps

Add the tool path in your site’s DA Apps configuration:

```
tools/bulk-preview-publish
```

### 2. Open from Document Authoring

1. Sign in at [https://da.live](https://da.live) (use **Sign in** top-right if needed).
2. Open your site: `https://da.live/app/{org}/{site}/`
3. Launch **Content Operations Hub** from the Apps / tools menu.

### 3. Verify context

Header badges (left → right): **branch** · **repository** · **organization**.  
The tool must run inside DA — preview/live site URLs and local files cannot authenticate.

### 4. After code deploy

Users should **hard refresh** the tool (`Cmd+Shift+R` / `Ctrl+Shift+R`) so DA loads the latest JS/CSS.

### Auth issues

| Problem | Fix |
|---------|-----|
| Sign-in panel | Sign in top-right in DA, reload the tool |
| Missing org/site | Open from your site app URL, not a standalone link |
| Tool won’t start | Hard refresh; check browser console |

---

## Features

| Feature | What it does |
|---------|----------------|
| **Folder browsing** | Directories column with breadcrumb, search, AEM-style folder list |
| **Auto page listing** | Pages load on open and folder change — no Fetch button |
| **Pages breadcrumb** | Same path navigation in the Pages column |
| **Subdirectory scope** | **Include all subdirectories** — current folder only vs full tree |
| **Deployment status** | Auto-check preview/publish per page; summary strip in Pages header |
| **First-load experience** | Single **Fetching content…** screen until folders, pages, and deployment status are ready |
| **Status progress bar** | Inline bar above Pages with Stop on **folder changes** only (not on first open) |
| **Smart cache** | `localStorage` per path; instant revisit + silent background refresh |
| **Search** | **Search folder** / **Search page** inputs (3-char minimum, not shown in UI) |
| **Status filter** | Filter by published, preview-only, never previewed, date sorts, etc. |
| **Status legend** | Red / amber / green key above the page list |
| **Multi-select** | Row checkboxes, **Select all**, **Clear**, selection pill |
| **Command bar** | Floating **Preview** · **Publish** · **More** when pages are selected |
| **Bulk preview** | Preview many pages; job modal; copy/open URLs when done |
| **Bulk publish** | Publish to production; job modal; copy/open live URLs |
| **Remove preview** | Bulk unpreview with keyword confirm |
| **Unpublish** | Bulk remove from live with keyword confirm |
| **Delete from DA** | Unpreview → unpublish → delete source (3-step pipeline) |
| **Open URLs** | DA editor, preview site (`.aem.page`), live site (`.aem.live`) |
| **Per-row DA** | Open single page in Document Authoring |
| **URL sync** | `?path=` folder, `?ref=` branch in the address bar |
| **Debug flags** | `?debug`, `?bulkStatus`, `?noBulkStatus`, etc. |

---

## Table of contents

1. [Interface](#interface)
2. [Navigation](#navigation)
3. [Deployment status](#deployment-status)
4. [Selection & command bar](#selection--command-bar)
5. [Bulk operations](#bulk-operations)
6. [Filters & legend](#filters--legend)
7. [URL parameters](#url-parameters)
8. [Technical reference](#technical-reference)
9. [Troubleshooting](#troubleshooting)
10. [Quick workflows](#quick-workflows)

---

## Interface

```
┌ Header: title · branch · repository · organization ────────────────┐
├ Site content ──────────────────────────────────────────────────────┤
│ Directories          │ Pages                                       │
│  breadcrumb          │  [status fetch progress bar when active]    │
│  search folder       │  title · breadcrumb · scope · summary      │
│  folder list         │  search page · filter · legend · selection   │
│                      │  page list (Name · Modified · DA · dot)     │
└──────────────────────┴─────────────────────────────────────────────┘
        [ Selection command bar when pages are selected ]
```

- Fixed viewport — lists scroll inside panels.
- On **first open**, one centered loader covers content + status (no progress bar flash).
- On **folder changes**, the inline progress bar appears and the workspace **blurs** until status completes.

---

## Navigation

| Action | Result |
|--------|--------|
| Click folder | Go deeper; `?path=` updates |
| Breadcrumb | Jump to ancestor (Directories or Pages) |
| **Include all subdirectories** | Reload pages for folder-only or full tree |
| First open | Load site root (or `?path=` / `?ref=` from URL) |

**Resets on navigation:** search, filter (→ All pages), status (reloaded from cache + API).  
**Selection:** kept when changing folders if paths still exist; cleared on scope change.

---

## Deployment status

Shows whether each page was previewed or published.

### Load behavior

| Case | Behavior |
|------|----------|
| First open | **Fetching content…** until deployment status is ready (no progress bar, no misleading dots) |
| Folder change after first visit | Inline progress bar; workspace locked until fetch completes |
| Full cache | Instant summary/dots; background API refresh (no lock) |
| Stop | Partial results kept; saved to cache |

### Summary (Pages header, top-right)

**Published** · **Preview only** · **Not deployed** · **Total in view**

### Row indicators

| Dot | Meaning |
|-----|---------|
| Green | Published (live) |
| Amber | Preview only |
| Red | Not previewed |

### Cache (`bulk-pp-deployment-status-v1`)

- Key: org · site · ref · helix path  
- TTL: 7 days · cap: 8,000 paths/site  
- External DA changes: usually corrected on next folder open via background refresh  

---

## Selection & command bar

- **Select all** — visible rows only (respects search + filter).  
- **Clear** — clear selection.  
- Command bar appears when ≥1 page selected.  
- Disabled during content load, active status fetch, or open job modal.

**More menu:** Remove from preview · Remove from publish · Delete from DA · Open in DA · Open preview URLs (.page) · Open publish URLs (.live).

---

## Bulk operations

### Preview / Publish

1. Select pages → **Preview** or **Publish** on command bar.  
2. Confirm → job progress modal.  
3. On success: status refresh + **Copy URLs** / **Open all**.

### Remove / Delete

Two steps: type keyword (`unpreview` / `unpublish` / `delete`), then confirm.

**Delete from DA:** unpreview job → unpublish job → sequential source delete.

> Stop/Cancel ends UI tracking only — server jobs may still run.

---

## Filters & legend

**Filter** (`#bulk-pp-page-filter`): All pages · Never previewed · Never published · Recently/oldest previewed or published.

**Legend:** Not previewed · Preview only · Published — always available; not gated on status fetch.

---

## URL parameters

| Param | Effect |
|-------|--------|
| `path` | Initial folder |
| `ref` | Branch override |
| `debug` | Verbose errors / job JSON in UI |
| `bulkStatus` | Force bulk status API |
| `noBulk` / `noBulkStatus` | Disable bulk status API |
| `hardcodeIndex` | Test: only index gets real status |

Example: `?path=/who-we-are&ref=main`

---

## Technical reference

```
tools/bulk-preview-publish/
├── index.html
├── bulk-preview-publish.js
├── bulk-preview-publish.css
└── lib/
    ├── api.js           # list, jobs, status, delete, auth
    ├── progress-modal.js
    ├── status-cache.js  # localStorage
    ├── page-history.js  # filters & classification
    ├── search-ui.js
    └── …
```

| Host | Use |
|------|-----|
| `admin.da.live` | Folders, pages, delete source |
| `admin.hlx.page` | Preview, live, status, jobs |

- SDK: `https://da.live/nx/utils/sdk.js`  
- Pages only (not `metadata`, spreadsheets, etc.)  
- Status fetch: bulk POST with explicit paths (sync for &lt;10 pages) → per-page fallback via 10-worker pool (status GET only on small sets)  
- Job poll: 60 × 2s max; async when >5 paths or delete  

---

## Troubleshooting

| Issue | Mitigation |
|-------|------------|
| Old UI after deploy | Hard refresh |
| Buttons disabled | Wait for status/job; select pages |
| Status slow (large tree) | Folder-only scope; Stop keeps partial results |
| 429 rate limit | Wait; navigate away and back |
| Popup blocker | Allow pop-ups or **Copy URLs** |
| Stale status after DA edit | Reopen folder; wait for background refresh |

| Message | Meaning |
|---------|---------|
| Content Operations Hub failed to start | JS error — console + hard refresh |
| Sign in required | Not authenticated in DA |
| Fetching content… | Loading folder/page list |

---

## Quick workflows

**Preview pages** — Open folder → select → **Preview** → confirm → copy/open URLs.

**Publish** — Select → **Publish** → confirm → wait for job modal.

**Review status** — Open folder; read summary + dots; use filter/legend.

**Remove preview** — Select → **More → Remove preview** → `unpreview` → confirm.

**Delete** — Select → **More → Delete from DA** → `delete` → confirm → watch 3-step progress.

---

*Content Operations Hub · `tools/bulk-preview-publish`*
