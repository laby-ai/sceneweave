import React from 'react';

const STREAM_FIELD_MAP: Record<string, string> = {
  title: '标题',
  coreTheme: '核心主题',
  genre: '类型',
  style: '风格',
  visualStyle: '视觉风格',
  totalDuration: '总时长',
  colorNarrativeLine: '色彩叙事线',
  colorNarrative: '色彩叙事',
  emotionCurve: '情感曲线',
  synopsis: '故事梗概',
  scenes: '场景',
  characters: '人物',
  shots: '镜头',
  screenplay: '剧本',
  stageDirections: '场景指导',
  dialogues: '对话',
  bgmSuggestion: '背景音乐',
  subtitleSuggestion: '字幕建议',
  narrationScript: '旁白',
  visualStyle_note: '风格备注',
  sceneNumber: '场景编号',
  interior: '内外景',
  timeOfDay: '时间',
  location: '地点',
  atmosphere: '氛围',
  shotType: '镜头类型',
  cameraMovement: '运镜',
  duration: '时长',
  transition: '转场',
  cameraDirections: '运镜指导',
  soundDesign: '音效设计',
  character: '角色',
  line: '台词',
  direction: '动作指导',
  name: '名称',
  appearance: '外观',
  personality: '性格',
  keyTrait: '核心特征',
  imagePrompt: '画面提示',
  promptEn: '英文提示',
  description: '描述',
  charCards: '角色卡',
  shotCards: '镜头卡',
  characterCards: '角色卡',
  sceneCards: '场景卡',
  consistencyConstraints: '一致性约束',
  arc: '成长弧线',
  motivation: '动机',
  relationships: '关系',
  signatureDetail: '标志细节',
  outfit: '服装',
  mbti: 'MBTI',
  visualDescription: '视觉描述',
  fiveSenses: '五感',
  symbolism: '象征',
  keyProps: '关键道具',
  colorPalette: '色彩',
  mustInclude: '必须包含',
  mustExclude: '必须排除',
  consistencyRules: '一致性规则',
  sight: '视觉',
  hearing: '听觉',
  touch: '触觉',
  smell: '嗅觉',
  taste: '味觉',
  time: '时间',
  period: '时段',
  mood: '情绪',
  weather: '天气',
  lighting: '光线',
  props: '道具',
  costume: '造型',
};

const STREAM_BOOL_MAP: Record<string, Record<string, string>> = {
  interior: { true: '内景', false: '外景' },
};

const MAJOR_FIELDS = [
  '标题',
  '核心主题',
  '风格',
  '视觉风格',
  '情感曲线',
  '色彩叙事线',
  '色彩叙事',
  '总时长',
  '故事梗概',
  '剧本',
  '场景',
  '人物',
  '镜头',
  '背景音乐',
  '字幕建议',
  '旁白',
  '角色卡',
  '场景卡',
  '一致性约束',
];

const SCENE_HEADER_RE = /^场景编号[：:]\s*\d+/;

interface StreamingBlock {
  id: number;
  label: string;
  content: string;
  isMajor: boolean;
  sceneNumber?: number;
}

function parseStreamingBlocks(raw: string): StreamingBlock[] {
  if (!raw) return [];

  let text = raw;
  const sorted = Object.entries(STREAM_FIELD_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [field, label] of sorted) {
    const re = new RegExp(`"?${field}"?\\s*:\\s*`, 'g');
    text = text.replace(re, '\n' + label + '：');
  }
  for (const [field, vals] of Object.entries(STREAM_BOOL_MAP)) {
    const cnLabel = STREAM_FIELD_MAP[field] || field;
    for (const [boolVal, cnVal] of Object.entries(vals)) {
      const boolRe = new RegExp(`${cnLabel}：\\s*${boolVal}\\b`, 'g');
      text = text.replace(boolRe, `${cnLabel}：${cnVal}`);
    }
  }

  text = text
    .replace(/[\[\]{}]/g, '')
    .replace(/^\s*"[^"]*"\s*$/gm, '')
    .replace(/\\n/g, '\n')
    .replace(/([：:])(\s*)"([^"]+)"/g, '$1$2$3')
    .replace(/(：[^,\n]+),\s*(?=[\u4e00-\u9fa5]{1,6}[：:])/g, '$1\n')
    .replace(/,\s*$/gm, '')
    .replace(/^\s*,\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const blocks: StreamingBlock[] = [];
  let currentBlock: StreamingBlock | null = null;
  let blockId = 0;

  for (const line of text.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const labelMatch = trimmedLine.match(/^([\u4e00-\u9fa5]{1,6})[：:](.*)$/);
    const label = labelMatch ? labelMatch[1] : '';
    const isMajor = MAJOR_FIELDS.includes(label);
    const isSceneHeader = SCENE_HEADER_RE.test(trimmedLine);

    if (isMajor || isSceneHeader || !currentBlock) {
      if (currentBlock) blocks.push(currentBlock);
      const sceneNumMatch = trimmedLine.match(/场景编号[：:]\s*(\d+)/);
      currentBlock = {
        id: blockId++,
        label: isMajor ? label : (isSceneHeader ? `场景 ${sceneNumMatch?.[1] || ''}`.trim() : label || '内容'),
        content: trimmedLine + '\n',
        isMajor,
        sceneNumber: sceneNumMatch ? parseInt(sceneNumMatch[1], 10) : undefined,
      };
    } else {
      currentBlock.content += trimmedLine + '\n';
      if (label && currentBlock.label === '内容') {
        currentBlock.label = label;
      }
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

function StreamingBlockView({ block, isLast }: { block: StreamingBlock; isLast: boolean }) {
  const lines = block.content.trim().split('\n');
  const isDialogueBlock = lines.some(l => /^角色[：:]/.test(l.trim()));

  return (
    <div
      className={`animate-fadeIn ${block.isMajor ? 'mt-4 pt-3 border-t border-primary/10 first:border-t-0 first:mt-0 first:pt-0' : block.sceneNumber !== undefined ? 'mt-3 pt-2' : 'mt-1'}`}
    >
      {block.isMajor && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70" />
          <span className="text-[11px] font-bold text-primary tracking-wide">{block.label}</span>
          <span className="flex-1 h-px bg-primary/10" />
        </div>
      )}
      {block.sceneNumber !== undefined && !block.isMajor && (
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/15 text-[10px] font-bold text-primary">
            {block.sceneNumber}
          </span>
          <span className="text-[10px] font-semibold text-primary/60">场景</span>
          <span className="flex-1 h-px bg-primary/10" />
        </div>
      )}
      <div className={`text-xs leading-relaxed ${isDialogueBlock ? '' : 'pl-3 border-l-2 border-primary/12'}`}>
        {lines.map((line, i) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return null;
          const labelMatch = trimmedLine.match(/^([\u4e00-\u9fa5]{1,6}[：:])(.*)$/);
          const isSceneTitle = /^标题[：:]/.test(trimmedLine);
          const isDialogueLine = /^角色[：:]/.test(trimmedLine);
          const isLineField = /^台词[：:]/.test(trimmedLine);

          if (isDialogueLine) {
            const charName = labelMatch?.[2]?.trim() || '';
            return (
              <div key={i} className="my-1.5 pl-2 py-1 rounded-md bg-background/50">
                <span className="inline-flex items-center gap-1">
                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary/80 font-semibold">{charName}</span>
                </span>
              </div>
            );
          }

          if (isLineField) {
            const lineText = labelMatch?.[2]?.trim() || '';
            return (
              <div key={i} className="pl-3 py-0.5 text-foreground/70 italic border-l border-primary/15">
                「{lineText}」
              </div>
            );
          }

          if (isSceneTitle) {
            const titleText = labelMatch?.[2]?.trim() || '';
            return (
              <div key={i} className="py-0.5">
                <span className="font-semibold text-foreground/90 text-[13px]">{titleText}</span>
              </div>
            );
          }

          return (
            <div key={i} className="py-0.5">
              {labelMatch ? (
                <>
                  <span className="font-medium text-primary/80 text-[11px]">{labelMatch[1]}</span>
                  <span className="text-foreground/75">{labelMatch[2]}</span>
                </>
              ) : (
                <span className="text-foreground/50">{trimmedLine}</span>
              )}
            </div>
          );
        })}
        {isLast && (
          <span className="inline-block w-0.5 h-3.5 bg-primary/70 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}

export function StreamingScriptText({ raw }: { raw: string }) {
  const blocks = parseStreamingBlocks(raw);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => (
        <StreamingBlockView key={block.id} block={block} isLast={index === blocks.length - 1} />
      ))}
    </>
  );
}
