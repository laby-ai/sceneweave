import { BYOKApiBaseError } from '@/lib/byok-url';
import { MemberBailianProfileRequiredError } from '@/lib/account/member-bailian-profile';

export type BYOKConfigError = BYOKApiBaseError | MemberBailianProfileRequiredError;

export function isBYOKConfigError(error: unknown): error is BYOKConfigError {
  return error instanceof BYOKApiBaseError || error instanceof MemberBailianProfileRequiredError;
}

export function buildBYOKConfigErrorPayload(error: BYOKConfigError) {
  return {
    error: error instanceof MemberBailianProfileRequiredError
      ? error.message
      : `用户供应商配置失败：${error.message}`,
    code: error instanceof MemberBailianProfileRequiredError ? error.code : 'byok_config_invalid',
    provider: error instanceof MemberBailianProfileRequiredError ? 'aliyun-bailian' as const : 'byok' as const,
  };
}

export function byokConfigErrorStatus(error: BYOKConfigError): number {
  return error instanceof MemberBailianProfileRequiredError ? error.status : 400;
}

export function buildBYOKConfigErrorResponse(error: BYOKConfigError): Response {
  return new Response(JSON.stringify(buildBYOKConfigErrorPayload(error)), {
    status: byokConfigErrorStatus(error),
    headers: { 'Content-Type': 'application/json' },
  });
}
