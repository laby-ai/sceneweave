export interface HuiyingObjectStorageRequirement {
  name: string;
  configured: boolean;
  configuredVia?: string;
  purpose: string;
}

export interface HuiyingObjectStorageEnv {
  endpointUrl?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
  requirements: HuiyingObjectStorageRequirement[];
}

const STORAGE_ENV_REQUIREMENTS = [
  {
    name: 'HUIYING_OBJECT_STORAGE_ENDPOINT_URL',
    key: 'endpointUrl',
    purpose: 'object storage endpoint for uploading generated assets and extracted tail frames',
  },
  {
    name: 'HUIYING_OBJECT_STORAGE_BUCKET_NAME',
    key: 'bucketName',
    purpose: 'object storage bucket for generated assets and extracted tail frames',
  },
  {
    name: 'HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID',
    key: 'accessKeyId',
    purpose: 'object storage upload credential id',
  },
  {
    name: 'HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY',
    key: 'secretAccessKey',
    purpose: 'object storage upload credential secret',
  },
] as const;

function readEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

export function getHuiyingObjectStorageEnv(): HuiyingObjectStorageEnv {
  const values: Record<string, string | undefined> = {};
  const requirements = STORAGE_ENV_REQUIREMENTS.map(item => {
    const primary = readEnv(item.name);
    const configuredVia = primary ? item.name : undefined;
    values[item.key] = primary;
    return {
      name: item.name,
      configured: Boolean(configuredVia),
      configuredVia,
      purpose: item.purpose,
    };
  });

  return {
    endpointUrl: values.endpointUrl,
    bucketName: values.bucketName,
    accessKeyId: values.accessKeyId,
    secretAccessKey: values.secretAccessKey,
    region: readEnv('HUIYING_OBJECT_STORAGE_REGION') || 'cn-beijing',
    requirements,
  };
}

export function createHuiyingObjectStorage() {
  // Keep the SDK out of readiness/health routes; they only need env status.
  // Load it only when an upload-capable path actually creates storage.
  const { S3Storage } = require('coze-coding-dev-sdk') as typeof import('coze-coding-dev-sdk');
  const env = getHuiyingObjectStorageEnv();
  return new S3Storage({
    endpointUrl: env.endpointUrl,
    accessKey: env.accessKeyId || '',
    secretKey: env.secretAccessKey || '',
    bucketName: env.bucketName,
    region: env.region,
  });
}
