import { getHuiyingObjectStorageEnv } from './huiying-object-storage';
import { getPublicFrameHandoffReadiness } from './public-frame-handoff';
import { getVideoGenerationRunPlan } from './video-generation-run-plan';

export interface EnvRequirementStatus {
  name: string;
  configured: boolean;
  configuredVia?: string;
  purpose: string;
}

export interface CapabilityReadiness {
  ready: boolean;
  blockers: string[];
  requirements: EnvRequirementStatus[];
  note: string;
}

export function getObjectStorageReadiness(): CapabilityReadiness {
  const objectStorageEnv = getHuiyingObjectStorageEnv();
  const requirements = objectStorageEnv.requirements;
  const blockers = requirements
    .filter(item => !item.configured)
    .map(item => item.name);

  return {
    ready: blockers.length === 0,
    blockers,
    requirements,
    note: blockers.length === 0
      ? '对象存储已具备上传生成素材和分段尾帧的基础配置。'
      : '真实分段连续性需要把上一段尾帧上传为供应商可访问的图片 URL；缺少绘影对象存储配置时应在提交第二段前停止。',
  };
}

export function getBase64FrameHandoffReadiness(): CapabilityReadiness {
  const disabled = process.env.HUIYING_DISABLE_BASE64_FRAME_HANDOFF?.trim().toLowerCase() === 'true';
  const requirement = {
    name: 'HUIYING_DISABLE_BASE64_FRAME_HANDOFF',
    configured: !disabled,
    configuredVia: disabled ? undefined : 'default-enabled',
    purpose: 'fallback channel that passes extracted last frame as data:image/jpeg;base64 in Ark image_url.url',
  };

  return {
    ready: !disabled,
    blockers: disabled ? ['HUIYING_DISABLE_BASE64_FRAME_HANDOFF'] : [],
    requirements: [requirement],
    note: disabled
      ? 'base64 尾帧 handoff 已被显式禁用。'
      : '对象存储和公网 URL 不可用时，可把本地抽出的尾帧编码为 data:image/jpeg;base64 交给 Ark 下一段 first_frame。',
  };
}

function capabilityFromPublicFrameHandoff(): CapabilityReadiness {
  const publicFrameHandoff = getPublicFrameHandoffReadiness();
  return {
    ready: publicFrameHandoff.ready,
    blockers: publicFrameHandoff.blockers,
    requirements: [
      {
        name: 'HUIYING_PUBLIC_ASSET_BASE_URL',
        configured: publicFrameHandoff.ready,
        configuredVia: publicFrameHandoff.ready ? 'HUIYING_PUBLIC_ASSET_BASE_URL | HUIYING_PROJECT_DOMAIN_DEFAULT' : undefined,
        purpose: 'provider-readable HTTPS URL for locally extracted tail frames',
      },
    ],
    note: publicFrameHandoff.note,
  };
}

function combinedAlternativeCapability(
  name: string,
  capabilities: Array<{ label: string; capability: CapabilityReadiness }>,
  readyNote: string,
  blockedNote: string
): CapabilityReadiness {
  const ready = capabilities.find(item => item.capability.ready);
  return {
    ready: Boolean(ready),
    blockers: ready ? [] : capabilities.flatMap(item => item.capability.blockers),
    requirements: [
      {
        name,
        configured: Boolean(ready),
        configuredVia: ready?.label,
        purpose: capabilities.map(item => item.capability.note).join(' / '),
      },
    ],
    note: ready ? readyNote : blockedNote,
  };
}

export function getProductionRuntimeReadiness() {
  const objectStorage = getObjectStorageReadiness();
  const publicFrameHandoff = getPublicFrameHandoffReadiness();
  const publicFrameHandoffCapability = capabilityFromPublicFrameHandoff();
  const base64FrameHandoff = getBase64FrameHandoffReadiness();
  const handoffUpload = combinedAlternativeCapability(
    'HUIYING_HANDOFF_UPLOAD_CHANNEL',
    [
      { label: 'object-storage', capability: objectStorage },
      { label: 'public-frame-handoff', capability: publicFrameHandoffCapability },
      { label: 'base64-data-url', capability: base64FrameHandoff },
    ],
    '多段 handoff 至少有一个尾帧回传通道可用。',
    '多段 handoff 缺少对象存储、公网 HTTPS 或 base64 尾帧回传通道。'
  );
  const durableHandoff = combinedAlternativeCapability(
    'HUIYING_DURABLE_HANDOFF_CHANNEL',
    [
      { label: 'object-storage', capability: objectStorage },
      { label: 'public-frame-handoff', capability: publicFrameHandoffCapability },
    ],
    '60s/商用长链路具备对象存储或公网 HTTPS 尾帧通道。',
    '60s/商用长链路不应只依赖 base64 data URL；需要对象存储或公网 HTTPS 尾帧通道。'
  );
  return {
    objectStorage,
    publicFrameHandoff,
    base64FrameHandoff,
    handoffUpload,
    durableHandoff,
    realSegmentHandoff: {
      ready: handoffUpload.ready,
      blockers: handoffUpload.blockers,
      note: handoffUpload.ready
        ? '多段短剧可通过对象存储、公网 public frame handoff 或 base64 data URL 把 lastFrame 交给下一段 firstFrame。'
        : '当前只能证明队列/写回结构，不能保证真实多段视频画面连续；请先补齐对象存储配置、HUIYING_PUBLIC_ASSET_BASE_URL 公网 HTTPS 地址，或启用 base64 frame handoff。',
    },
    videoGenerationRunPlan: getVideoGenerationRunPlan({
      objectStorage,
      handoffUpload,
      durableHandoff,
    }),
  };
}
