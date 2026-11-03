/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import {connect} from "@tidbcloud/serverless";
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter';
import { PrismaClient } from '@prisma/client'
import { authenticate } from './auth';

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
	DATABASE_URL: string
	API_AUTH_TOKEN: string
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const denied = await authenticate(request, env.API_AUTH_TOKEN);
		if (denied) return denied;
		if (!env.DATABASE_URL) {
			return new Response('Service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
		}

		const config = {
			url: env.DATABASE_URL,
		}

		const connection = connect( config );
		const adapter = new PrismaTiDBCloud(connection);
		const prisma = new PrismaClient({ adapter });


		await prisma.log.create({
			data: {
				level: 'Info',
				message: `${request.method} ${new URL(request.url).pathname}`,
				meta: {},
			},
		})

		const logs = await prisma.log.findMany({
			take: 20,
			orderBy: {
				id: 'desc',
			},
		})

		return new Response(JSON.stringify(logs), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
		})
	},
};
