# Social Content Agent

An AI-assisted social-content workflow for creating, reviewing, approving, scheduling, and simulating the publication of social posts.

Rather than giving an LLM unrestricted posting access, this project treats public publishing as a controlled workflow: users generate a draft, review the exact text, explicitly approve it, schedule it, and let a protected server-side job transition due posts to a simulated published state.

## Features

- Generate LinkedIn-style post drafts from a topic using an AI model
- Apply a reusable brand-voice profile during generation
- Save drafts in Supabase Postgres
- Edit, save, and reopen drafts from a Draft Library
- Require explicit approval before scheduling
- Automatically invalidate approval when approved or scheduled content changes
- Schedule approved drafts for simulated publication
- Run a protected background publisher job for due scheduled drafts
- Authenticate users with Supabase email/password authentication
- Restrict drafts to their owner with Supabase Row Level Security (RLS)
- Redirect unauthenticated visitors away from protected draft routes
- Provide a client-side sign-out flow

## Status Workflow

```text
draft
  → approved
  → scheduled
  → published (simulated)
```

The server enforces transition rules:

- Only a `draft` can be approved.
- Only an `approved` draft can be scheduled.
- Editing content resets the record to `draft` and clears approval and scheduling data.
- Only a due `scheduled` draft can become `published`.
- Published drafts are read-only in the current version.

## Tech Stack

- **Frontend:** Next.js App Router, React, TypeScript, CSS
- **AI generation:** OpenAI Responses API
- **Database and authentication:** Supabase Postgres, Supabase Auth, Row Level Security
- **Deployment:** Vercel
- **Scheduling:** Protected server-side publisher route, designed for Vercel Cron

## Architecture

```text
Browser UI
  ↓
Next.js route handlers
  ├─ AI draft generation route
  ├─ Draft CRUD and approval routes
  └─ Protected publisher-job route
  ↓
Supabase
  ├─ Auth sessions
  ├─ Postgres drafts table
  └─ Row Level Security policies
```

### Security model

- The OpenAI API key stays in server-side environment variables.
- Draft routes validate the authenticated Supabase user with `auth.getUser()`.
- Each draft has an `owner_id` connected to `auth.users`.
- RLS policies allow users to access only drafts where `owner_id = auth.uid()`.
- The publisher job requires a separate `CRON_SECRET` bearer token.
- A Supabase service-role key is used only in server-side publisher code because background jobs do not have a normal user session. It must never be exposed to the browser.

## Local Setup

### Prerequisites

- Node.js LTS
- A Supabase project
- An OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/prophen/social-content-agent.git
cd social-content-agent
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root. Do not commit it.

```env
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

### 3. Configure Supabase

Create a `drafts` table with fields for content, lifecycle status, timestamps, schedule timestamps, publication timestamps, and `owner_id`.

The app expects the following status values:

```text
draft | approved | scheduled | published
```

Enable Supabase email/password authentication and configure allowed redirect URLs for:

```text
http://localhost:3000/**
https://YOUR-VERCEL-APP.vercel.app/**
```

Enable Row Level Security and create ownership policies so authenticated users can only read and mutate their own rows.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Validate the project

```bash
npm run lint
npm run build
```

## Deployment

The project is designed to deploy to Vercel from GitHub.

1. Import the repository in Vercel.
2. Confirm the framework preset is **Next.js**.
3. Add the environment variables from `.env.local` in Vercel Project Settings.
4. Add values to both **Production** and **Preview** environments as appropriate.
5. Deploy.

Never expose these as `NEXT_PUBLIC_` variables:

```text
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

## Publisher Job

The simulated publisher job is available at:

```text
/api/jobs/publish-due-drafts
```

It requires this request header:

```text
Authorization: Bearer <CRON_SECRET>
```

The job locates scheduled drafts whose `scheduled_for` time has passed and updates them to `published` with a `published_at` timestamp.

For local testing, call it manually with PowerShell:

```powershell
$headers = @{
  Authorization = "Bearer YOUR_CRON_SECRET"
}

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/jobs/publish-due-drafts" `
  -Method Post `
  -Headers $headers
```

## What This Project Demonstrates

This project is intentionally more than a chatbot or text generator. It demonstrates AI-product engineering practices including:

- Secure server-side model calls
- Clear tool and permission boundaries
- Human approval for consequential actions
- State-machine-style workflow design
- Persistent application state
- Authentication and database-level authorization
- Background job security
- Error handling, loading states, and user-facing workflow UX

## Current Limitations

- Publication is simulated; the app does not yet post to LinkedIn, X, Instagram, or another social platform.
- Scheduling precision depends on the deployed background-job provider and plan.
- The current version is optimized for text posts rather than media uploads or carousels.
- Brand voice is currently application configuration; it is not yet user-editable.

## Future Improvements

- Add an audit timeline for draft creation, edits, approvals, scheduling, and publication
- Use structured AI output for hooks, post variants, hashtags, and claim-review flags
- Add user-editable brand voice settings
- Add real social-platform OAuth for one platform
- Require a final approval check immediately before a real publish request
- Add analytics and post-performance summaries
- Add integration and end-to-end tests for authorization and status transitions

## License

This project is currently provided for portfolio and learning purposes.
