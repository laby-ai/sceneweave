import { randomUUID } from 'node:crypto';
import {
  AccountEntitlementClient,
  QuotaInsufficientError,
  estimateTextUnits,
} from './account-entitlement-client';

/**
 * 绘影付费动作的计费包装：reserve → 调模型 → settle / release。
 * 与 airai.world 共享同一套账号中台。未配置中台凭证时返回 null（本地开发/根路径
 * 部署时计费链路自动旁路，不阻塞功能）。
 */

export type BillingProductArea = 'ai.text' | 'ai.image' | 'ai.video' | 'ai.agent';

type AIUsageReservationOptions = {
  /** 路由标识，用于拼 requestId，便于在中台账本里溯源。 */
  route: string;
  productArea: BillingProductArea;
  modelName: string;
  /** 直接给计费单位（图片张数、视频秒数/任务数等）；不传则用文本长度估算。 */
  units?: number;
  inputText?: string;
  /** 调用者成员 ID（来自登录会话）；不传回退到默认成员。 */
  memberId?: string;
};

export type AIUsageReservation = {
  requestId: string;
  reservedUnits: number;
  settle: (actualUnits?: number) => Promise<void>;
  release: () => Promise<void>;
};

function envValue(name: string): string {
  return process.env[name]?.trim() || '';
}

function createAccountClient(): AccountEntitlementClient | null {
  const baseUrl = envValue('ACCOUNT_CENTER_API_BASE');
  const appKey = envValue('ACCOUNT_CENTER_APP_KEY');
  const credentialKey = envValue('ACCOUNT_CENTER_CREDENTIAL_KEY');
  const clientSecret = envValue('ACCOUNT_CENTER_CLIENT_SECRET');
  if (!baseUrl || !appKey || !credentialKey || !clientSecret) return null;
  return new AccountEntitlementClient({ baseUrl, appKey, credentialKey, clientSecret });
}

export function isAccountBillingConfigured(memberId?: string): boolean {
  return Boolean(
    envValue('ACCOUNT_CENTER_API_BASE') &&
    envValue('ACCOUNT_CENTER_TENANT_ID') &&
    (memberId || envValue('ACCOUNT_CENTER_DEFAULT_MEMBER_ID')) &&
    envValue('ACCOUNT_CENTER_APP_KEY') &&
    envValue('ACCOUNT_CENTER_CREDENTIAL_KEY') &&
    envValue('ACCOUNT_CENTER_CLIENT_SECRET'),
  );
}

function resolveUnits(options: AIUsageReservationOptions): number {
  if (typeof options.units === 'number' && options.units > 0) return Math.floor(options.units);
  return estimateTextUnits(options.inputText || '');
}

/**
 * 预占额度。返回 null = 未配置计费（旁路放行）；抛 QuotaInsufficientError = 额度不足（应拒绝并提示充值）。
 */
export async function reserveAIUsage(options: AIUsageReservationOptions): Promise<AIUsageReservation | null> {
  if (!isAccountBillingConfigured(options.memberId)) return null;

  const client = createAccountClient();
  const tenantId = envValue('ACCOUNT_CENTER_TENANT_ID');
  const memberId = options.memberId || envValue('ACCOUNT_CENTER_DEFAULT_MEMBER_ID');
  if (!client || !tenantId || !memberId) return null;

  const requestId = `huiying:${options.route}:${randomUUID()}`;
  const reservedUnits = resolveUnits(options);
  const response = await client.reserve({
    tenantId,
    memberId,
    requestId,
    productArea: options.productArea,
    modelName: options.modelName,
    units: reservedUnits,
  });
  const reservationId = response.reservation?.id;
  if (!reservationId) return null;

  return {
    requestId,
    reservedUnits,
    settle: async (actualUnits?: number) => {
      const billed = Math.min(
        typeof actualUnits === 'number' && actualUnits > 0 ? Math.floor(actualUnits) : reservedUnits,
        reservedUnits,
      );
      await client.settle({ tenantId, reservationId, requestId, actualUnits: billed });
    },
    release: async () => {
      await client.release({ tenantId, reservationId, requestId });
    },
  };
}

export { QuotaInsufficientError };
