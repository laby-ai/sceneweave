import { NextRequest } from 'next/server';
import { extractBYOKConnection, type BYOKConnection } from '@/lib/byok-provider';
import { buildBYOKConfigErrorResponse, isBYOKConfigError } from '@/lib/byok-response';
import type { CreateScriptRequest } from '@/types/film';
import { createFilmScriptStream } from '@/lib/film-create-script-service';

function createSSEErrorStream(error: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`));
      controller.close();
    },
  });
}

function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
    },
  });
}

export async function POST(request: NextRequest) {
  let byokConnection: BYOKConnection | undefined;

  try {
    byokConnection = extractBYOKConnection(request.headers);
  } catch (error) {
    if (isBYOKConfigError(error)) {
      return buildBYOKConfigErrorResponse(error);
    }
    throw error;
  }

  let body: CreateScriptRequest;
  try {
    body = await request.json();
  } catch {
    return createSSEResponse(createSSEErrorStream('请求体不是合法 JSON'));
  }

  return createSSEResponse(createFilmScriptStream(body, byokConnection));
}
