Summer Plans is a mobile-first planning app for a friend group to coordinate summer dates, vote on event options, track blackouts, and keep ideas moving.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Auth Setup

Summer Plans now supports an in-app email code flow that works much better for iPhone Home Screen installs
than magic links.

The app code is ready for OTP entry, but Supabase must be switched from link-style emails to code-style emails:

1. In Supabase, open `Authentication -> Email Templates`
2. Edit the `Magic Link` template
3. Replace the link-focused content with an OTP-focused template that uses `{{ .Token }}`

Example:

```html
<h2>Your Summer Plans sign-in code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:0.18em;">{{ .Token }}</p>
```

Supabase sends email OTP and magic link requests through the same `signInWithOtp` API.
If the template contains `{{ .Token }}`, users receive a 6-digit code. If it contains
`{{ .ConfirmationURL }}`, they receive a link instead.

For production auth delivery to your friend group, configure custom SMTP in Supabase:

1. Open `Authentication -> SMTP Settings`
2. Add your SMTP host, port, username, and password
3. Set a real sender address you control

Until custom SMTP is configured, Supabase default mail delivery is not a production-grade setup.

## Test Commands

```bash
npm run test
npm run test:watch
npm run test:e2e
```

## Event Detail Schema

The event pages now support richer logistics: location name, street address, Apple Maps links,
meeting time, group notes, and parking / meetup notes.

If those fields do not save in Supabase yet, run the idempotent SQL in:

```bash
supabase/migrations/20260425_add_event_details.sql
```

The redesigned event detail page also adds an event length field (`couple_hours`,
`day_long`, `three_day_trip`) that drives the Best Available calculation. If the
length picker fails to save, run:

```bash
supabase/migrations/20260425_add_event_length_type.sql
```

## Notification System

Summer Plans now has a real notification inbox backed by Supabase, plus optional web push for
installed iPhone Home Screen users.

The notification data model lives in:

```bash
supabase/migrations/20260506_add_notifications.sql
```

Run that migration once in Supabase SQL Editor if the new notification tables are not live yet.

### What works without extra setup

- in-app bell notifications for:
  - event confirmed
  - event reminders
  - vote needed nudges
- per-user notification preferences on the Me page

### What extra setup is needed for push

Push is optional. If the push env vars are missing, the bell still works and the app safely
disables device push.

Add these env vars locally and in Vercel:

```bash
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:you@example.com
CRON_SECRET=
```

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

Then:

- add the public/private keys to your envs
- add `CRON_SECRET` in Vercel
- keep the cron in `vercel.json` enabled so reminders dispatch each day

On iPhone, users should:

- open Summer Plans in Safari
- use `Add to Home Screen`
- open `Me`
- turn on push notifications for that device

What each one does:

- `npm run test` runs the fast Vitest suite for logic and component behavior.
- `npm run test:watch` keeps Vitest open while you work.
- `npm run test:e2e` runs the Playwright smoke tests against a production-style local server (`build + start`).

## Current Test Coverage

The test suite is intentionally starting with the highest-value checks:

- notification generation logic
- auth shell rendering and submit behavior
- signed-out browser smoke test

The next layers to add are the full event-voting flow, availability editing, and cross-page regression checks before broader friend-group rollout.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
