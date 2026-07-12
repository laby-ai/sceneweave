import { Config, LLMClient } from './native-provider-sdk';

export type MultimodalMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
};

export type ProviderChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function getClient() {
  return new LLMClient(new Config());
}

export async function providerChat(messages: MultimodalMessage[], options: ProviderChatOptions = {}) {
  return getClient().chat(messages, options);
}

export function providerChatStream(messages: MultimodalMessage[], options: ProviderChatOptions = {}) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await providerChat(messages, options);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: result.content })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function providerVisionChat(messages: MultimodalMessage[], options: ProviderChatOptions = {}) {
  return providerChat(messages, options);
}

export const ProviderAPI = {
  chat: providerChat,
  chatStream: providerChatStream,
  visionChat: providerVisionChat,
};
