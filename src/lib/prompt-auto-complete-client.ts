type PromptAutoCompleteMessage = {
  role: 'system' | 'user';
  content: string;
};

export class PromptAutoCompleteProviderError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'PromptAutoCompleteProviderError';
    this.statusCode = statusCode;
  }
}

export function isPromptAutoCompleteProviderError(error: unknown): error is PromptAutoCompleteProviderError {
  return error instanceof PromptAutoCompleteProviderError;
}

export async function invokePromptAutoComplete(
  messages: PromptAutoCompleteMessage[],
  headers: Headers
): Promise<string> {
  const { LLMClient, Config, HeaderUtils, APIError } = await import('coze-coding-dev-sdk');

  try {
    const customHeaders = HeaderUtils.extractForwardHeaders(headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.8,
    });

    return response.content.trim();
  } catch (error: unknown) {
    if (error instanceof APIError) {
      throw new PromptAutoCompleteProviderError(error.message, error.statusCode);
    }
    throw error;
  }
}
