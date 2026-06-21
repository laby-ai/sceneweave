import { BYOKApiBaseError } from '@/lib/byok-url';

export function isBYOKConfigError(error: unknown): error is BYOKApiBaseError {
  return error instanceof BYOKApiBaseError;
}

export function buildBYOKConfigErrorPayload(error: BYOKApiBaseError) {
  return {
    error: `用户供应商配置失败：${error.message}`,
    provider: 'byok' as const,
  };
}

export function buildBYOKConfigErrorResponse(error: BYOKApiBaseError): Response {
  return new Response(JSON.stringify(buildBYOKConfigErrorPayload(error)), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
