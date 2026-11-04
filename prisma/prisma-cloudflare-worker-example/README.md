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

Create a `.env` file in the root of the project with the following content. Use a dedicated runtime database account for this Worker and environment, separate from the Vercel example and the migration account. Step 3 describes its permissions. You can get the connection details from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<worker-runtime-user>:<runtime-password>@<host>:4000/<worker-database>?sslaccept=strict"
API_AUTH_TOKEN="<paste a newly generated token here>"
```

Generate the token with `openssl rand -hex 32`. It must contain at least 32 non-whitespace characters. Keep `.env` private and untracked. Copy it to `.dev.vars` for `wrangler dev`; Prisma CLI reads `.env`. Never put either secret in `wrangler.toml` or source code.

This example authenticates one trusted service identity using `Authorization: Bearer <token>`. Anyone holding this token can write logs and read the latest 20 logs. It is for trusted server-to-server callers, not a multi-user application: it does not provide per-user identity or data isolation. Do not embed the token in browser JavaScript or pass credentials in URLs. Use HTTPS outside local development.

Missing or invalid credentials return 401 before any database access. A missing/short token or missing database URL fails closed with 503. Responses use `Cache-Control: no-store`. Request headers and query strings are not persisted in new log entries.

### 2. Install dependencies

```
npm install
```

### 3. Sync the database schema with a separate migration account

In a trusted migration shell or CI job, load `MIGRATION_DATABASE_URL` from your secret manager for a separate account with schema-change permissions limited to this example's database. Disable shell tracing. Override `DATABASE_URL` for this command only; the runtime `.env` remains unchanged. The command fails if the migration secret is missing or empty.

```sh
DATABASE_URL="${MIGRATION_DATABASE_URL:?Load the migration DSN from your secret manager first}" npx prisma db push
```

Never put the migration DSN in `.env`, `.dev.vars`, `wrangler.toml`, or deployed Worker bindings. Remove it from the migration shell after use, or end the session. Run schema changes through a restricted migration job with an audit record of the actor and change, without logging credentials.

After the tables exist, have a database administrator create a new runtime account with a unique password and no inherited roles or other privileges. Grant only the following [table privileges](https://docs.pingcap.com/tidb/stable/privilege-management/), replacing placeholders with the actual database and full account name (including any TiDB Cloud prefix):

```sql
GRANT SELECT, INSERT ON `<worker-database>`.`Log` TO '<worker-runtime-user>'@'%';
SHOW GRANTS FOR '<worker-runtime-user>'@'%';
```

Verify that neither direct grants nor assigned roles allow schema changes, access to `User` or other tables, or `GRANT OPTION`. A narrow `GRANT` does not remove existing broad privileges; replace or revoke an over-privileged account before deploying. Put only this runtime account's DSN in `.env`, `.dev.vars`, and the `DATABASE_URL` deployment secret. Use different accounts and passwords for each application and environment.

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

Deploy only the runtime DSN provisioned in step 3. Restrict who can manage secrets. To rotate the API token, generate a fresh value, update the secret, and update trusted callers; the previous token stops working. To rotate the database credential, provision a replacement with the same limited grants, update `DATABASE_URL`, verify the deployment, then revoke the old database credential. If a real DSN was ever committed or logged, revoke it; removing it from the current file does not revoke it. Review and remove existing sensitive log records separately.

### 6. Test

Run `npm test` on Node.js 22 or later. Tests compile local TypeScript files to temporary CommonJS modules, mock the database through the module cache, and exercise the real entry point and Web Crypto, including rejected requests without database access, successful requests, and token rotation. Temporary files, module mocks, and environment changes are cleaned up after each test.

## How this example built

1. Initialize project: `npm create cloudflare@latest prisma-cloudflare-worker-example -- --type hello-world`
2. Set up prisma: `cd prisma-cloudflare-worker-example` and `npm install --save-dev prisma`
3. Init prisma: `npx prisma init --datasource-provider mysql`
4. Configure the runtime `.env` as described in step 1 above
5. Update schema.prisma file: use `driverAdapters` as this example does
6. Sync the database schema with the migration-only command and provision runtime grants in step 3 above
7. Configure DATABASE_URL and API_AUTH_TOKEN as secrets as described above
8. Install dependencies: `npm install @tidbcloud/prisma-adapter @tidbcloud/serverless`
9. Write Code: write code in src/index.js file as this example does

## Next steps

- [Learn more about the prisma adapter](https://docs.pingcap.com/tidbcloud/serverless-driver-prisma-example)

