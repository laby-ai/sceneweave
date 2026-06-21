/**
 * 公开音乐库 API
 *
 * GET /api/bgm/library  — 搜索/浏览音乐库
 *   参数: query, category, mood, minDuration, maxDuration, page, pageSize
 * GET /api/bgm/library/[id]  — 获取单首曲目详情
 * GET /api/bgm/library/categories  — 获取所有分类统计
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchLibrary,
  getTrackById,
  getLibraryCategories,
  type LibrarySearchParams,
} from '@/constants/music-library';

// ============================================================
// GET /api/bgm/library — 搜索和浏览
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // 检查是否为分类列表请求
    if (searchParams.get('action') === 'categories') {
      const categories = getLibraryCategories();
      return NextResponse.json({
        success: true,
        categories,
      });
    }

    // 构建搜索参数
    const params: LibrarySearchParams = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      mood: searchParams.get('mood') || undefined,
      minDuration: searchParams.get('minDuration')
        ? Number(searchParams.get('minDuration'))
        : undefined,
      maxDuration: searchParams.get('maxDuration')
        ? Number(searchParams.get('maxDuration'))
        : undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      pageSize: searchParams.get('pageSize')
        ? Math.min(Number(searchParams.get('pageSize')), 50)
        : 12,
    };

    const result = searchLibrary(params);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[MusicLibrary API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '音乐库查询失败' },
      { status: 500 }
    );
  }
}
