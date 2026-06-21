import { NextRequest, NextResponse } from 'next/server';
import { listProductionCaseAssets } from '@/lib/production-case-assets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || 12);
    const cases = listProductionCaseAssets({ limit });

    return NextResponse.json({
      success: true,
      cases,
      total: cases.length,
      source: 'productionProject.assets',
    });
  } catch (error) {
    console.error('获取制作案例资产失败:', error);
    return NextResponse.json(
      { success: false, error: '获取制作案例资产失败' },
      { status: 500 },
    );
  }
}
