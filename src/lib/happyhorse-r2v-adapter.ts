import {
  buildHappyHorseVideoSubmitRequest,
  type HappyHorseVideoRequestOptions,
} from '@/lib/happyhorse-video-provider';

const HAPPYHORSE_R2V_MODEL = 'happyhorse-1.1-r2v';
const MAX_REFERENCE_IMAGES = 9;

export interface HappyHorseR2VRequestOptions extends HappyHorseVideoRequestOptions {
  referenceImages: string[];
}

export interface HappyHorseR2VSubmitRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    input: {
      prompt: string;
      media: Array<{ type: 'reference_image'; url: string }>;
    };
    parameters: ReturnType<typeof buildHappyHorseVideoSubmitRequest>['body']['parameters'];
  };
}

export function isHappyHorseR2VModel(model?: string): boolean {
  return String(model || '').trim().toLowerCase() === HAPPYHORSE_R2V_MODEL;
}

export function normalizeHappyHorseR2VReferenceImages(images: string[]): string[] {
  return [...new Set(images
    .map(image => String(image || '').trim())
    .filter(image => /^https?:\/\//i.test(image)))]
    .slice(0, MAX_REFERENCE_IMAGES);
}

export function buildHappyHorseR2VSubmitRequest(
  options: HappyHorseR2VRequestOptions,
): HappyHorseR2VSubmitRequest {
  if (!isHappyHorseR2VModel(options.model)) {
    throw new Error('快乐马参考视频适配器仅支持 happyhorse-1.1-r2v');
  }
  const referenceImages = normalizeHappyHorseR2VReferenceImages(options.referenceImages);
  if (referenceImages.length === 0) {
    throw new Error('快乐马参考视频至少需要 1 张可访问的参考图');
  }
  const base = buildHappyHorseVideoSubmitRequest(options);
  return {
    ...base,
    body: {
      ...base.body,
      input: {
        prompt: base.body.input.prompt,
        media: referenceImages.map(url => ({ type: 'reference_image' as const, url })),
      },
    },
  };
}
