export type JimengConvertMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type JimengConvertOptions = {
  model: string;
  temperature: number;
};

export type JimengConvertResponse = {
  content?: unknown;
};

export type JimengConvertLLM = {
  invoke(messages: JimengConvertMessage[], options: JimengConvertOptions): Promise<JimengConvertResponse>;
};

export class JimengConvertProviderError extends Error {
  status?: number;
  code?: string;

  constructor(error: unknown) {
    super(error instanceof Error ? error.message : 'Jimeng convert provider request failed');
    this.name = 'JimengConvertProviderError';

    if (typeof error === 'object' && error) {
      const maybeError = error as { status?: number; code?: string };
      this.status = maybeError.status;
      this.code = maybeError.code;
    }
  }
}

export function isJimengConvertProviderError(error: unknown): error is JimengConvertProviderError {
  return error instanceof JimengConvertProviderError;
}

export async function createJimengConvertLLM(headers: Headers): Promise<JimengConvertLLM> {
  const { LLMClient, Config, HeaderUtils, APIError } = await import('coze-coding-dev-sdk');
  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  const client = new LLMClient(new Config(), customHeaders);

  return {
    async invoke(messages, options) {
      try {
        return await client.invoke(messages as any, options as any);
      } catch (error) {
        if (error instanceof APIError) {
          throw new JimengConvertProviderError(error);
        }
        throw error;
      }
    },
  };
}
