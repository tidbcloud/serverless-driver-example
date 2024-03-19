import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import {connect} from "@tidbcloud/serverless";
import { PrismaTiDBCloud } from '@tidbcloud/prisma-adapter';
import { PrismaClient } from '@prisma/client'

export const runtime = 'edge'

export async function GET(request: NextRequest) {

  const connection = connect( {url: process.env.DATABASE_URL} );
  const adapter = new PrismaTiDBCloud(connection);
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany()

  return NextResponse.json(users, { status: 200 })
}