import { NextRequest, NextResponse } from 'next/server';

const MAX_TEXT_LENGTH = 5000;
const FETCH_TIMEOUT_MS = 12_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 200) : undefined;
}

export async function POST(request: NextRequest) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '请提供有效的URL地址' }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: '仅支持 http/https URL' }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      signal: abortController.signal,
      headers: {
        accept: 'text/html,text/plain,application/json;q=0.8,*/*;q=0.5',
        'user-agent': 'HuiyingStudio/1.0 URL preview fetcher',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取URL内容失败: HTTP ${response.status}` },
        { status: 422 },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    const textContent = contentType.includes('text/html') ? stripHtml(raw) : raw.trim();
    const content = textContent.slice(0, MAX_TEXT_LENGTH);

    return NextResponse.json({
      success: true,
      content,
      data: {
        title: contentType.includes('text/html') ? extractTitle(raw) : undefined,
        url: parsedUrl.toString(),
        filetype: contentType,
        textContent: content,
        images: [],
        links: [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? '获取URL内容超时'
      : error instanceof Error ? error.message : '获取URL内容失败';
    console.error('[fetch-url] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
