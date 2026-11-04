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

Create a `.env` file in the root of the project with the following content. Use a dedicated runtime database account for this Vercel application and environment, separate from the Worker example and the migration account. Step 3 describes its permissions. You can get the connection details from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<vercel-runtime-user>:<runtime-password>@<host>:4000/<vercel-database>?sslaccept=strict"
API_AUTH_TOKEN="<paste a newly generated token here>"
```

Generate the token with `openssl rand -hex 32`. It must contain at least 32 non-whitespace characters. Keep `.env` private and untracked. Never prefix either variable with `NEXT_PUBLIC_` or embed the values in source code.

`GET /api/edge` authenticates one trusted service identity using `Authorization: Bearer <token>`. Anyone holding this token can read up to 20 user IDs, ordered by descending ID. The query explicitly selects only `id`; it does not return email addresses or names. This is a fixed sample, with no pagination or client-controlled query options. It is for trusted server-to-server callers, not a multi-user application: it does not provide per-user identity or data isolation. Do not embed the token in browser JavaScript or pass credentials in URLs. The static welcome page remains public. Use HTTPS outside local development.

Before adapting this example for individual users, add verified user/tenant identities and scope database queries to the records each identity is authorized to access. Configure rate limits at the deployment boundary as needed for your workload.

Missing or invalid credentials return 401 before any database access. A missing/short token or missing database URL fails closed with 503. API responses use `Cache-Control: no-store` and the route is forced dynamic.

### 2. Install dependencies

```
npm install
```

### 3. Sync the database schema with a separate migration account

In a trusted migration shell or CI job, load `MIGRATION_DATABASE_URL` from your secret manager for a separate account with schema-change permissions limited to this example's database. Disable shell tracing. Override `DATABASE_URL` for this command only; the runtime `.env` remains unchanged. The command fails if the migration secret is missing or empty.

```sh
DATABASE_URL="${MIGRATION_DATABASE_URL:?Load the migration DSN from your secret manager first}" npx prisma db push
```

Never put the migration DSN in `.env`, Vercel project environment variables, or source code. Remove it from the migration shell after use, or end the session. Run schema changes through a restricted migration job with an audit record of the actor and change, without logging credentials.

After the tables exist, have a database administrator create a new runtime account with a unique password and no inherited roles or other privileges. Grant only the following [table privilege](https://docs.pingcap.com/tidb/stable/privilege-management/), replacing placeholders with the actual database and full account name (including any TiDB Cloud prefix):

```sql
GRANT SELECT ON `<vercel-database>`.`User` TO '<vercel-runtime-user>'@'%';
SHOW GRANTS FOR '<vercel-runtime-user>'@'%';
```

Verify that neither direct grants nor assigned roles allow writes, schema changes, access to `Log` or other tables, or `GRANT OPTION`. A narrow `GRANT` does not remove existing broad privileges; replace or revoke an over-privileged account before deploying. Put only this runtime account's DSN in `.env` and the `DATABASE_URL` deployment secret. Use different accounts and passwords for each application and environment.

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

Deploy only the runtime DSN provisioned in step 3. Restrict who can manage secrets. To rotate the API token, generate a fresh value, update the secret, redeploy, and update trusted callers; the previous token stops working on the new deployment. Retire older deployments that still hold the old token. To rotate the database credential, provision a replacement with the same limited grants, update `DATABASE_URL`, redeploy and verify, then revoke the old database credential. If a real DSN was ever committed or logged, revoke it; removing it from the current file does not revoke it.

### 6. Test

Run `npm test` on Node.js 22 or later. Tests compile local TypeScript files to temporary CommonJS modules, mock the database through the module cache, and exercise the real entry point and Web Crypto, including rejected requests without database access, successful requests, and token rotation. They also assert that the Prisma query selects only IDs and limits results to 20, even when request query parameters try to expand access. Temporary files, module mocks, and environment changes are cleaned up after each test.

## How this example built

1. Install vercel cli: `npm install -g vercel`
2. Initialize project: `npx create-next-app@latest`
3. Set up prisma: `cd prisma-cloudflare-worker-example` and `npm install --save-dev prisma`
4. Init prisma: `npx prisma init --datasource-provider mysql`
5. Configure the runtime `.env` as described in step 1 above
6. Update schema.prisma file: use driverAdapters as this example does
7. Install dependencies: `npm install @tidbcloud/prisma-adapter @tidbcloud/serverless`
8. Configure postinstall hook: add a new key `"postinstall": "prisma generate"` to the scripts section in your package.json as this example
9. Sync the database schema with the migration-only command and provision runtime grants in step 3 above
10. Write Code: add `api/edge/route.js` file and write code as this example

## Next steps

- [Learn more about the prisma adapter](https://docs.pingcap.com/tidbcloud/serverless-driver-prisma-example)

