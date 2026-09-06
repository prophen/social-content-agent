# Accessibility audit — 6 September 2026

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
