Summer Plans is a mobile-first planning app for a friend group to coordinate summer dates, vote on event options, track blackouts, and keep ideas moving.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Test Commands

```bash
npm run test
npm run test:watch
npm run test:e2e
```

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
