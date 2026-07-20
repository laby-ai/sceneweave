export const PAPER_HOST_MESSAGE_TYPES = [
  'paper-host-ready',
  'paper-host-return',
  'paper-host-login-required',
  'paper-host-ready-ack',
  'paper-host-session-refresh',
] as const;

export type PaperHostMessageType = typeof PAPER_HOST_MESSAGE_TYPES[number];

export interface PaperHostMessage {
  type: PaperHostMessageType;
  version: 1;
  reason?: string;
}

interface MessageEnvelope {
  origin: string;
  data: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isMessageType = (value: unknown): value is PaperHostMessageType => (
  typeof value === 'string'
  && PAPER_HOST_MESSAGE_TYPES.some(type => type === value)
);

const isSafeReason = (value: unknown): value is string => (
  typeof value === 'string' && value.length > 0 && value.length <= 120
);

export function createPaperHostMessage(
  type: PaperHostMessageType,
  reason?: string,
): PaperHostMessage {
  if (!isMessageType(type)) throw new Error('unsupported paper host message type');
  if (reason !== undefined && !isSafeReason(reason)) {
    throw new Error('reason must contain 1 to 120 characters');
  }
  return reason === undefined
    ? { type, version: 1 }
    : { type, version: 1, reason };
}

export function parsePaperHostMessage(
  event: MessageEnvelope,
  expectedOrigin: string,
): PaperHostMessage | null {
  if (!expectedOrigin || event.origin !== expectedOrigin || !isRecord(event.data)) return null;

  const keys = Object.keys(event.data);
  if (keys.some(key => key !== 'type' && key !== 'version' && key !== 'reason')) return null;
  if (!isMessageType(event.data.type) || event.data.version !== 1) return null;
  if (event.data.reason !== undefined && !isSafeReason(event.data.reason)) return null;

  return createPaperHostMessage(event.data.type, event.data.reason);
}
