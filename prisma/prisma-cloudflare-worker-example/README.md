# Run TiDB Serverless with Prisma on Cloudflare Worker

This repo is an example of how to run TiDB Serverless with our [prisma adapter](https://github.com/tidbcloud/prisma-adapter) on Cloudflare Worker.

## How to run this example

### Prerequisites

Before running through the following steps, make sure you have:

1. Node.js installed on your machine
2. a Cloudflare account
3. a TiDB Serverless instance up and running and its connection string available
4. cd to the correct directory: `cd prisma/prisma-cloudflare-worker-example`

### 1. Configure local secrets

Create a `.env` file in the root of the project with the following content. You can get the connection string from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict"
API_AUTH_TOKEN="<paste a newly generated token here>"
```

Generate the token with `openssl rand -hex 32`. It must contain at least 32 non-whitespace characters. Keep `.env` private and untracked. Copy it to `.dev.vars` for `wrangler dev`; Prisma CLI reads `.env`. Never put either secret in `wrangler.toml` or source code.

This example authenticates one trusted service identity using `Authorization: Bearer <token>`. Anyone holding this token can write logs and read the latest 20 logs. It is for trusted server-to-server callers, not a multi-user application: it does not provide per-user identity or data isolation. Do not embed the token in browser JavaScript or pass credentials in URLs. Use HTTPS outside local development.

Missing or invalid credentials return 401 before any database access. A missing/short token or missing database URL fails closed with 503. Responses use `Cache-Control: no-store`. Request headers and query strings are not persisted in new log entries.

### 2. Install dependencies

```
npm install
```

### 3. Sync the database schema

```
npx prisma db push
```

### 4. Run on Local

```
npm run dev
```

From a separate terminal, set `API_AUTH_TOKEN` to your local token and call:

```sh
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:8787/
```

### 5. Deploy to Cloudflare Worker

Store both values as [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), using a separate token and database identity for each environment:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put API_AUTH_TOKEN
npm run deploy
```

Use a dedicated database account limited to the example's `Log` table; use a separate migration identity for `prisma db push`. Restrict who can manage secrets. To rotate the API token, generate a fresh value, update the secret, and update trusted callers; the previous token stops working. To rotate the database credential, provision a replacement, update `DATABASE_URL`, verify the deployment, then revoke the old database credential. If a real DSN was ever committed or logged, revoke it; removing it from the current file does not revoke it. Review and remove existing sensitive log records separately.

### 6. Test

Run `npm test` on Node.js 22 or later. Tests compile local TypeScript files to temporary CommonJS modules, mock the database through the module cache, and exercise the real entry point and Web Crypto, including rejected requests without database access, successful requests, and token rotation. Temporary files, module mocks, and environment changes are cleaned up after each test.

## How this example built

1. Initialize project: `npm create cloudflare@latest prisma-cloudflare-worker-example -- --type hello-world`
2. Set up prisma: `cd prisma-cloudflare-worker-example` and `npm install --save-dev prisma`
3. Init prisma: `npx prisma init --datasource-provider mysql`
4. Update .env file: `DATABASE_URL=mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict`
5. Update schema.prisma file: use `driverAdapters` as this example does
6. Sync db schema: `npx prisma db push`
7. Configure DATABASE_URL and API_AUTH_TOKEN as secrets as described above
8. Install dependencies: `npm install @tidbcloud/prisma-adapter @tidbcloud/serverless`
9. Write Code: write code in src/index.js file as this example does

## Next steps

- [Learn more about the prisma adapter](https://docs.pingcap.com/tidbcloud/serverless-driver-prisma-example)

