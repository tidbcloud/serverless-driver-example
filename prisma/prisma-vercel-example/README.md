# Run TiDB Serverless with Prisma on Vercel Edge functions

This repo is an example of how to run TiDB Serverless with Prisma on Vercel Edge functions

## How to run this example

### Prerequisites

Before running through the following steps, make sure you have:

1. Node.js installed on your machine
2. a Vercel account
3. a TiDB Serverless instance up and running and its connection string available
4. cd to the correct directory: `cd prisma/prisma-vercel-example`

### 1. Database URL setup

Create a `.env` file in the root of the project with the following content. You can get the connection string from the TiDB Serverless console.

```env
DATABASE_URL="mysql://<user>:<password>@<host>:4000/<database>?sslaccept=strict"
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

Visit /api/edge to see the result

```
vercel dev
```

### 5. Deploy to Vercel

Add environment variable DATABASE_URL

```
npx vercel env add DATABASE_URL 
```

Deploy to Vercel preview

```
vercel deploy
```

Deploy to Vercel prod

```
vercel --prod
```


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

