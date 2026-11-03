# Run TiDB Serverless with Prisma on Vercel Edge functions

This repo is an example of how to run TiDB Serverless with our [prisma adapter](https://github.com/tidbcloud/prisma-adapter) on Vercel Edge functions

## How to run this example

### Prerequisites

Before running through the following steps, make sure you have:

1. Node.js installed on your machine
2. a Vercel account
3. a TiDB Serverless instance up and running and its connection string available
4. cd to the correct directory: `cd prisma/prisma-vercel-example`

### 1. Configure local secrets

Create a `.env` file in the root of the project with the following content. You can get the connection string from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict"
API_AUTH_TOKEN="<paste a newly generated token here>"
```

Generate the token with `openssl rand -hex 32`. It must contain at least 32 non-whitespace characters. Keep `.env` private and untracked. Never prefix either variable with `NEXT_PUBLIC_` or embed the values in source code.

`GET /api/edge` authenticates one trusted service identity using `Authorization: Bearer <token>`. Anyone holding this token can read the `User` table. It is for trusted server-to-server callers, not a multi-user application: it does not provide per-user identity or data isolation. Do not embed the token in browser JavaScript or pass credentials in URLs. The static welcome page remains public. Use HTTPS outside local development.

Missing or invalid credentials return 401 before any database access. A missing/short token or missing database URL fails closed with 503. API responses use `Cache-Control: no-store` and the route is forced dynamic.

### 2. Install dependencies

```
npm install
```

### 3. Sync the database schema

```
npx prisma db push
```

### 4. Run on Local

Start the local server:

```
vercel dev
```

From a separate terminal, set `API_AUTH_TOKEN` to your local token and call:

```sh
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:3000/api/edge
```

### 5. Deploy to Vercel

Add `DATABASE_URL` and `API_AUTH_TOKEN` as [Vercel Secret environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables). Set separate values for Preview and Production in the project settings, or use the CLI (repeat for `production`):

```sh
npx vercel env add DATABASE_URL preview --type secret
npx vercel env add API_AUTH_TOKEN preview --type secret
```

Deploy to Vercel preview

```
vercel deploy
```

Deploy to Vercel prod

```
vercel --prod
```

Use a dedicated database account with only `SELECT` on the `User` table; use a separate migration identity for `prisma db push`. Restrict who can manage secrets. To rotate the API token, generate a fresh value, update the secret, redeploy, and update trusted callers; the previous token stops working on the new deployment. Retire older deployments that still hold the old token. To rotate the database credential, provision a replacement, update `DATABASE_URL`, redeploy and verify, then revoke the old database credential. If a real DSN was ever committed or logged, revoke it; removing it from the current file does not revoke it.

### 6. Test

Run `npm test` on Node.js 22 or later. Tests mock the database and exercise the real entry point and Web Crypto, including rejected requests without database access, successful requests, and token rotation.

## How this example built

1. Install vercel cli: `npm install -g vercel`
2. Initialize project: `npx create-next-app@latest`
3. Set up prisma: `cd prisma-cloudflare-worker-example` and `npm install --save-dev prisma`
4. Init prisma: `npx prisma init --datasource-provider mysql`
5. Update .env file: `DATABASE_URL=mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict`
6. Update schema.prisma file: use driverAdapters as this example does
7. Install dependencies: `npm install @tidbcloud/prisma-adapter @tidbcloud/serverless`
8. Configure postinstall hook: add a new key `"postinstall": "prisma generate"` to the scripts section in your package.json as this example
9. Sync db schema: `npx prisma db push`
10. Write Code: add `api/edge/route.js` file and write code as this example

## Next steps

- [Learn more about the prisma adapter](https://docs.pingcap.com/tidbcloud/serverless-driver-prisma-example)

