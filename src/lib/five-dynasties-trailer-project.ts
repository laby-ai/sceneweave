import type {
  BuildProductionProjectParams,
  ProductionStoryBeat,
  ProductionStoryBible,
} from './production-project';

export function isFiveDynastiesHistoricalTrailer(prompt: string) {
  return /五代十国|山河未定|山河图|后梁|后唐|后晋|后汉|后周|南唐|燕云|陈桥/.test(prompt);
}

export function fiveDynastiesSubject() {
  return '山河图接力者（少年传令兵、女医官、年轻将领、赵匡胤）';
}

export function fiveDynastiesLocation() {
  return '残唐宫门、黄河渡口、燕云边界、南唐宫灯、陈桥驿';
}

export function fiveDynastiesObjectNames() {
  return ['染血山河图', '黄袍', '残唐宫门', '黄河渡口', '南唐宫灯', '陈桥驿'];
}

function assignStoryBeatShots(
  shotIds: string[],
  beatDefs: Array<Omit<ProductionStoryBeat, 'shotIds'>>,
) {
  const split = Math.max(1, Math.ceil(shotIds.length / beatDefs.length));
  return beatDefs.map((beat, index) => ({
    ...beat,
    shotIds: shotIds.slice(index * split, index === beatDefs.length - 1 ? undefined : (index + 1) * split),
  })).filter(beat => beat.shotIds.length > 0);
}

export function buildFiveDynastiesStoryBible(params: BuildProductionProjectParams): ProductionStoryBible {
  const shotIds = params.shots.map(shot => shot.id);
  const beats = assignStoryBeatShots(shotIds, [
    {
      id: 'setup',
      label: '乱世开门',
      purpose: '用残唐宫门失火和染血山河图交代唐亡之后天下失序',
      emotion: '压抑、惊惶、山河将碎',
      visualGoal: '残唐宫门、火光、倒塌牌匾和山河图同框，观众先看见乱世源头',
    },
    {
      id: 'inciting',
      label: '山河图接力',
      purpose: '让少年传令兵和女医官把山河图从黄河渡口带入战场与伤兵营',
      emotion: '急迫、被迫接棒',
      visualGoal: '黄河渡口、箭雨、梁晋军旗和伤兵营形成连续接力动作',
    },
    {
      id: 'conflict',
      label: '燕云之痛',
      purpose: '把后梁、后唐、后晋、后汉更替与燕云十六州割裂造成的长期危险拍清楚',
      emotion: '愤怒、克制、无力',
      visualGoal: '换旗 montage 后接契丹使者刀尖划开山河图，让内乱和外患同框',
    },
    {
      id: 'turning',
      label: '江南残梦与北望',
      purpose: '南唐宫灯的短暂安稳被北方马蹄打断，后周北望承接统一任务',
      emotion: '华美将熄、决断前夜',
      visualGoal: '南唐宫灯、急报、开封城墙和周字军旗完成从文治幻梦到统一前奏的转场',
    },
    {
      id: 'resolution',
      label: '陈桥雪夜',
      purpose: '以黄袍停在肩头和山河图空白收束预告片，留下太平代价的悬念',
      emotion: '肃静、未决、历史转折',
      visualGoal: '陈桥驿雪夜、黄袍、禁军火把和山河图空白成为最后可接尾帧',
    },
  ]);

  return {
    premise: '唐亡之后，黄河两岸兵火连年，几代人把同一卷山河图从战场传到宫门，直到陈桥驿外的雪夜，天下终于看见太平的代价。',
    protagonist: fiveDynastiesSubject(),
    desire: '他们必须把破碎山河从换旗与战火中接力带向真正的太平',
    obstacle: '后梁、后唐、后晋、后汉、后周的短促更替，燕云割裂和南北对峙不断把统一推远',
    relationship: '山河图接力者与残唐宫门、黄河渡口、燕云边城、南唐宫灯、陈桥驿雪夜之间形成历史接力关系',
    conflict: '山河图接力者想要终结乱世，但每一次换旗都让百姓、边城和未定山河付出新的代价',
    turningPoint: '周世宗病中北望后，统一任务从帝王手中滑向陈桥雪夜的禁军与赵匡胤',
    endingHook: '黄袍停在肩头，山河图最后一处空白映出晨光：这一次兵变会重演乱世，还是结束乱世',
    emotionalArc: {
      start: '王朝崩塌后的惊惶与压迫',
      shift: '从战场接力转向历史伤口和统一意志',
      end: '陈桥雪夜的肃静、未决与太平悬念',
    },
    continuityRules: [
      '山河图是跨段核心道具：每段必须延续它的血迹、裂口、空白或被传递状态',
      '黄河渡口、燕云边界、南唐宫灯、陈桥雪夜是连续历史节点，不得退化成无关古风空镜',
      '每段开头必须承接上一段尾帧的山河图状态或人物接力动作',
      '声音从钟声、战鼓、箭入水声、刀尖划纸、琵琶、号角推进到陈桥雪夜的静默',
      '服化道必须锁定晚唐到五代十国：幞头、圆领袍、革带、软脚帽、甲胄和素色医官衣；禁止清代辫发、明清官帽、仙侠影楼汉服、现代改良古装和日韩武士风',
      '这是原创公共史实短片，不模仿任何现有影视剧、演员、剧照、海报、角色造型或片名字号',
      '结尾不宣布盛世，只留下黄袍和山河图空白形成下一段可接的历史悬念',
    ],
    beats,
  };
}

const fiveDynastiesScenePlan = [
    {
      title: '残唐宫门',
      action: '老太监把染血山河图塞给少年传令兵，宫门在他身后倒塌，玉玺蒙尘。',
      evidence: '残唐宫门、火光、倒塌牌匾、山河图血迹、逃散宫人必须同框；禁止山脉空镜、峡谷空镜或纯风景开场。',
      exit: '尾帧定格少年抱图冲向黄河渡口，山河图血迹仍可见。',
      sound: '钟声断裂，远处战鼓第一次压上来。',
      dialogue: '把图带过黄河，别让它落进火里。',
      narration: '残唐宫门在火中倒塌，染血山河图被交给少年传令兵。',
    },
    {
      title: '黄河渡口',
      action: '少年在渡船上抬头，梁晋两军隔河对峙，箭雨落水后他把山河图交给女医官。',
      evidence: '黄河渡口、铁索、北岸黑甲骑兵、南岸朱梁军旗、箭雨和山河图必须同框。',
      exit: '尾帧山河图被女医官按在伤兵营火旁，边缘开始染上药血。',
      sound: '箭入水声、渡夫喊“别回头”。',
      dialogue: '别回头，把山河图交给医棚。',
      narration: '黄河渡口箭雨落水，少年把山河图交到女医官手里。',
    },
    {
      title: '朝代快切',
      action: '女医官每缝合一个士兵，营门外旗号从后梁、后唐、后晋、后汉快速轮换。',
      evidence: '换旗、伤兵、雨夜火把、被药血浸透的山河图必须形成同一动作链。',
      exit: '尾帧一封割地密信压在山河图裂口上。',
      sound: '鼓点加速，四个国号被低声念过。',
      dialogue: '旗又换了，伤口还在。',
      narration: '伤兵营外旗号轮换，山河图边缘被药血浸透。',
    },
    {
      title: '燕云之痛',
      action: '契丹使者用刀尖划开燕云十六州边界，年轻将领握拳却不能拔刀。',
      evidence: '边境雪原、契丹马队、城门钥匙、割裂地图和年轻将领的克制反应必须同框。',
      exit: '尾帧山河图裂口转成南唐宫灯的红线。',
      sound: '刀尖划纸声盖过风声。',
      dialogue: '燕云一裂，北门再难合。',
      narration: '契丹使者的刀尖划开燕云边界，年轻将领只能握紧拳头。',
    },
    {
      title: '江南残梦与后周北望',
      action: '南唐宫灯下半句词未干，急报落下；镜头切到周世宗病中按住山河图裂口北望。',
      evidence: '南唐宫灯、江南水面、急报竹筒、开封城墙、周字军旗和山河图裂口必须完成转场。',
      exit: '尾帧陈桥驿雪夜，黄袍从箱中露出一角。',
      sound: '琵琶声被马蹄切断，号角响起后被咳声打断。',
      dialogue: '词未写完，北边又起马蹄。',
      narration: '南唐宫灯短暂亮起，急报把镜头推向后周北望。',
    },
    {
      title: '陈桥雪夜',
      action: '赵匡胤推开披来的黄袍，低头看见山河图最后一处空白正对开封。',
      evidence: '陈桥驿、雪、黄袍、禁军火把、山河图空白和赵匡胤未落定的选择必须同框。',
      exit: '尾帧黄袍停在肩头，山河图空白处燃起晨光，不宣布结局。',
      sound: '万军呼吸声静止，低声一句“愿天下不再换旗”。',
      dialogue: '愿天下不再换旗。',
      narration: '陈桥雪夜，黄袍停在肩头，山河图的空白正对开封。',
    },
] as const;

function fiveDynastiesStep(index: number) {
  return fiveDynastiesScenePlan[Math.min(Math.max(index, 0), fiveDynastiesScenePlan.length - 1)];
}

export function buildFiveDynastiesShotAudio(index: number) {
  const step = fiveDynastiesStep(index);
  return {
    dialogue: step.dialogue,
    narration: step.narration,
    soundDesign: step.sound,
  };
}

export function buildFiveDynastiesShotPrompt(index: number, context: {
  objectNames: string[];
  storyBible: ProductionStoryBible;
}) {
  const prop = context.objectNames.find(name => name.includes('山河图')) || '染血山河图';
  const step = fiveDynastiesStep(index);
  const beat = context.storyBible.beats[Math.min(index, context.storyBible.beats.length - 1)] || context.storyBible.beats[context.storyBible.beats.length - 1];

  return [
    `【${step.title}】${beat?.purpose || context.storyBible.conflict}`,
    `【观众必须看懂】${step.action}`,
    `【动作因果】本段开头承接上一段的${prop}状态，结尾把${prop}的新状态交给下一段。`,
    `【三要素】画面同时保留历史接力人物、历史场景和${prop}。`,
    `【画面证据】${step.evidence}`,
    `【出点状态】${step.exit}`,
    `【声音提示】${step.sound}`,
    `【情绪推进】${beat?.emotion || context.storyBible.emotionalArc.shift}`,
    '【镜头执行】原创公共史实历史短片质感，不模仿任何现有影视剧、演员、剧照、海报、角色造型或片名字号；服化道锁定晚唐到五代十国：幞头、圆领袍、革带、软脚帽、甲胄、素色医官衣；禁止清代辫发、明清官帽、仙侠影楼汉服、现代改良古装、日韩武士风、现代钥匙、无关山脉空镜、抽象胶片和纯氛围素材；每个镜头都必须让观众看见历史事件正在推动山河图接力。',
  ].join(' ');
}
