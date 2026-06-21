import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SearchRequestBody {
  query: string;
  type?: 'web' | 'image';
  count?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequestBody = await request.json();
    const { query, type = 'web', count = 8 } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: '搜索关键词不能为空' }, { status: 400 });
    }

    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new SearchClient(config, customHeaders);

    // 搜索增强：为影视创作添加上下文关键词
    const filmQuery = type === 'image'
      ? query
      : `${query} 故事 剧情 角色 设定`;

    if (type === 'image') {
      const response = await client.imageSearch(filmQuery, count);
      const results = (response.image_items || []).map(item => ({
        id: item.id,
        title: item.title || '',
        source: item.site_name || '',
        url: item.url || '',
        imageUrl: item.image?.url || '',
        width: item.image?.width,
        height: item.image?.height,
      }));

      return NextResponse.json({
        type: 'image',
        results,
        copyrightNotice: '图片来源于网络，仅供创作参考，请勿直接使用受版权保护的图片',
      });
    } else {
      const response = await client.webSearchWithSummary(filmQuery, count);
      const results = (response.web_items || []).map(item => ({
        id: item.id,
        title: item.title,
        source: item.site_name || '',
        url: item.url || '',
        snippet: item.snippet || '',
        summary: item.summary || '',
        authority: item.auth_info_des || '',
        authorityLevel: item.auth_info_level || 0,
      }));

      return NextResponse.json({
        type: 'web',
        summary: response.summary || '',
        results,
        copyrightNotice: '内容来源于网络搜索，仅供创作灵感和参考，请勿直接复制受版权保护的原文。建议基于参考内容进行原创性改编。',
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '搜索失败';
    console.error('[Film Search] Error:', message);
    return NextResponse.json({ error: `搜索失败: ${message}` }, { status: 500 });
  }
}
