# Valid Character Library

Internal character library for Valid.co editors. The app stores realistic AI character base images, automatically analyzes visible character attributes, and supports semantic search such as `50 year old man black shirt`.

## Current Behavior

- Anyone with the app link can use the library.
- Editors do not add manual tags.
- Uploads support fast batch image selection without requiring client assignment.
- Browser uploads go directly to Supabase Storage through signed upload URLs, avoiding Vercel function body limits.
- Client assignment is paused in the editor flow; the centrally maintained client list remains available for a later workflow.
- AI-generated metadata and Gemini embeddings are created server-side.
- Supabase stores images, metadata, processing events, and pgvector embeddings.
- The UI uses official shadcn/ui components generated into `components/ui`.

## Setup

```powershell
npm.cmd install
npm.cmd run dev
```

Copy `.env.example` to `.env.local` and fill the Supabase/Gemini values.

## Environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`

The same Gemini API key is used for image analysis and embeddings.

## Vercel

Connect the GitHub repo to Vercel as a standard Next.js project.

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: keep the Vercel default

Add the environment variables above in Vercel Project Settings. Do not add `.env.local` to GitHub.

The upload flow is Vercel-safe: `/api/upload/sign` creates short-lived Supabase signed upload URLs, the browser sends image bytes directly to Supabase Storage, and `/api/upload` receives only small JSON metadata to run Gemini analysis and create embeddings.

## Supabase

Migrations live in `supabase/migrations`.

They create:

- `clients` for the maintained client list when client workflows return.
- `characters` for uploaded images, AI profiles, search documents, and embeddings.
- `processing_events` for upload and AI processing audit events.
- A private `characters` storage bucket.
- `match_characters` RPC for pgvector semantic search.
- RLS policies for a later authenticated mode. The current app uses server API routes with the service-role key, so link-only access works without browser database credentials.

## Auth

Authentication is intentionally disabled for now. Re-enable `lib/server-auth.ts`, `lib/supabase-browser.ts`, and the Google auth UI when the app needs domain-restricted access again.
