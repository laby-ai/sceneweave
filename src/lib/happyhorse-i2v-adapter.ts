import {
  buildHappyHorseVideoSubmitRequest,
  type HappyHorseVideoRequestOptions,
} from '@/lib/happyhorse-video-provider';

const HAPPYHORSE_I2V_MODEL = 'happyhorse-1.1-i2v';

export interface HappyHorseI2VRequestOptions extends HappyHorseVideoRequestOptions {
  firstFrameImage: string;
}

export interface HappyHorseI2VSubmitRequest {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    input: {
      prompt: string;
      media: [{ type: 'first_frame'; url: string }];
    };
    parameters: {
      resolution: '720P' | '1080P';
      duration: number;
      watermark: boolean;
      seed?: number;
    };
  };
}

export function isHappyHorseI2VModel(model?: string): boolean {
  return String(model || '').trim().toLowerCase() === HAPPYHORSE_I2V_MODEL;
}

export function buildHappyHorseI2VSubmitRequest(
  options: HappyHorseI2VRequestOptions,
): HappyHorseI2VSubmitRequest {
  if (!isHappyHorseI2VModel(options.model)) {
    throw new Error('快乐马首帧视频适配器仅支持 happyhorse-1.1-i2v');
  }
  const firstFrameImage = String(options.firstFrameImage || '').trim();
  if (!/^(https?:\/\/|data:image\/)/i.test(firstFrameImage)) {
    throw new Error('快乐马首帧视频需要一个可访问的首帧图片');
  }
  const base = buildHappyHorseVideoSubmitRequest(options);
  return {
    url: base.url,
    headers: base.headers,
    body: {
      model: base.body.model,
      input: {
        prompt: base.body.input.prompt,
        media: [{ type: 'first_frame', url: firstFrameImage }],
      },
      parameters: {
        resolution: base.body.parameters.resolution,
        duration: base.body.parameters.duration,
        watermark: base.body.parameters.watermark,
        ...(base.body.parameters.seed === undefined ? {} : { seed: base.body.parameters.seed }),
      },
    },
  };
}
