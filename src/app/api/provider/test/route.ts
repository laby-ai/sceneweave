import { NextResponse } from 'next/server';
import { normalizeBYOKApiBase } from '@/lib/byok-url';

type ProviderType = 'openai-compatible' | 'ark-plan';

interface ProviderTestBody {
  provider?: ProviderType;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  testMode?: 'auto' | 'models' | 'chat' | 'image';
}

function apiBaseHasVersionPath(apiBase: string): boolean {
  const pathname = new URL(apiBase).pathname.replace(/\/+$/, '');
  return /\/v\d+(?:\/.*)?$/.test(pathname) || pathname.endsWith('/v1') || pathname.endsWith('/v3');
}

function buildModelsUrl(provider: ProviderType, apiBase: string): string {
  if (provider === 'openai-compatible' || provider === 'ark-plan') {
    return apiBaseHasVersionPath(apiBase) ? `${apiBase}/models` : `${apiBase}/v1/models`;
  }
  return `${apiBase}/v1/models`;
}

function buildChatCompletionsUrl(provider: ProviderType, apiBase: string): string {
  if (provider === 'openai-compatible' || provider === 'ark-plan') {
    return apiBaseHasVersionPath(apiBase) ? `${apiBase}/chat/completions` : `${apiBase}/v1/chat/completions`;
  }
  return apiBaseHasVersionPath(apiBase) ? `${apiBase}/chat/completions` : `${apiBase}/v1/chat/completions`;
}

function buildImageGenerationsUrl(provider: ProviderType, apiBase: string): string {
  if (provider === 'openai-compatible' || provider === 'ark-plan') {
    return apiBaseHasVersionPath(apiBase) ? `${apiBase}/images/generations` : `${apiBase}/v1/images/generations`;
  }
  return apiBaseHasVersionPath(apiBase) ? `${apiBase}/images/generations` : `${apiBase}/v1/images/generations`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text.slice(0, 200);
  }
}

function payloadError(payload: unknown, status: number): string {
  return typeof payload === 'object' && payload && 'error' in payload
    ? JSON.stringify((payload as { error: unknown }).error)
    : `HTTP ${status}`;
}

async function runChatCompletionProbe({
  provider,
  apiBase,
  apiKey,
  model,
  signal,
}: {
  provider: ProviderType;
  apiBase: string;
  apiKey: string;
  model: string;
  signal: AbortSignal;
}) {
  const probeUrl = buildChatCompletionsUrl(provider, apiBase);
  const response = await fetch(probeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
    }),
    signal,
  });
  const payload = await parseResponsePayload(response);
  return { response, payload, probeUrl };
}

async function runImageGenerationProbe({
  provider,
  apiBase,
  apiKey,
  model,
  signal,
}: {
  provider: ProviderType;
  apiBase: string;
  apiKey: string;
  model: string;
  signal: AbortSignal;
}) {
  const probeUrl = buildImageGenerationsUrl(provider, apiBase);
  const response = await fetch(probeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: 'minimal product readiness probe: a single blue dot on black background',
      size: '1024x1024',
      n: 1,
    }),
    signal,
  });
  const payload = await parseResponsePayload(response);
  return { response, payload, probeUrl };
}

export async function POST(request: Request) {
  let body: ProviderTestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: '请求体不是有效 JSON' }, { status: 400 });
  }

  const provider = body.provider || 'openai-compatible';
  const apiKey = body.apiKey?.trim();
  const model = body.model?.trim();
  const testMode = body.testMode || 'auto';

  if (!['auto', 'models', 'chat', 'image'].includes(testMode)) {
    return NextResponse.json({ ok: false, error: '测试模式不合法' }, { status: 400 });
  }

  if (provider !== 'openai-compatible' && provider !== 'ark-plan') {
    return NextResponse.json(
      { ok: false, error: '当前只支持 OpenAI 兼容或火山 Ark BYOK 连接' },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: '缺少 API Key' }, { status: 400 });
  }

  let apiBase: string;
  try {
    apiBase = normalizeBYOKApiBase(body.apiBase || '');
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'API Base 不合法' },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    if (testMode === 'chat') {
      if (!model) {
        return NextResponse.json(
          { ok: false, error: '请先填写默认模型，再测试文本请求' },
          { status: 400 }
        );
      }

      const { response, payload, probeUrl } = await runChatCompletionProbe({
        provider,
        apiBase,
        apiKey,
        model,
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: response.status,
            error: `模型调用失败：${payloadError(payload, response.status)}`,
            testedUrl: probeUrl,
            testMode: 'chat-completions',
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        provider,
        apiBase,
        model,
        modelCount: undefined,
        testMode: 'chat-completions',
        message: '最小文本请求验证通过',
      });
    }

    if (testMode === 'image') {
      if (!model) {
        return NextResponse.json(
          { ok: false, error: '请先填写图片模型，再测试图片请求' },
          { status: 400 }
        );
      }

      const { response, payload, probeUrl } = await runImageGenerationProbe({
        provider,
        apiBase,
        apiKey,
        model,
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: response.status,
            error: `图片调用失败：${payloadError(payload, response.status)}`,
            testedUrl: probeUrl,
            testMode: 'images-generations',
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        provider,
        apiBase,
        model,
        modelCount: undefined,
        testMode: 'images-generations',
        message: '最小图片请求验证通过',
      });
    }

    const modelsUrl = buildModelsUrl(provider, apiBase);
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      if (testMode === 'auto' && model && (provider === 'openai-compatible' || provider === 'ark-plan')) {
        const { response: probeResponse, payload: probePayload, probeUrl } = await runChatCompletionProbe({
          provider,
          apiBase,
          apiKey,
          model,
          signal: controller.signal,
        });
        if (probeResponse.ok) {
          return NextResponse.json({
            ok: true,
            provider,
            apiBase,
            model,
            modelCount: undefined,
            testMode: 'chat-completions',
            message: '模型调用验证通过',
          });
        }
        return NextResponse.json(
          {
            ok: false,
            status: probeResponse.status,
            error: `模型调用失败：${payloadError(probePayload, probeResponse.status)}`,
            testedUrl: probeUrl,
            modelsTestedUrl: modelsUrl,
          },
          { status: 502 }
        );
      }
      const errorMessage = payloadError(payload, response.status);
      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          error: `连接失败：${errorMessage}`,
          testedUrl: modelsUrl,
        },
        { status: 502 }
      );
    }

    const modelCount =
      typeof payload === 'object' &&
      payload &&
      'data' in payload &&
      Array.isArray((payload as { data: unknown }).data)
        ? (payload as { data: unknown[] }).data.length
        : undefined;

    return NextResponse.json({
      ok: true,
      provider,
      apiBase,
      model: model || null,
      modelCount,
      testMode: 'models',
      message: 'API 连接验证通过',
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? '连接超时，请检查 API Base 或网络'
      : error instanceof Error
        ? (error.message === 'fetch failed' ? '连接失败，请检查 API Base、网络或服务是否可访问' : error.message)
        : '连接验证失败';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
