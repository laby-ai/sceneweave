/**
 * 一致性校验 API
 * 基于人物一致性引擎，检查镜头间的角色/场景连贯性
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  checkConsistency,
  selectPromptMode,
  generateGridPrompt,
  generateCharacterAnchor,
  extendPrompt,
} from '@/lib/video-production/character-consistency-engine';
import type { CharacterAnchor } from '@/lib/video-production/character-consistency-engine';
import type {
  CharacterBible,
  SceneBible,
  ShotListItem,
} from '@/lib/video-production/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'check': {
        const { shots = [], characterBibles = [], sceneBibles = [] } = body as {
          shots?: ShotListItem[];
          characterBibles?: CharacterBible[];
          sceneBibles?: SceneBible[];
        };
        if (shots.length === 0) {
          return NextResponse.json({ success: true, result: { issues: [], score: 100, note: '未提供镜头数据，跳过一致性检查' } });
        }
        const result = checkConsistency(shots, characterBibles, sceneBibles);
        return NextResponse.json({ success: true, result });
      }

      case 'select_mode': {
        const { shot, characterBibles, hasReferenceImages } = body as {
          shot: ShotListItem;
          characterBibles: CharacterBible[];
          hasReferenceImages: boolean;
        };
        const mode = selectPromptMode(shot, characterBibles, hasReferenceImages);
        return NextResponse.json({ success: true, mode });
      }

      case 'generate_grid_prompt': {
        const input = body.input;
        const result = generateGridPrompt(input);
        return NextResponse.json({ success: true, result });
      }

      case 'generate_anchor': {
        const { bible, description, imageUrl } = body as {
          bible?: CharacterBible;
          description?: string;
          imageUrl?: string;
        };
        if (bible) {
          const anchor = generateCharacterAnchor(bible);
          return NextResponse.json({ success: true, anchor });
        }
        // 如果只传了 description，构建基于描述的简化锚点（无需完整 CharacterBible）
        if (description) {
          const anchor: CharacterAnchor = {
            characterId: `char-${Date.now()}`,
            clipDescription: description,
            faceAnchor: {
              faceShape: '',
              eyeShape: '',
              skinTone: '',
              eyebrowStyle: '',
              lipShape: '',
              distinguishingMark: '',
            },
            bodyAnchor: {
              height: '',
              build: '',
              silhouette: description,
            },
            hairAnchor: {
              style: '',
              color: '',
              accessories: '',
            },
            costumeAnchor: {
              mainOutfit: description,
              colorPalette: [],
              fabric: '',
              accessories: '',
            },
          };
          return NextResponse.json({ success: true, anchor, note: '基于描述生成简化锚点，建议提供完整 CharacterBible 获取精确锚点' });
        }
        return NextResponse.json({ error: '需要提供 bible 或 description' }, { status: 400 });
      }

      case 'extend_prompt': {
        const { prompt, options } = body as {
          prompt: string;
          options?: {
            language?: 'zh' | 'en';
            addMotionDescription?: boolean;
            addLightingDetail?: boolean;
            addTargetSubject?: boolean;
            sceneType?: string;
          };
        };
        const extended = extendPrompt(prompt, options);
        return NextResponse.json({ success: true, originalPrompt: prompt, extendedPrompt: extended });
      }

      default:
        return NextResponse.json(
          { error: '未知操作，支持: check, select_mode, generate_grid_prompt, generate_anchor, extend_prompt' },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '一致性校验失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
