export interface CreationReference {
  id: string;
  name: string;
  imageUrl: string;
  context: 'creation-agent';
}

export interface CreationReferenceFileMeta {
  name: string;
  type: string;
  size: number;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export function validateCreationReferenceFile(file: CreationReferenceFileMeta) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { valid: false, message: '当前支持 PNG、JPG、WebP 或 GIF 参考图' };
  }
  if (file.size <= 0) return { valid: false, message: '参考图内容为空' };
  if (file.size > 15 * 1024 * 1024) return { valid: false, message: '参考图不能超过 15MB' };
  return { valid: true, message: '' };
}

export function parseCreationReferences(value: unknown): CreationReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Partial<CreationReference>;
    return typeof record.id === 'string'
      && typeof record.name === 'string'
      && typeof record.imageUrl === 'string'
      && record.context === 'creation-agent'
      ? [{
        id: record.id,
        name: record.name,
        imageUrl: record.imageUrl,
        context: record.context,
      }]
      : [];
  }).slice(0, 8);
}
