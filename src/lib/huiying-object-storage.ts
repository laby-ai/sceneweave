import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  const env = getHuiyingObjectStorageEnv();
  if (!env.endpointUrl || !env.bucketName || !env.accessKeyId || !env.secretAccessKey) {
    const unavailable = async () => {
      throw new Error('object_storage_not_configured');
    };
    return {
      uploadFile: unavailable,
      uploadFromUrl: unavailable,
      generatePresignedUrl: unavailable,
      fileExists: unavailable,
      listFiles: unavailable,
    };
  }
  const client = new S3Client({
    endpoint: env.endpointUrl,
    region: env.region,
    forcePathStyle: true,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
  });

  return {
    async uploadFile(input: { fileContent: Uint8Array | Buffer; fileName: string; contentType?: string }) {
      const key = input.fileName.replace(/^\/+/, '');
      await new Upload({
        client,
        params: {
          Bucket: env.bucketName,
          Key: key,
          Body: input.fileContent,
          ContentType: input.contentType,
        },
      }).done();
      return key;
    },
    async uploadFromUrl(input: { url: string; timeout?: number }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeout || 120_000);
      try {
        const response = await fetch(input.url, { signal: controller.signal });
        if (!response.ok) throw new Error(`object_storage_source_http_${response.status}`);
        const content = Buffer.from(await response.arrayBuffer());
        if (content.length === 0) throw new Error('object_storage_source_empty');
        const extension = response.headers.get('content-type')?.includes('image') ? 'png' : 'bin';
        const key = `imports/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        await new Upload({
          client,
          params: {
            Bucket: env.bucketName,
            Key: key,
            Body: content,
            ContentType: response.headers.get('content-type') || 'application/octet-stream',
          },
        }).done();
        return key;
      } finally {
        clearTimeout(timer);
      }
    },
    async generatePresignedUrl(input: { key: string; expireTime?: number }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: env.bucketName, Key: input.key }),
        { expiresIn: input.expireTime || 3600 },
      );
    },
    async fileExists(input: { key?: string; fileKey?: string }) {
      const key = input.key || input.fileKey;
      if (!key) return false;
      try {
        await client.send(new HeadObjectCommand({ Bucket: env.bucketName, Key: key }));
        return true;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return false;
        throw error;
      }
    },
    async listFiles(input: { prefix?: string; maxKeys?: number } = {}) {
      const result = await client.send(new ListObjectsV2Command({
        Bucket: env.bucketName,
        Prefix: input.prefix,
        MaxKeys: input.maxKeys || 1000,
      }));
      const files = (result.Contents || []).map(item => ({
          key: item.Key || '',
          size: item.Size || 0,
          lastModified: item.LastModified,
        }));
      return { keys: files.map(item => item.key), files };
    },
  };
}
