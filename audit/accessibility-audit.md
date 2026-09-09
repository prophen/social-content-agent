# Accessibility audit — 9 September 2026 follow-up

The reported drafts-page hover issue is reproduced and fixed. This follow-up uses the existing regression runner, expanded to exercise computed browser styles in default, hover, selected, and keyboard-focus states.

## Current findings and fixes

1. **High — Unselected draft-filter hover text fails contrast (WCAG 1.4.3 AA).** The global `button:hover:not(:disabled)` selector overrode the background from `.draft-filter-button:hover`, while the filter rule changed the text to purple. Chromium measured #5b48d8 on #4837bc at **1.32:1**, below 4.5:1. The filter selector now includes `:not(:disabled)` and uses #4837bc on #dfe5ee at **6.51:1**. An explicit selected-hover rule preserves white on #4837bc at **8.24:1**. All six filters are exercised as selected controls as well.
2. **Keyboard-focus improvement.** Added a consistent opaque, offset 3px outline for links, buttons, and fields. Existing custom field rules could suppress or dilute outlines; explicit field selectors ensure the new ring wins. This is a robustness improvement, not a claim that every previous browser-default outline failed WCAG.

## Current verification and limits

- The new hover assertion failed against the original stylesheet at 1.32:1 before the fix.
- **139 computed contrast assertions pass**, including enabled links/buttons in default, hover, and focus states across the dashboard, draft/approved/scheduled editor, new draft, and brand voice, plus selected filters and preview text. Keyboard assertions check focus visibility; field assertions also check the opaque outline color.
- Axe-core reports **zero violations across nine states**: sign-in, sign-up, approved editor with error, scheduled editor, populated dashboard, empty filtered dashboard, new draft after generation, brand voice, and sign-in error.
- One axe incomplete check concerns the decorative arrow in “Open draft.” It is `aria-hidden`, duplicates the visible link label, and inherits the passing link colors (6.24:1 default, 8.24:1 hover). No other incomplete checks were returned.
- Reflow checks pass at 320 CSS pixels for sign-up, draft editor, populated dashboard, new draft, and brand voice. The dashboard hover screenshot was visually inspected.
- Existing keyboard-tab navigation, live-region persistence, validation associations, and notification checks still pass. ESLint passes.
- The sign-in route runs through Next.js. Protected pages render actual components, including AuthControls, with mocked auth client, routing, and API data. No account, draft, or publishing data was changed. Authenticated integration, screen-reader speech, forced colors, zoom/text-spacing, and mobile assistive technology remain untested; this is not full WCAG conformance certification.

Run `npm run test:a11y` against the local development server, using `A11Y_BASE_URL` for a nondefault port. Detailed colors/ratios and screenshots are regenerated under ignored `audit/results/`. The earlier setup instructions below still apply.

Reference: [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), including hover and focus text.

---

# Previous accessibility audit — 6 September 2026

All four findings from the initial WCAG 2.2 A/AA oriented review have been addressed. This is a scoped audit, not a conformance certification.

## Findings and remediation

1. **High — Missing editor announcements (WCAG 4.1.3 AA).** Save, approval, scheduling, and validation messages previously lacked announcement semantics unless they began with `Error`. Notices now use explicit message types with persistent status/alert regions. Date validation is associated with its input. Dashboard and activity loading/results also have announcements. See `app/drafts/[id]/page.tsx` and `app/drafts/page.tsx`.
2. **Medium — Input boundary contrast (WCAG 1.4.11 AA).** Previous borders measured 1.29:1–1.88:1 against white. Editable fields now use `--control-border` (#78869b): 3.70:1 against white and 3.32:1 against the scheduling panel. Decorative borders remain separate. See `app/globals.css`.
3. **Medium — Incomplete sign-in tabs (WAI-ARIA APG pattern).** Arrow keys previously did nothing, both tabs were in the Tab sequence, and the form lacked a panel association. Tabs now support wrapping arrows, Home/End, one Tab stop, and an associated labelled panel. This was an APG mismatch, not total keyboard inaccessibility. See `app/sign-in/SignInForm.tsx`.
4. **Medium — Generic titles (WCAG 2.4.2 A).** All routes previously inherited Social Content Agent. Server metadata now provides distinct authentication, library, new-draft, and editor titles. See `app/sign-in/page.tsx` and layouts under `app/drafts/`.

Additional improvements: topic-specific draft links, generation-complete and draft-creation feedback, field-linked new-draft validation, and separate persistent authentication status/error regions.

## Verification

- Lint, TypeScript, and whitespace checks pass.
- Axe-core 4.13.0 reports zero violations and zero incomplete checks in seven states: sign-in, sign-up, approved editor with an error, scheduled editor, empty filtered dashboard, new draft after generation, and sign-in failure.
- Browser assertions cover keyboard wrapping, Home/End, Tab exit/return, panel associations, persistent notification nodes, save/approve/schedule success and failure, date validation, filter feedback, generation feedback, and field/error associations.
- Sign-up has no horizontal overflow at 320 CSS pixels.
- Authentication is tested through the running Next.js app. Protected components and sign-in failure use an isolated browser harness with mocked router, authentication controls, and API responses. It renders actual page components but does not validate backend integration.
- A separate authenticated browser review confirmed live page titles, draft links, filtering, new-draft validation, approved-editor controls, date validation, activity feedback, and published read-only state. No existing draft content or publishing state was modified.
- Actual screen-reader speech, authenticated mutation workflows, zoom/text spacing, forced colors, and mobile assistive technology remain untested. Automated results do not establish full WCAG conformance.

The initial authenticated check encountered a network-restricted development server. Restarting it with network access restored Supabase session validation. This was separate from the accessibility findings.

## Repeat the regression checks

From the repository root:

```sh
npm ci
npx playwright install chromium
npm run dev
```

With the server running, use another terminal:

```sh
npm run test:a11y
```

The default URL is `http://localhost:3000`. For another local port, set `A11Y_BASE_URL`; in PowerShell:

```powershell
$env:A11Y_BASE_URL = 'http://localhost:3017'
npm run test:a11y
```

The runner uses a fresh browser session and mock data; credentials are not required. JSON results and a screenshot are regenerated under `audit/results/`, which is ignored by Git. Playwright and axe-core are declared development dependencies. On Linux CI, install browser system dependencies with `npx playwright install --with-deps chromium`.

The fixture harness loads React's production CommonJS builds. If an upgrade changes those package files, update the harness. Real authenticated screen-reader testing remains necessary after relevant UI changes.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html)
- [Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [Page titles](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html)
