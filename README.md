# Social Content Agent

An AI-assisted LinkedIn content workflow for generating, reviewing, approving, scheduling, and tracking social-media drafts.

> **Note:** Publishing is currently simulated. A protected background job finds due scheduled drafts, marks them as published in the application database, and records the result in the activity timeline. The app does not currently publish directly to LinkedIn or another social network.

## Overview

Social Content Agent helps a signed-in user move from an idea to a reviewable LinkedIn post in one workflow:

```text
Enter a topic
→ Generate a draft with AI
→ Review and edit
→ Save
→ Approve
→ Schedule simulated publication
→ Background job processes due drafts
→ Review activity history
```

The project focuses on the product and engineering work around AI generation—not only the model call. It includes user-specific draft ownership, human review before scheduling, status-based workflow controls, a scheduled server-side publisher, and an auditable event history.

## Features

- Generate LinkedIn post drafts with the OpenAI Responses API
- Apply a reusable brand-voice configuration to generated content
- Review and edit AI output before saving it
- Create and manage drafts from a personal dashboard
- Filter drafts by Draft, Approved, Scheduled, Published, and Publish failed status
- Approve drafts before they can be scheduled
- Schedule simulated publication using a date and time
- Process due drafts with a protected Vercel Cron-triggered route
- Track draft-created, updated, approved, scheduled, published, and failed-publish events
- Protect user data with Supabase Auth and Row Level Security policies
- Require authentication before AI generation requests
- Validate topic input length and support per-user generation-rate limiting
- Secure the scheduled publishing route with a server-side cron secret

## Tech stack

| Area                  | Technology                            |
| --------------------- | ------------------------------------- |
| Front end             | Next.js App Router, React, TypeScript |
| Styling               | CSS                                   |
| AI generation         | OpenAI Responses API                  |
| Authentication        | Supabase Auth                         |
| Database              | Supabase Postgres                     |
| Authorization         | Supabase Row Level Security (RLS)     |
| Background scheduling | Vercel Cron Jobs                      |
| Deployment            | Vercel                                |

## User workflow

### 1. Create a draft

From the drafts dashboard, select **New draft**. Enter a topic and either write initial content yourself or generate a first draft with AI.

### 2. Generate with AI

The app sends the topic to a server-side Next.js route. That route builds instructions from the app's brand-voice configuration and calls the OpenAI Responses API. The generated post returns to the editor for human review.

The OpenAI API key is never exposed to the browser.

### 3. Review and save

Users can edit generated content before saving. Saving updates the draft and records a draft-update event in the activity timeline.

### 4. Approve and schedule

A draft must be approved before it can be scheduled. The user chooses a date and time, and the draft transitions to the `scheduled` status.

### 5. Simulated publication

A protected scheduled route checks for drafts whose scheduled time has passed. Eligible drafts transition from `scheduled` to `published`, receive a `published_at` timestamp, and receive a `draft_published` activity event.

The update targets only drafts that are still scheduled, which makes repeated job runs safer and avoids duplicate publication events.

### 6. Track activity

Each draft has a timeline of explicit workflow events, including:

- Draft created
- Draft updated
- Draft approved
- Draft scheduled
- Draft published
- Publication failed

A status indicates where a draft is now. The activity log shows how it arrived there.

## Architecture

```text
┌──────────────────────────────┐
│          Next.js UI          │
│                              │
│  Dashboard → New Draft       │
│  → Editor → Activity         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Next.js Route Handlers   │
│                              │
│  /api/drafts                 │
│  /api/generate-draft         │
│  /api/jobs/publish-due-drafts│
└───────┬──────────────┬───────┘
        │              │
        ▼              ▼
┌───────────────┐  ┌──────────────────┐
│ OpenAI API    │  │ Supabase         │
│ Draft content │  │ Auth + Postgres  │
└───────────────┘  │ RLS + event data │
                   └─────────▲────────┘
                             │
                    ┌────────┴─────────┐
                    │   Vercel Cron    │
                    │ Scheduled trigger│
                    └──────────────────┘
```

## Security and reliability

### Authentication and authorization

- Browser-facing draft routes require an authenticated Supabase user.
- Draft queries are scoped to the signed-in user's `owner_id`.
- Row Level Security policies restrict draft and activity-event access to the owning user.
- The AI-generation endpoint verifies the user session before invoking OpenAI.

### Secret handling

- `OPENAI_API_KEY` is accessed only from server-side route handlers.
- `SUPABASE_SERVICE_ROLE_KEY` is reserved for trusted server-side automation, such as the scheduled publisher.
- `CRON_SECRET` protects the scheduled publishing endpoint.
- No real credentials belong in source control, screenshots, client-side code, or the README.

### Background publishing

The scheduled publisher validates its authorization header before using the admin database client. It publishes only drafts that match both conditions:

```text
status = scheduled
scheduled_for <= current time
```

It records a publication activity event only for drafts the publish update actually changed. This reduces the risk of duplicate timeline entries when a scheduled job is retried.

### Generation controls

AI generation is a cost-bearing operation. The server validates input and can record generation requests in the database to enforce a per-user rate limit, such as 10 generations per hour.

## Database setup

The project uses Supabase Postgres tables for drafts, workflow events, and optional AI-generation rate-limit tracking.

Expected migrations live in:

```text
supabase/migrations/
```

The schema should include:

- `drafts`
- `draft_events`
- `generation_requests` (if rate limiting is enabled)
- Indexes for dashboard sorting, due scheduled drafts, and activity history
- Row Level Security policies for user-owned data

### Core data model

| Table                 | Purpose                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `drafts`              | Stores the topic, content, owner, current status, schedule time, publication time, and timestamps |
| `draft_events`        | Stores an append-only history of workflow events for each draft                                   |
| `generation_requests` | Optionally records successful generation requests for per-user rate limiting                      |

Run migrations in filename order in a new Supabase project. Do not run table-creation migrations against an existing project without first checking whether the tables and policies already exist.

## Local setup

### Prerequisites

- Node.js 20 or later
- npm
- A Supabase project
- An OpenAI API key
- A Vercel account for deployed cron scheduling

### Install

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/social-content-agent.git
   ```

2. Move into the project folder:

   ```bash
   cd social-content-agent
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Add your values to `.env.local`.

6. Run the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` locally. Configure the same values in Vercel for deployed environments.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET=
```

### Variable notes

| Variable                        | Use                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL used by the app                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anonymous key used by browser and server clients                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only key for trusted background publishing work; never expose it to the browser |
| `OPENAI_API_KEY`                | Server-only key for AI draft generation                                                |
| `CRON_SECRET`                   | Random secret used to authorize the scheduled publishing endpoint                      |

Never commit `.env.local` or real environment-variable values.

## Vercel Cron setup

Publishing is currently simulated by a scheduled route. Configure a cron entry that matches the publisher route used by this project:

```json
{
  "crons": [
    {
      "path": "/api/jobs/publish-due-drafts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

The schedule above runs every five minutes and is useful for development/demo purposes. Adjust the schedule for your requirements.

In Vercel:

1. Add `CRON_SECRET` as an environment variable for the Production environment.
2. Add all required Supabase and OpenAI environment variables.
3. Deploy the `main` branch to Production.
4. Verify the cron entry appears in the project’s Cron Jobs settings or Production deployment summary.
5. Review Vercel Runtime Logs to confirm scheduled invocations and publishing results.

Cron jobs run against Production deployments. For local testing, call the protected route manually with the expected authorization header.

## Automated tests

After installing dependencies with `npm ci`, run the isolated test suite:

```bash
npm test
```

Use `npm run test:watch` while editing or `npm run test:coverage` to generate
terminal, HTML, and LCOV coverage reports. Open `coverage/index.html` for the HTML
report; generated coverage files are ignored by Git.

Tests use Vitest and React Testing Library. They cover draft approval and scheduling,
editing safeguards, simulated publication and activity recording, API authentication,
AI input validation and quota handling, and sign-in interactions. Supabase and OpenAI
are mocked at their module boundaries; no environment file, live database, API key,
or running development server is required.

Add server tests as `tests/**/*.test.ts`. Component tests use `tests/**/*.test.tsx`
with a `// @vitest-environment jsdom` directive. Shared query fixtures live in
`tests/helpers/supabase.ts`. Coverage includes untested application modules to make
remaining gaps visible; it does not establish live database RLS or end-to-end coverage.

GitHub Actions runs lint, TypeScript checking, and tests with coverage on pushes and
pull requests. Run the same checks locally with:

```bash
npm run lint
npm run typecheck
npm run test:coverage
```

The workflow is defined in [.github/workflows/test.yml](.github/workflows/test.yml).
Browser accessibility checks run separately and are not included in this CI workflow.

## Accessibility audit

The [6 September 2026 accessibility audit](audit/accessibility-audit.md) documents
four resolved findings from a WCAG 2.2 A/AA oriented review:

- Persistent status and alert regions announce workflow feedback, with validation
  errors associated with their inputs.
- Editable field borders have stronger contrast against white and panel backgrounds.
- Sign-in/sign-up tabs support wrapping arrow keys, Home/End, a single Tab stop,
  and an associated labelled panel.
- Authentication, draft library, new-draft, and editor routes have distinct page titles.

Additional improvements include topic-specific draft links and loading, filtering,
generation, and draft-creation feedback.

### Run accessibility regression checks

After completing local setup, install Chromium and start the app:

```bash
npx playwright install chromium
npm run dev
```

In a second terminal, run:

```bash
npm run test:a11y
```

The runner defaults to `http://localhost:3000`. To use another local port in PowerShell:

```powershell
$env:A11Y_BASE_URL = 'http://localhost:3017'
npm run test:a11y
```

On macOS or Linux (bash/zsh):

```bash
A11Y_BASE_URL=http://localhost:3017 npm run test:a11y
```

The [regression runner](audit/verify-fixes.cjs) uses Playwright and axe-core. It
checks the running app's authentication UI and renders actual protected page
components in an isolated browser harness with mocked router, authentication, and
API responses. No account credentials are required. Results are written to
`audit/results/verification.json` and a narrow-screen screenshot to
`audit/results/sign-up-320.png`; this directory is ignored by Git. For Linux CI
environments, install Chromium with `npx playwright install --with-deps chromium`.

The recorded audit found zero axe violations and zero incomplete checks across
seven UI states. Browser assertions also cover keyboard navigation, persistent
feedback regions, validation associations, control contrast, distinct titles, and
sign-up layout at 320 CSS pixels.

These are scoped regression checks, not full WCAG conformance or backend integration
coverage. Actual screen-reader speech, authenticated mutation workflows, zoom/text
spacing, forced colors, and mobile assistive technology remain untested. See the
audit report for the separate authenticated browser review and remaining manual checks.

## Manually testing the publisher

Use a disposable draft only.

### Make a draft due

In Supabase SQL Editor:

```sql
update public.drafts
set
  status = 'scheduled',
  scheduled_for = now() - interval '5 minutes'
where id = 'PASTE_TEST_DRAFT_ID';
```

### Trigger the route locally

The route supports `GET` for Vercel Cron and `POST` for manual checks. Replace
`YOUR_CRON_SECRET` with your configured secret. In PowerShell:

```powershell
$headers = @{
  Authorization = "Bearer YOUR_CRON_SECRET"
}

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/jobs/publish-due-drafts" `
  -Method Post `
  -Headers $headers
```

On macOS or Linux (bash/zsh):

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer YOUR_CRON_SECRET" \
  "http://localhost:3000/api/jobs/publish-due-drafts"
```

For production, use the HTTPS deployment URL. In PowerShell:

```powershell
$headers = @{
  Authorization = "Bearer YOUR_CRON_SECRET"
}

Invoke-RestMethod `
  -Uri "https://YOUR-VERCEL-APP.vercel.app/api/jobs/publish-due-drafts" `
  -Method Post `
  -Headers $headers
```

On macOS or Linux (bash/zsh):

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR-VERCEL-APP.vercel.app/api/jobs/publish-due-drafts"
```

After a successful run, verify:

- The draft status is `published`.
- `published_at` contains a recent timestamp.
- `draft_events` includes one `draft_published` record for the draft.
- The draft Activity section shows the published event.

## Project structure

```text
app/
├── api/
│   ├── drafts/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── events/route.ts
│   ├── generate-draft/route.ts
│   └── jobs/
│       └── publish-due-drafts/route.ts
├── drafts/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── globals.css
└── layout.tsx

lib/
├── brandVoice.ts
├── draftEvents.ts
├── drafts.ts
└── supabase/
    ├── admin.ts
    ├── client.ts
    └── server.ts

supabase/
└── migrations/
```

Exact file names may differ slightly as the project evolves.

## Design decisions

### Human review is required

The app does not automatically publish an LLM response immediately after generation. AI output is a starting point; users review and edit the content before saving, approving, and scheduling it.

### Events are explicit

The project uses a `draft_events` table instead of trying to infer history from the current draft status. This provides a clearer activity timeline and supports future auditing, analytics, retries, and team workflows.

### Publication is idempotent at the status transition

The publisher updates only rows that remain in the `scheduled` state. If the scheduled route runs again after a draft is already published, it should not republish it or create another published event.

### Real provider publishing is intentionally deferred

The current publisher simulates publication. Integrating a real social platform requires per-user OAuth, provider permissions, encrypted/secure token handling, token-refresh behavior, provider-specific errors, retries, and a user-facing account-connection interface.

## Future improvements

- Connect LinkedIn accounts through OAuth 2.0
- Publish to LinkedIn through an authorized provider API
- Add a publishing-account Settings page and disconnect control
- Support team review and approval roles
- Add a content calendar interface
- Add post-performance analytics
- Add retries, backoff, and alerting for provider failures
- Use an atomic database function or distributed limiter for high-traffic rate limiting
- Add end-to-end tests against a disposable Supabase project
- Add pagination and search for larger draft collections

## Screenshots
Draft dashboard
<img width="1802" height="1503" alt="draft dashboard" src="https://github.com/user-attachments/assets/24ae27e1-0f75-4498-96d8-ef40d7dc64d4" />

New draft page after AI generation
<img width="1802" height="1260" alt="new draft page" src="https://github.com/user-attachments/assets/9309727d-f64d-4aa9-9dec-7a5d5e3e487c" />

Draft editor
<img width="1802" height="1260" alt="image" src="https://github.com/user-attachments/assets/1da78eb5-5a42-48bc-a8a1-93057f4d074d" />
<img width="1802" height="1464" alt="image" src="https://github.com/user-attachments/assets/94537990-ed47-48a0-bf8e-983e8b038d07" />

Activity timeline
<img width="1802" height="1388" alt="image" src="https://github.com/user-attachments/assets/1cb67e61-e416-4db6-b98a-0529e2fc2fb1" />

## License
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
