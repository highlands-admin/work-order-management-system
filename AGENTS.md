<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI Agent Instructions

You are helping build a work order management system for senior living communities. This file contains the conventions and rules you must follow when generating or modifying code.

## Stack

- Next.js 14+ App Router with TypeScript and Tailwind CSS
- Supabase (Postgres, Auth, Realtime, Edge Functions, RLS)
- Cloudflare R2 for image storage (S3-compatible via @aws-sdk/client-s3)
- Resend for transactional email
- Deployed on Vercel

## Next.js Patterns

Follow these patterns without exception unless I explicitly say otherwise.

### Server Components by default

Pages and layouts that read data are Server Components. No 'use client' directive. Query Supabase directly inside the component using the server client from @/lib/supabase/server. No useState or useEffect; the component runs on the server, so data is fetched directly without needing loading states.

External API calls in Server Components use `fetch` directly. No need for an API route as an intermediate layer.

### Client Components only when needed

Use 'use client' only when browser interactivity requires it: form state, modals, realtime subscriptions, hooks. Keep Client Components small and leaf-level. For data mutations, call Server Actions directly (form actions or async function calls). Do not fetch to your own API routes from Client Components unless there is a specific reason the mutation cannot be a Server Action.

### When fetch to your own API routes is appropriate

- Uploading files using presigned URLs (the route generates the URL, not the upload itself)
- Streaming responses (SSE, chunked data)
- Third parties calling your app (webhooks)
- Mobile apps or external tools that need a REST contract

### Server Actions over API Routes

For form submissions and mutations, use Server Actions (files with 'use server' directive). Do not create API routes for internal form handling. Server Actions are type-safe and eliminate the JSON serialization boundary.

### API Routes only for

- Webhooks from external services (Stripe, Twilio, etc.)
- Cron endpoints triggered by Vercel Cron
- Public APIs consumed by external tools or mobile apps
- File upload presigning for R2

## File Structure

- app/ contains only routing: pages, layouts, loading states, error boundaries, route handlers
- lib/ contains utilities, clients, and shared logic, never routing
- components/ contains reusable React components organized by domain
- types/ contains shared TypeScript type definitions
- supabase/migrations/ contains SQL migration files
- Never put utility code inside app/ folders
- Use @/ path alias for all imports, not relative paths

## Database

### Always use migrations

Every schema change must be a migration file in supabase/migrations/. Never instruct the user to make changes through the Supabase dashboard. Migrations must be reversible when possible.

### Always enable RLS

Every table must have Row Level Security enabled before it receives data. Write explicit policies for SELECT, INSERT, UPDATE, and DELETE. Default to deny.

### Prefer Postgres features over external services

- Use tsvector for full-text search, not Elasticsearch or Algolia
- Use Postgres full-text indexes and trigram extensions for fuzzy matching
- Use Postgres triggers for generated columns and computed fields
- Use Supabase Realtime for WebSocket needs, not a custom server

## Security

- Never log, return, or expose secrets in API responses or client code
- Never hardcode credentials; always use process.env.*
- Use NEXT_PUBLIC_ prefix only for values safe to expose to the browser
- Never expose full_address, phone numbers, or other private fields through public queries
- Always validate session in Server Actions before performing mutations

## Coding Style

- TypeScript strict mode always
- No default exports except for Next.js required files (pages, layouts, route handlers)
- Prefer async function declarations over async arrow functions for top-level functions
- Use kebab-case for directories, PascalCase for component files, camelCase for utilities
- Conventional commits format: feat, fix, chore, docs, refactor, test
- Explicit return types on exported functions

## Writing Style in Code Comments and Documentation

- No em dashes
- No "this isn't X, it's Y" constructions
- No sentence fragments
- US English with Oxford commas
- Direct and concise, no hedging
- Avoid AI-sounding phrases: "resonates," "tackling," "leverage," "robust"

## Build Principles

### Free tier is the goal

Every technical decision should keep the stack on free tiers for as long as possible. If a proposed solution requires paid services, call it out explicitly and suggest a free alternative.

### Explain non-obvious tradeoffs

When making a technical decision that isn't the obvious choice, briefly explain why. Don't just write code; help me learn the reasoning.

### When in doubt, ask

If requirements are ambiguous, ask clarifying questions before writing code. Don't hallucinate details or invent requirements.

## User Context

I am currently learning the Next.js App Router and Supabase patterns. Explain App Router and Supabase concepts when they come up, but don't over-explain general programming concepts I clearly know.