export interface VimaxImageSelectorConfig {
  selectorApiBase?: string;
  selectorApiKey?: string;
  selectorModel?: string;
}

export function isVimaxImageSelectorReady(config: VimaxImageSelectorConfig) {
  return Boolean(config.selectorApiBase && config.selectorApiKey && config.selectorModel);
}

export async function selectVimaxBestImageCandidate(input: {
  targetDescription: string;
  referenceImages: string[];
  candidateUrls: string[];
  config: VimaxImageSelectorConfig;
  signal?: AbortSignal;
}) {
  const { selectorApiBase, selectorApiKey, selectorModel } = input.config;
  if (!selectorApiBase || !selectorApiKey || !selectorModel || input.candidateUrls.length < 2) {
    return { index: 0, reason: '单候选直接采用。' };
  }
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        '目标画面描述：',
        input.targetDescription,
        '请优先判断人物身份与服饰、空间方向、动作和目标描述的一致性。',
        '只返回 JSON：{"best_image_index":0,"reason":"理由"}。',
      ].join('\n'),
    },
  ];
  input.referenceImages.forEach((url, index) => {
    content.push({ type: 'text', text: `主体参考图 ${index + 1}` });
    content.push({ type: 'image_url', image_url: { url } });
  });
  input.candidateUrls.forEach((url, index) => {
    content.push({ type: 'text', text: `候选图 ${index}` });
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await fetch(`${selectorApiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${selectorApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectorModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是影视首帧一致性评估器。客观比较候选图，不按个人审美选择。',
        },
        { role: 'user', content },
      ],
    }),
    signal: input.signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { index: 0, reason: '一致性筛选暂不可用，已保留首个成功候选。' };
  const raw = data?.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '')) as {
      best_image_index?: unknown;
      reason?: unknown;
    };
    const index = Number(parsed.best_image_index);
    if (Number.isInteger(index) && index >= 0 && index < input.candidateUrls.length) {
      return {
        index,
        reason: typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : '已按主体、空间与描述一致性选择。',
      };
    }
  } catch {
    // Keep the first successful candidate when the selector does not return valid JSON.
  }
  return { index: 0, reason: '一致性筛选结果无效，已保留首个成功候选。' };
}
