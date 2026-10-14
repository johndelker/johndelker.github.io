# JSON-Driven Personal Site Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move editable personal-site copy and image paths into JSON and make navigation switch between Home and content views.

**Architecture:** Keep navigation and contact controls in `index.html`. Add `content.json` as the source of page content and `site.js` to fetch it, safely render structured text/link/list blocks, and switch views. Keep styling in the existing inline style block and leave attendance files untouched.

**Tech Stack:** HTML, CSS, vanilla JavaScript, JSON; no dependencies or build step.

**Spec:** `docs/superpowers/specs/2026-10-14-json-driven-site-content-design.md`

## Global Constraints

- Keep navigation labels/buttons and contact/social buttons in HTML.
- Leave the attendance tool and its Google Apps Script backend unchanged.
- Render content with DOM APIs and text nodes; create anchors from structured link data rather than injecting arbitrary HTML.
- Load the content JSON with `fetch`; local preview uses a static HTTP server.
- Keep static metadata fallbacks in `index.html` for crawlers that do not execute JavaScript; mirror their values from JSON.
- Home is first and selected initially; navigation switches views without changing the URL fragment.
- Keep the existing Home, Research, Software & Tools, Teaching & Outreach, and Other content.

## Review Focus

- Missing or invalid JSON: show a clear content-loading error in the main area.
- Content containing HTML-like text: display it as text; never interpret it as markup.
- Inline links with ampersands or punctuation: preserve the exact link text and URL.
- Missing image asset: retain useful alt text and avoid a broken layout where practical.
- Unknown navigation target: do not hide all content; retain the currently selected view.

---

### Task 1: Move page copy and image paths into JSON

**Files:**
- Create: `content.json`
- Reference: `docs/superpowers/specs/2026-10-14-json-driven-site-content-design.md`

**Interfaces:**
- Produces the data contract consumed by `site.js` in Task 2.
- Root keys: `meta` (`title`, `description`, `openGraphTitle`, `openGraphDescription`, `icon`), `home` (`title`, `subtitle`, `introduction`, `image`, `imageAlt`), `views` (array), `footerName`.
- Each `views` item has `id`, `title`, `blocks`; blocks are `paragraph` (`type`, `content`), `list` (`type`, `items`), or `card` (`type`, `heading`, `blocks` containing paragraphs/lists). Inline content may be plain strings or `{ "text": string, "href": string }` link objects. A list item's value may use the same inline content format.
- Use view IDs `research`, `software`, `teaching`, `other` in that order.

- [x] **Step 1: Create `content.json` with the complete current site content.**
  Store the document and Open Graph title/descriptions, favicon URI, all Home text and portrait path/alt text, all existing section headings, card headings and copy, list items, and existing embedded research links. Keep the footer name in JSON; do not include navigation or contact control content.

- [x] **Step 2: Check the JSON syntax and content coverage.**
  Run: `python3 -m json.tool content.json`
  Expected: formatted JSON is printed and exits successfully. Compare the entries against the existing `index.html` to ensure no content paragraphs or list items are omitted.

### Task 2: Render JSON data into accessible views

**Files:**
- Create: `site.js`
- Modify: `index.html`
- Modify: `README.md`
- Consumes: Task 1 `content.json` contract.

**Interfaces:**
- `site.js` fetches `content.json` relative to the page URL.
- Navigation uses `button[data-view]` and content containers use matching `section[data-view-panel]` identifiers.
- Renderer handles `paragraph`, `list`, and inline string/link values from the Task 1 contract.

- [x] **Step 1: Replace anchor navigation with HTML buttons and add Home first.**
  In `index.html`, retain the existing labels and IDs for the four existing destinations as practical, add Home first, set `type="button"` and `data-view` identifiers, and add `aria-pressed` state. Keep the social/contact controls unchanged.

- [x] **Step 2: Add the Home and section view containers.**
  Create empty semantic containers for Home and the four existing views, each with its stable `data-view-panel` value. Keep only Home initially visible; other panels start hidden. Add a live main-area error target, and keep the footer year span.

- [x] **Step 3: Add `site.js` to load and render content.**
  Create DOM nodes for headings, paragraphs, lists, portrait, and links. Assign prose through `textContent`; assign image `src` and `alt` from JSON. Update `document.title`, the description/Open Graph meta tags, favicon, and footer name from JSON. If fetch, parsing, or rendering fails, show a readable error in the main area and disable navigation buttons.

- [x] **Step 4: Implement view switching and active navigation state.**
  On a valid navigation click, show only the panel with the matching ID and update each button's `aria-pressed` state. Do not set or read URL fragments. If a target is unknown, leave the current view and state intact. Initialize Home as selected after successful render.

- [x] **Step 5: Update navigation and view styles for responsive use.**
  Extend the existing inline CSS for button states, keyboard focus, hidden panels, and narrow layouts. Preserve the current visual theme and ensure the active button is distinguishable.

- [x] **Step 6: Update the README for the new content workflow.**
  Describe `content.json` as the editable source for page text and image paths, explain the supported paragraph/list/card/link structure, and replace the direct-file preview instruction with a static HTTP server instruction. Update the navigation description to say buttons switch views.

- [x] **Step 7: Review data coverage and behavior.**
  Checked JSON syntax, exact page-copy/order preservation, navigation markup and initial visibility, metadata fallback parity, whitespace, and HTTP responses for the page/JSON/script. Attempted headless Firefox automation, but Marionette did not start; interactive switching, viewport, keyboard, image-failure, and malformed-JSON behavior remain unverified. Confirmed no attendance files changed.

