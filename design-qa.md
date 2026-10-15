# GitHub repository reconstruction QA

final result: blocked

Source: four 1200 × 860 screenshots and REA page observations captured on 2026-10-15, in `evidence/` and the REA checkout's `.cache/github-rebuild-capture/run-PpHCJS/`.

The user completed all four rendered captures in `evidence/preview-xsEGMd/` at 1200 × 860. PNG sizes and SHA-256 hashes were verified. Source/rendered comparisons have been reviewed for all four routes. This agent cannot reach the debugging endpoint directly; post-fix captures and a real-browser functional pass are still outstanding. A successful build or DOM test is not visual verification.

## Pending fidelity checks

- Fonts/typography: system stack and source sizes have been implemented; verify line wrapping and weight against the original.
- Spacing/layout rhythm: 1200 px source geometry implemented; verify column widths, scroll positions, row heights, and header placement.
- Colors/tokens: dark source palette implemented; rendered pixel comparison pending.
- Assets: official Octicons; contributor avatars extracted from the source screenshot. README badge presentation is a text-based approximation and the trending graphic is omitted. These are known fidelity gaps.
- Copy/content: captured issue titles, repository description, and selected issue discussion included. Repository file bodies are from the local source checkout; additional issue metadata comes from a later public API read. Counts/timestamps are snapshot values. File-list display names, commit summaries and relative times are derived from the captured accessibility table.
- Responsive behavior: CSS adaptation exists; mobile source capture and runtime checks remain outstanding.

## Functional extension

New-issue composition, local comments, and state changes are prototype extensions, not observations of the unauthenticated captured UI. They persist only in this browser and are never sent to GitHub.

## Next verification

Run the development server in the user's normal terminal. Capture the four matching routes at 1200 × 860, compare alongside source images, test the core navigation and local edits in a real browser, and fix actionable issues before marking this report passed.

## 2026-10-15 — First rendered repository comparison

Opened the source and rendered repository screenshots, both at 1200 × 860. Combined full-frame evidence: `evidence/repository-comparison.png`; readable table/control crop: `evidence/repository-detail-comparison.png`. Source is on the left, prototype on the right.

- P2 typography: prototype file names are lighter than the original. Applied 600 weight to `.file-name`.
- P2 content/layout: last-commit bar omitted the co-author, SHA, relative time, and status marker. Restored source-visible metadata and kept co-author visible at the captured desktop width.
- P2 spacing: branch and Code controls were narrower than the source, shifting the search input. Applied source-matched minimum widths.
- P2 spacing: sidebar topics were too tightly stacked, pulling lower metadata upward. Adjusted line-height and vertical gap.

These fixes require a fresh rendered repository capture before verification. No post-fix screenshot has been reviewed yet. File, issue-list and issue-detail captures were subsequently completed; see the update below.

final result: blocked

## 2026-10-15 — Four-screen capture review

Completed evidence: `evidence/preview-xsEGMd/summary.json`. Compared file, issues and issue-detail screenshots against the originals in `evidence/file-comparison.png`, `evidence/issues-comparison.png` and `evidence/issue-detail-comparison.png` (source left, prototype right). Repository comparison was reviewed previously; its resumed capture predates the earlier fixes.

- P1 file navigation: selected-tree-item `scrollIntoView` also scrolled the document, hiding file-path and commit controls on entry. Changed to scrolling only the tree container. The captured source file viewport is also scrolled, so a matched post-fix scroll position remains necessary for comparison.
- P2 file sidebar: horizontal overflow and light native scrollbars. Constrained the tree width, removed horizontal scrolling, and declared dark native control colors (light mode overrides this).
- P2 issue list: comment metadata occupied too little space, causing different title wrapping and row rhythm. Reserved a desktop metadata column; narrow mobile rows retain their compact column.
- P2 issue detail: code-block line-height differed. Reduced it to match the source rhythm. Syntax coloring and original README badges/trending graphic remain fidelity gaps.
- Capture script: REA reports frame URLs without hash routes. Preserve raw REA outputs and verify the full route through target discovery before/after screenshot and page inspection; store route verification separately for resume. Saved failing README evidence now passes this check; changed routes, incorrect targets and incorrect documents are rejected.

Validation: `npm run test:ui` and `npm run build` passed after the changes. Captured console events contain Vite/React development messages with no error events within the observed records; this is not complete console coverage. No post-fix visual capture, mobile-source comparison, or real-browser local-edit interaction test has been completed.

final result: blocked (post-fix visual verification remains)

## 2026-10-15 — Post-fix captures

Reviewed all four images from `evidence/preview-b0Xxup/`. Repository and file are 1200 × 860; issues and issue-detail are 2560 × 1267.

- Repository: updated commit metadata, filename weight and topic spacing are visible.
- File: breadcrumb and commit controls are visible, the sidebar no longer has a horizontal scrollbar, and native scrollbars match the dark theme. The source and prototype tree scroll positions differ; README badges/trending graphic remain known gaps.
- Issues/detail: wide-screen screenshots show no obvious overlap or clipping in the visible content, but do not verify the 1200 px wrapping and spacing changes against the source. Do not resize these screenshots to claim a matching-viewport comparison.

Added `--only issues,issue-detail` to collect just the two remaining matching-viewport screenshots. Original captures are retained. Real-browser local-edit verification and mobile comparison remain outstanding.

final result: blocked (matching-viewport issue captures and remaining fidelity gaps)

## 2026-10-15 — Issue recapture at 1200 × 860

Reviewed `evidence/preview-Ab05AQ/` and saved `issues-postfix-comparison.png` and `issue-detail-postfix-comparison.png` (source left). Both PNGs are 1200 × 860, but rendered content has a different effective scale: the global header and sidebar are larger, repository tabs overflow horizontally, and desktop navigation entries are hidden by the 1000 CSS-pixel breakpoint despite the 1200-image-pixel width. This is consistent with browser zoom or device scaling differing from the reference; PNG dimensions alone do not establish matching CSS viewport geometry. Do not attribute these line-wrap differences solely to application CSS or mark the comparison passed. Need browser zoom reset and matching effective viewport for the two issue screens.

final result: blocked (effective browser scale differs)

## 2026-10-15 — Zoom reset verification

Reviewed both 1200 × 860 screenshots in `evidence/preview-lO3QeB/`. Header geometry and desktop navigation are back at the expected scale; the prior zoom mismatch is resolved. Verified PNG SHA-256/byte lengths and route sidecars. Desktop list and detail have no obvious overlap or clipped controls in the captured viewport. Revised metadata column, dark scrollbars, and detail code-block spacing are visible.

The four-route desktop screenshot review is now complete using repository/file from preview-b0Xxup and issues/detail from preview-lO3QeB. This does not establish full source fidelity: issue title wrapping, label placement, body text weight, syntax coloring, and README badge/trending assets still differ. Browser editing flows and mobile source comparisons remain unverified. No further recapture is needed merely to resolve the previous viewport/zoom mismatch.

final result: blocked (remaining fidelity gaps and unverified browser interactions; capture and desktop review complete)

## 2026-10-15 — User-reported browser verification

The user reported “브라우저 검증 완료” after receiving the desktop functional checklist: file navigation, Preview/Code switching, download, issue search/state/label filters, issue detail, local issue creation, comments, closing, reload persistence, and browser back/forward navigation. Record this as user-reported completion of the browser checklist, not an agent-observed automated browser run. The existing automated UI integration test and production build passed after the implementation changes.

Desktop functional verification: complete (user reported).
Desktop four-screen capture/review: complete.
Mobile verification: not confirmed; it was conditional in the checklist.
Remaining source fidelity differences: title wrapping, text weight, syntax colors, README badges and trending graphic. No live GitHub API integration; local edits remain browser-local.

final result: blocked for strict visual-fidelity signoff only; desktop prototype functional verification complete.

## 2026-10-15 — Code dropdown reconstruction

Source: user-provided Code/Clone screenshot (15:26:03). The previously simplified centered Clone dialog did not match this uncaptured interaction state. Replaced it with a 400 CSS-pixel popover anchored to the Code button; reference screenshot displays the menu at approximately 500 image pixels, consistent with a larger source display scale. Added Local/Codespaces tabs, HTTPS/SSH/GitHub CLI address selection, copy, help, Copilot/Desktop links, ZIP download, outside-pointer dismissal and Escape focus restoration. Codespaces is a frontend sign-in handoff rather than a live workspace integration; the Copilot action opens its GitHub page, and Desktop uses the application protocol link.

Automated DOM regression covers popover placement in the component hierarchy (no modal backdrop), address changes, copied SSH value, Codespaces handoff, Escape/focus restoration and outside-pointer dismissal. Production build passed. Existing browser verification predates this change. A rendered open-menu screenshot and browser confirmation remain outstanding; visual parity is not yet verified.

final result: blocked (new Code-menu visual verification outstanding)

## 2026-10-15 — Copy feedback state

Copy controls now show a green Check icon and “Copied!” accessible label/title after a successful clipboard write, then return to the Copy icon after two seconds. Changing the selected clone protocol clears the success state; clipboard failures report unavailable without success feedback. Pending clipboard completions are ignored if the value changes or the component unmounts. DOM regression verifies the copied state and protocol-change reset. Browser-rendered appearance remains unverified.

## 2026-10-15 — User confirmation of Code menu copy feedback

The user reported “확인 완료” after testing the revised copy feedback. Record the Code-menu copy interaction as user-confirmed; the agent did not directly observe the rendered browser state. Strict source-fidelity differences documented above remain separate from functional confirmation.
