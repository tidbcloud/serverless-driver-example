# Run TiDB Serverless with Prisma on Cloudflare Worker

This repo is an example of how to run TiDB Serverless with Prisma on Cloudflare Worker.

## How to run this example

### Prerequisites

Before running through the following steps, make sure you have:

1. Node.js installed on your machine
2. a Cloudflare account
3. a TiDB Serverless instance up and running and its connection string available
4. cd to the correct directory: `cd prisma/prisma-cloudflare-worker-example`

### 1. Database URL setup

Create a `.env` file in the root of the project with the following content. You can get the connection string from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict"
```

In the wrangler.toml file, add the following environment variable:

```toml
[vars]
DATABASE_URL = "mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict"
```

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

### 5. Deploy to Cloudflare Worker

```
npm run deploy
```

## How this example built

1. Initialize project: `npm create cloudflare@latest prisma-cloudflare-worker-example -- --type hello-world`
2. Set up prisma: `cd prisma-cloudflare-worker-example` and `npm install --save-dev prisma`
3. Init prisma: `npx prisma init --datasource-provider mysql`
4. Update .env file: `DATABASE_URL=mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict`
5. Update schema.prisma file: use `driverAdapters` as this example does
6. Sync db schema: `npx prisma db push`
7. Update wrangler.toml file: add DATABASE_URL vars
8. Install dependencies: `npm install @tidbcloud/prisma-adapter @tidbcloud/serverless`
9. Write Code: write code in src/index.js file as this example does

## Next steps

- [Learn more about the prisma adapter](https://docs.pingcap.com/tidbcloud/serverless-driver-prisma-example)

