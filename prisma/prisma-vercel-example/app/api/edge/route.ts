import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import {connect} from "@tidbcloud/serverless";
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter';
import { PrismaClient } from '@prisma/client'
import { authenticate } from './auth';

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {

  const denied = await authenticate(request, process.env.API_AUTH_TOKEN);
  if (denied) return denied;
  if (!process.env.DATABASE_URL) {
    return new Response('Service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const connection = connect( {url: process.env.DATABASE_URL} );
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany()

  return NextResponse.json(users, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
