/**
 * TTS 音色试听 API
 *
 * 接收音色名称，生成短句试听音频并返回 URL。
 * 支持当前显式音频服务预览。
 */
import { NextRequest, NextResponse } from 'next/server';
import { ttsOrchestrate } from '@/lib/tts-orchestrator';

/** 音色名称 -> 默认 speaker hint */
const VOICE_TO_SPEAKER: Record<string, string> = {
  '女声-温柔': 'zh_female_xiaohe_uranus_bigtts',
  '女声-活力': 'zh_female_shuangkuaisi_moon_bigtts',
  '女声-甜美': 'zh_female_tianmei_moon_bigtts',
  '女声-成熟': 'zh_female_xiaohe_uranus_bigtts',
  '女声-童声': 'zh_female_tianmei_moon_bigtts',
  '男声-沉稳': 'zh_male_chunlv_moon_bigtts',
  '男声-磁性': 'zh_male_tianshu_moon_bigtts',
  '男声-青年': 'zh_male_chunlv_moon_bigtts',
  '男声-老年': 'zh_male_tianshu_moon_bigtts',
  '男声-童声': 'zh_male_chunlv_moon_bigtts',
};

/** 默认 speaker */
const DEFAULT_SPEAKER = 'zh_female_xiaohe_uranus_bigtts';

/** 试听文本（短句） */
const PREVIEW_TEXT: Record<string, string> = {
  '女声-温柔': '微风轻拂，带来远方花开的温柔气息。',
  '女声-活力': '每一天都是全新的开始，让我们一起加油！',
  '女声-甜美': '今天天气真好，一起去公园散步吧！',
  '女声-成熟': '时光沉淀了智慧，岁月赋予了从容。',
  '女声-童声': '小兔子乖乖，把门儿开开，快点儿开开，我要进来。',
  '男声-沉稳': '历史的长河中，每一个选择都塑造着未来。',
  '男声-磁性': '夜色深沉，星河璀璨，每颗星都有自己的故事。',
  '男声-青年': '青春就是最好的资本，勇敢地去追寻梦想吧！',
  '男声-老年': '年轻人啊，记住，走过的路才是最宝贵的财富。',
  '男声-童声': '一闪一闪亮晶晶，满天都是小星星。',
};

const DEFAULT_PREVIEW_TEXT = '你好，这是音色试听效果。';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voiceType } = body;
    // 可选自定义文本：用于「配音生成」（用户任意文本）；不传则走音色试听短句。
    const customText = typeof body.text === 'string' ? body.text.trim() : '';
    const speechSpeed = typeof body.speechSpeed === 'number' ? body.speechSpeed : 1;

    if (!voiceType || typeof voiceType !== 'string') {
      return NextResponse.json({ error: '请提供音色名称(voiceType)' }, { status: 400 });
    }

    const speakerId = VOICE_TO_SPEAKER[voiceType] || DEFAULT_SPEAKER;
    const previewText = customText ? customText.slice(0, 1000) : (PREVIEW_TEXT[voiceType] || DEFAULT_PREVIEW_TEXT);

    try {
      const result = await ttsOrchestrate(previewText, voiceType, {
        speechSpeed,
      });

      if (result.success && result.audioBase64) {
        // 编排器返回 base64 音频，转为 data URL
        const dataUrl = `data:audio/mp3;base64,${result.audioBase64}`;
        return NextResponse.json({
          success: true,
          voiceType,
          speaker: speakerId,
          url: dataUrl,
          text: previewText,
          provider: result.provider,
          isBase64: true,
        });
      }
    } catch (e) {
      console.warn('[TTS Preview] TTS orchestrator failed:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ error: '语音合成失败，请稍后重试' }, { status: 500 });
  } catch (error) {
    console.error('[TTS Preview] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    voices: Object.keys(VOICE_TO_SPEAKER).map(v => ({
      name: v,
      speaker: VOICE_TO_SPEAKER[v],
      previewText: PREVIEW_TEXT[v] || DEFAULT_PREVIEW_TEXT,
    })),
  });
}
