/**
 * 二创风格预设库
 * 
 * 每个预设包含：
 * - 视觉风格指令（注入提示词）
 * - 元素保留策略（角色/场景/构图/氛围/色彩）
 * - subject_reference 传递策略
 */

export type ElementKey = 'character' | 'scene' | 'composition' | 'atmosphere' | 'color';

export interface RemixStylePreset {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 图标 emoji */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 分类标签 */
  category: 'style_transfer' | 'scene_rebuild' | 'character_reshape' | 'crossover' | 'annotate_only' | 'design_restore';
  /** 默认保留的元素 */
  preserveDefaults: ElementKey[];
  /** 注入提示词前缀 */
  promptPrefix: string;
  /** 注入提示词后缀 */
  promptSuffix: string;
  /** 推荐的 base style code */
  recommendedStyle: string;
  /** subject_reference 策略 */
  refStrategy: 'reference' | 'reinterpret' | 'none';
  /** 填写提示词时的参考示例 */
  promptHint: string;
}

/**
 * 元素解构选项
 */
export const ELEMENT_OPTIONS: { key: ElementKey; label: string; desc: string; icon: string }[] = [
  { key: 'character', label: '保留角色', desc: '人物外貌/服饰/姿态', icon: '🧑' },
  { key: 'scene', label: '保留场景', desc: '背景/环境/建筑', icon: '🏔️' },
  { key: 'composition', label: '保留构图', desc: '画面布局/视角/景别', icon: '📐' },
  { key: 'atmosphere', label: '保留氛围', desc: '光影/情绪/色调', icon: '🌅' },
  { key: 'color', label: '保留色彩', desc: '主色调/配色方案', icon: '🎨' },
];

/**
 * 二创风格预设列表（12+ 种）
 */
export const REMIX_STYLE_PRESETS: RemixStylePreset[] = [
  // ===== 风格迁移类 =====
  {
    id: 'cyberpunk_classic',
    name: '赛博古风',
    icon: '🏮',
    desc: '东方古典×霓虹未来，科技与传统的碰撞',
    category: 'style_transfer',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Cyberpunk reinterpretation of a classical Chinese scene, neon holographic lanterns, holographic calligraphy, circuit-board patterns on traditional garments, chrome and jade fusion,',
    promptSuffix: ', cyberpunk oriental aesthetic, neon glow on traditional architecture, digital rain, holographic dragons, 8K detailed, cinematic lighting',
    recommendedStyle: 'cyberpunk',
    refStrategy: 'reinterpret',
    promptHint: '一个穿汉服的侠客站在霓虹闪烁的城门前',
  },
  {
    id: 'ink_wuxia',
    name: '水墨武侠',
    icon: '🗡️',
    desc: '留白写意×刀光剑影，江湖气韵',
    category: 'style_transfer',
    preserveDefaults: ['character', 'atmosphere'],
    promptPrefix: 'Traditional Chinese ink wash painting style, bold brushstrokes, negative space, dynamic ink splatter, martial arts pose,',
    promptSuffix: ', ink wash painting aesthetic, rice paper texture, flowing ink, minimalist composition, wuxia atmosphere, monochrome with subtle red accent',
    recommendedStyle: 'chinese_ink',
    refStrategy: 'reinterpret',
    promptHint: '一位剑客立于竹叶间，手中长剑出鞘',
  },
  {
    id: 'anime_classic',
    name: '日漫经典',
    icon: '⭐',
    desc: '新海诚/宫崎骏光影，赛璐璐质感',
    category: 'style_transfer',
    preserveDefaults: ['character', 'scene', 'atmosphere'],
    promptPrefix: 'Anime style illustration, Makoto Shinkai lighting, cel-shaded, vibrant sky, lens flare, detailed anime eyes,',
    promptSuffix: ', anime aesthetic, dramatic lighting, saturated colors, anime film grain, beautiful detailed background, studio quality',
    recommendedStyle: 'anime',
    refStrategy: 'reinterpret',
    promptHint: '少女站在黄昏的天台上，身后是橘红色的天空',
  },
  {
    id: 'oil_master',
    name: '油画大师',
    icon: '🖼️',
    desc: '伦勃朗/莫奈光感，厚重笔触与色彩',
    category: 'style_transfer',
    preserveDefaults: ['character', 'composition', 'atmosphere'],
    promptPrefix: 'Oil painting masterpiece, thick impasto brushstrokes, chiaroscuro lighting, rich warm palette, Rembrandt-style dramatic light,',
    promptSuffix: ', classical oil painting texture, canvas grain, museum-quality, masterful color blending, golden hour illumination',
    recommendedStyle: 'oil_painting',
    refStrategy: 'reinterpret',
    promptHint: '一位老人坐在窗前，光线从侧面照进来',
  },
  {
    id: 'steampunk_retro',
    name: '蒸汽朋克',
    icon: '⚙️',
    desc: '维多利亚机械美学，黄铜齿轮与蒸汽',
    category: 'style_transfer',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Steampunk reinterpretation, brass gears, copper pipes, Victorian-era machinery, steam-powered devices, clockwork mechanisms,',
    promptSuffix: ', steampunk aesthetic, warm copper and bronze tones, industrial Victorian atmosphere, mechanical details,蒸汽 and smoke effects',
    recommendedStyle: 'cyberpunk',
    refStrategy: 'reinterpret',
    promptHint: '一位戴护目镜的发明家在工作室里调试机械',
  },
  {
    id: 'vaporwave_glitch',
    name: '蒸汽波/故障',
    icon: '🌊',
    desc: '粉紫渐变×像素故障，80年代复古未来',
    category: 'style_transfer',
    preserveDefaults: ['composition', 'color'],
    promptPrefix: 'Vaporwave aesthetic, pastel pink and purple gradient, glitch art effect, VHS scan lines, retro 80s futurism,',
    promptSuffix: ', vaporwave style, chrome text, Greek statue elements, pixel corruption, CRT monitor glow, synthwave palette',
    recommendedStyle: 'pixel_art',
    refStrategy: 'reinterpret',
    promptHint: '一个人站在粉紫色的日落海滩前',
  },

  // ===== 场景重构类 =====
  {
    id: 'modern_rewrite',
    name: '现代重写',
    icon: '🏙️',
    desc: '古装→现代都市，古典场景→当代场景',
    category: 'scene_rebuild',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Same characters and poses reimagined in a modern contemporary setting, modern city buildings, contemporary clothing and fashion,',
    promptSuffix: ', modern urban environment, contemporary lifestyle, realistic modern photography, city lights, current era aesthetic',
    recommendedStyle: 'realistic',
    refStrategy: 'reinterpret',
    promptHint: '穿古装的女子在宫殿中，改为现代办公室',
  },
  {
    id: 'post_apocalyptic',
    name: '末日废土',
    icon: '☢️',
    desc: '文明崩塌后的荒芜，废墟与生存',
    category: 'scene_rebuild',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Post-apocalyptic wasteland reimagining, ruins and debris, desolate landscape, survival gear, crumbling architecture,',
    promptSuffix: ', post-apocalyptic atmosphere, dust and ash, muted desaturated tones, dramatic harsh lighting, cinematic wasteland',
    recommendedStyle: 'realistic',
    refStrategy: 'reinterpret',
    promptHint: '一个人在废墟城市中独自行走',
  },
  {
    id: 'fairy_tale',
    name: '童话仙境',
    icon: '🏰',
    desc: '现实→奇幻童话，梦幻色彩与魔法',
    category: 'scene_rebuild',
    preserveDefaults: ['character', 'atmosphere'],
    promptPrefix: 'Fairytale fantasy reimagining, magical glowing flora, enchanted castle, sparkling dust particles, whimsical atmosphere,',
    promptSuffix: ', fairytale aesthetic, soft dreamy lighting, pastel magic glow, storybook illustration quality, enchanted forest',
    recommendedStyle: 'watercolor',
    refStrategy: 'reinterpret',
    promptHint: '一个小女孩走进发光的森林深处',
  },
  {
    id: 'space_cosmos',
    name: '星际宇宙',
    icon: '🚀',
    desc: '地面→太空，星际飞船与宇宙景观',
    category: 'scene_rebuild',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Space sci-fi reimagining, zero gravity, starship interior, nebula background, astronaut suits, cosmic landscape,',
    promptSuffix: ', sci-fi space aesthetic, stars and galaxies, holographic interfaces, futuristic technology, cosmic lighting',
    recommendedStyle: '3d_render',
    refStrategy: 'reinterpret',
    promptHint: '宇航员漂浮在星云之间的空间站外',
  },

  // ===== 角色重塑类 =====
  {
    id: 'chibi_cute',
    name: 'Q版萌化',
    icon: '🧸',
    desc: '角色Q版化，大头小身，圆润可爱',
    category: 'character_reshape',
    preserveDefaults: ['scene', 'color'],
    promptPrefix: 'Chibi/SD style character, super deformed, big head small body, round cute features, simplified adorable proportions,',
    promptSuffix: ', chibi art style, pastel soft colors, kawaii aesthetic, rounded shapes, cute expression, clean lineart',
    recommendedStyle: 'clay',
    refStrategy: 'reinterpret',
    promptHint: '一位威严的将军，改为Q版可爱形象',
  },
  {
    id: 'dark_villain',
    name: '暗黑反派',
    icon: '😈',
    desc: '光明角色→暗黑版本，反派化重塑',
    category: 'character_reshape',
    preserveDefaults: ['composition', 'atmosphere'],
    promptPrefix: 'Dark villain version, corrupted and sinister redesign, dark armor, glowing red eyes, menacing aura, shadowy tendrils,',
    promptSuffix: ', dark fantasy aesthetic, ominous atmosphere, dramatic shadows, villainous presence, corrupted version, gothic elements',
    recommendedStyle: 'realistic',
    refStrategy: 'reinterpret',
    promptHint: '一位正义骑士，改为暗黑堕落版本',
  },

  // ===== 跨界混搭类 =====
  {
    id: 'west_meets_east',
    name: '东西融合',
    icon: '☯️',
    desc: '西方元素×东方美学，文化混搭',
    category: 'crossover',
    preserveDefaults: ['composition', 'atmosphere'],
    promptPrefix: 'East-meets-West fusion, blending Eastern traditional aesthetics with Western classical elements, hybrid architecture,',
    promptSuffix: ', cultural fusion aesthetic, Eastern philosophy meets Western technology, jade and marble, silk and steel, harmonious contrast',
    recommendedStyle: 'realistic',
    refStrategy: 'reinterpret',
    promptHint: '一位穿和服的女子站在哥特教堂前',
  },
  {
    id: 'nature_tech',
    name: '自然×科技',
    icon: '🌿',
    desc: '有机生命×数字科技，生物机械融合',
    category: 'crossover',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Bio-tech fusion, organic forms merging with digital technology, bioluminescent circuits, nature-cyborg integration,',
    promptSuffix: ', bio-mechanical aesthetic, organic technology, living machines, green energy glow, nature reclaiming technology',
    recommendedStyle: '3d_render',
    refStrategy: 'reinterpret',
    promptHint: '一棵大树与电路板融合，枝干发出蓝色光芒',
  },
  // ===== 仅标注/文化解读模式（不改变画面） =====
  {
    id: 'annotate_culture',
    name: '文化解读',
    icon: '🔍',
    desc: '不改变画面，标注并解读文化元素（非遗妆面、服饰纹样、工艺等）',
    category: 'annotate_only',
    preserveDefaults: ['character', 'scene', 'composition', 'atmosphere', 'color'],
    promptPrefix: '',
    promptSuffix: '',
    recommendedStyle: '',
    refStrategy: 'reference',
    promptHint: '描述图片中的主体（AI将自动标注文化元素）',
  },
  {
    id: 'annotate_structure',
    name: '结构解析',
    icon: '🔬',
    desc: '不改变画面，解析画面结构与层次关系',
    category: 'annotate_only',
    preserveDefaults: ['character', 'scene', 'composition', 'atmosphere', 'color'],
    promptPrefix: '',
    promptSuffix: '',
    recommendedStyle: '',
    refStrategy: 'reference',
    promptHint: '描述你想解析的画面部分',
  },
  {
    id: 'annotate_period',
    name: '年代考证',
    icon: '📜',
    desc: '不改变画面，考证画面中元素的年代准确性',
    category: 'annotate_only',
    preserveDefaults: ['character', 'scene', 'composition', 'atmosphere', 'color'],
    promptPrefix: '',
    promptSuffix: '',
    recommendedStyle: '',
    refStrategy: 'reference',
    promptHint: '描述画面内容，AI将考证年代准确性',
  },
  // ===== 风格迁移类（新增艺术线稿） =====
  {
    id: 'style_art_line',
    name: '艺术线稿',
    icon: '✏️',
    desc: '将照片转换为精致的艺术线稿插画，保留轮廓与细节',
    category: 'style_transfer',
    preserveDefaults: ['character', 'composition'],
    promptPrefix: 'Transform the reference photo into a refined artistic line drawing illustration. Preserve all contours, details, folds, and structural features with clean confident strokes. Convert shading to line weight variation and cross-hatching. The result should look like a hand-drawn illustration by a professional illustrator. CRITICAL: NO text, NO letters, NO characters, NO writing, NO dimension lines, NO annotations in the image.',
    promptSuffix: ', artistic line drawing illustration, elegant pen-and-ink style, varying line weights, delicate cross-hatching, clean white background, professional illustration quality, 8K detailed — NO text, NO writing in image',
    recommendedStyle: 'line_art',
    refStrategy: 'reference',
    promptHint: '一张古装人物照片，转为精美的线稿插画',
  },
  // ===== 设计还原类 =====
  // 设计还原 ≠ 风格转换。产出为专业设计图纸，后处理叠加尺寸标注/工艺符号/材料标注。
  // AI生成线稿底图 → 后处理叠加专业标注 → 最终输出设计图纸
  // 覆盖领域：服装 / 妆容 / 发饰 / 建筑

  // --- 服装类 ---
  {
    id: 'design_clothing_craft',
    name: '服装工艺图',
    icon: '📐',
    desc: '将服装照片还原为专业工艺设计图，含尺寸标注线、面料标注、工艺说明',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original garment from the reference image — same shape, same structure, same proportions, same details, same seams and folds. Redraw it as a professional garment technical flat sketch (fashion industry standard). Clean flat vector-style line drawing on pure white background, showing the garment from the front view with all structural seams, darts, pleats, and construction details clearly marked. NO shading, NO shadows, NO background, NO 3D perspective. Pure flat technical drawing. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional fashion technical flat sketch, clean vector lines on white background, industry standard garment specification drawing, precise seam lines and construction details, front view flat lay, no shading no shadows, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the garment shape MUST exactly match the reference photo',
    recommendedStyle: 'technical_flat',
    refStrategy: 'reference',
    promptHint: '一件唐代齐胸襦裙，还原为专业服装工艺图',
  },
  {
    id: 'design_clothing_structure',
    name: '服装结构分解图',
    icon: '🔧',
    desc: '将服装拆解为各部件结构图，含裁片分解与拼接关系、裁剪线',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original garment from the reference image. Create an exploded view technical drawing showing all garment components separated and spread apart. Each piece (bodice, sleeves, collar, skirt panel, belt, lining, trim) should be drawn as a separate flat piece with clean vector outlines on pure white background. Show how pieces connect with dashed alignment lines. Pure flat technical drawing style. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', exploded view garment construction diagram, each piece drawn separately as flat pattern, clean vector outlines on white background, dashed alignment lines showing connections, professional pattern-making quality, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the garment pieces MUST match the reference photo',
    recommendedStyle: 'exploded_view',
    refStrategy: 'reference',
    promptHint: '一套明代汉服，拆解为各裁片结构图',
  },
  {
    id: 'design_clothing_multiview',
    name: '服装多视图设计图',
    icon: '📊',
    desc: '生成正面/侧面/背面三视图设计图，含结构标注与比例标注',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original garment from the reference image. Create a professional fashion design sheet showing the same garment from THREE views arranged side by side on pure white background: FRONT VIEW (center), SIDE VIEW (right), BACK VIEW (left). Each view is a clean flat technical line drawing with all construction details, seam lines, and structural features visible. Consistent proportions across all three views. Pure flat technical drawing, no shading, no shadows. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional fashion design sheet with front view side view and back view, three views arranged side by side, clean flat vector line drawings on white background, consistent proportions, industry standard fashion specification sheet, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the garment in all views MUST exactly match the reference photo',
    recommendedStyle: 'multi_view',
    refStrategy: 'reference',
    promptHint: '一件旗袍，生成正面/侧面/背面三视图设计图',
  },

  // --- 妆容类 ---
  {
    id: 'design_makeup_craft',
    name: '妆容工艺图',
    icon: '💄',
    desc: '将妆容照片还原为专业妆容设计图，含色卡标注、分区说明、产品标注',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original makeup design from the reference image — same colors, same application zones, same style and techniques. Redraw the face as a professional makeup specification sheet on pure white background. Show the face in front view with clearly delineated makeup application zones: eye makeup area, lip area, blush area, contour area, highlight area. Each zone should have distinct flat coloring matching the original makeup. Clean flat illustration style, no 3D shading. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO product names in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional makeup specification sheet, face chart with makeup application zones, clean flat color blocks on white background, cosmetic design diagram, precise color matching, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the makeup colors and zones MUST exactly match the reference photo',
    recommendedStyle: 'technical_flat',
    refStrategy: 'reference',
    promptHint: '一张唐代花钿妆容照片，还原为专业妆容工艺图',
  },
  {
    id: 'design_makeup_structure',
    name: '妆容结构分解图',
    icon: '🧴',
    desc: '将妆容按层次拆解，含底妆→修容→眼妆→唇妆分层标注',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original makeup design from the reference image. Create a layered exploded view showing the makeup application in sequential layers on pure white background. Draw the same face 4-5 times from left to right, each showing one additional makeup layer: 1) bare face with foundation, 2) + contour/highlight, 3) + eye makeup, 4) + lip color, 5) complete look. Clean flat illustration style with distinct flat colors for each layer. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO step numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', makeup application layer diagram, sequential face charts showing progressive makeup steps, clean flat vector style on white background, professional cosmetic technique illustration, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, each layer MUST exactly match the corresponding part of the reference photo makeup',
    recommendedStyle: 'exploded_view',
    refStrategy: 'reference',
    promptHint: '一套完整的古典妆容，按步骤拆解为分层结构图',
  },

  // --- 发饰类 ---
  {
    id: 'design_hair_craft',
    name: '发饰工艺图',
    icon: '📿',
    desc: '将发饰照片还原为专业工艺图，含材质标注、工艺技法、结构细节',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original hair accessory from the reference image — same shape, same structure, same proportions, same decorative details. Redraw it as a professional accessory technical specification on pure white background. Show the hair accessory from the front view with all structural details, material transitions, and decorative elements clearly rendered. Clean flat vector-style line drawing, no 3D shading. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional hair accessory technical specification, clean vector lines on white background, jewelry and ornament design drawing, precise structural details, front view flat lay, no shading no shadows, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the accessory shape and details MUST exactly match the reference photo',
    recommendedStyle: 'technical_flat',
    refStrategy: 'reference',
    promptHint: '一支金步摇发簪，还原为专业发饰工艺图',
  },
  {
    id: 'design_hair_structure',
    name: '发饰结构分解图',
    icon: '🔩',
    desc: '将发饰拆解为各部件，含组装关系、连接方式、材料分层',
    category: 'design_restore',
    preserveDefaults: ['character', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original hair accessory from the reference image. Create an exploded view technical drawing showing all components separated and spread apart. Each piece (main body, decorative elements, pins, chains, beads, tassels, metalwork) should be drawn as a separate flat piece with clean vector outlines on pure white background. Show how pieces connect and assemble with dashed alignment lines. Pure flat technical drawing style. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', exploded view hair accessory construction diagram, each component drawn separately as flat piece, clean vector outlines on white background, dashed alignment lines showing assembly, professional jewelry specification quality, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the accessory components MUST match the reference photo',
    recommendedStyle: 'exploded_view',
    refStrategy: 'reference',
    promptHint: '一副凤冠，拆解为各部件结构图',
  },

  // --- 建筑类 ---
  {
    id: 'design_arch_craft',
    name: '建筑工艺图',
    icon: '🏛️',
    desc: '将建筑照片还原为专业建筑工艺图，含结构细节、材料标注、工艺说明',
    category: 'design_restore',
    preserveDefaults: ['scene', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original building/structure from the reference image — same form, same proportions, same structural details, same decorative elements. Redraw it as a professional architectural technical drawing on pure white background. Show the building with all structural members, joints, brackets, roof elements, and decorative details clearly rendered in clean flat vector-style line drawing. No 3D perspective, no shading, no shadows. Pure flat technical drawing. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional architectural technical drawing, clean vector lines on white background, building specification drawing with precise structural details, flat orthographic style, no shading no shadows, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the building form MUST exactly match the reference photo',
    recommendedStyle: 'technical_flat',
    refStrategy: 'reference',
    promptHint: '一座唐代木构建筑，还原为专业建筑工艺图',
  },
  {
    id: 'design_arch_structure',
    name: '建筑结构分解图',
    icon: '🏗️',
    desc: '将建筑拆解为各结构部件，含梁柱体系、屋顶构造、连接关系',
    category: 'design_restore',
    preserveDefaults: ['scene', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original building/structure from the reference image. Create an exploded view architectural drawing showing all structural components separated and spread apart on pure white background. Each component (foundation, pillars, beams, brackets/dougong, roof frame, roof tiles, walls, windows, doors) should be drawn as a separate piece with clean vector outlines. Show how pieces connect with dashed alignment lines. Pure flat technical drawing style. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', exploded view building construction diagram, each structural component drawn separately as flat piece, clean vector outlines on white background, dashed alignment lines showing connections, professional architectural specification quality, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the building components MUST match the reference photo',
    recommendedStyle: 'exploded_view',
    refStrategy: 'reference',
    promptHint: '一座歇山顶殿宇，拆解为各结构部件图',
  },
  {
    id: 'design_arch_multiview',
    name: '建筑多视图设计图',
    icon: '🗺️',
    desc: '生成建筑正面/侧面/剖面/俯视多视图，含比例标注与尺寸标注',
    category: 'design_restore',
    preserveDefaults: ['scene', 'composition', 'color'],
    promptPrefix: 'EXACTLY preserve the original building/structure from the reference image. Create a professional architectural design sheet showing the same building from MULTIPLE views arranged on pure white background: FRONT ELEVATION (top-left), SIDE ELEVATION (top-right), CROSS-SECTION (bottom-left), PLAN/TOP VIEW (bottom-right). Each view is a clean flat technical line drawing with all structural details visible. Consistent proportions across all views. Pure flat technical drawing, no shading, no shadows. CRITICAL: NO text, NO letters, NO characters, NO writing, NO callouts, NO dimension numbers in the image — all annotations will be added as overlay later.',
    promptSuffix: ', professional architectural design sheet with front elevation side elevation cross-section and plan view, multiple views arranged in grid layout, clean flat vector line drawings on white background, consistent proportions, industry standard architectural specification sheet, 8K detailed — NO text, NO writing, NO letters, NO numbers in image, the building in all views MUST exactly match the reference photo',
    recommendedStyle: 'multi_view',
    refStrategy: 'reference',
    promptHint: '一座四合院正房，生成多视图建筑设计图',
  },
];

/**
 * 根据图片描述+提示词检测设计领域
 * 优先基于图片内容，提示词仅作辅助
 */
export function detectDesignDomain(imageDescription: string, prompt: string = ''): 'clothing' | 'makeup' | 'hair' | 'architecture' {
  const img = (imageDescription || '').toLowerCase();
  const txt = (prompt || '').toLowerCase();
  const combined = img + ' ' + txt;

  // 建筑：检测建筑相关关键词
  if (/建筑|古建|殿|阁|亭|楼|塔|庙|宫|院|木构|斗拱|飞檐|歇山|悬山|庑殿|牌坊|城墙|拱门|廊|architect|building|temple|pagoda|palace|pavilion/.test(combined)) {
    return 'architecture';
  }

  // 发饰：检测发饰相关关键词
  if (/发饰|发簪|步摇|凤冠|头饰|头面|钗|簪|钿|梳篦|花钿|hairpin|headdress|hair.*accessor|发髻|盘发|梳髻/.test(combined)) {
    // 如果图片同时大量提及服装，需要判断主次
    const hairScore = (combined.match(/发簪|步摇|凤冠|头饰|发髻|发饰|钗|簪|钿/g) || []).length;
    const clothingScore = (combined.match(/裙|襦|衫|袍|褂|衣|裳|领|袖|披帛/g) || []).length;
    if (hairScore >= clothingScore) return 'hair';
  }

  // 妆容：检测妆容相关关键词
  if (/妆容|妆面|化妆|妆造|美妆|腮红|唇妆|眉妆|眼妆|面妆|铅粉|胭脂|花钿|面靥|斜红|makeup|唇色|眉形|眼线/.test(combined)) {
    const makeupScore = (combined.match(/妆|胭脂|铅粉|腮红|唇|眉|眼妆|面妆|花钿|面靥|斜红/g) || []).length;
    const clothingScore = (combined.match(/裙|襦|衫|袍|褂|衣|裳|领|袖|披帛/g) || []).length;
    if (makeupScore >= clothingScore) return 'makeup';
  }

  // 服装：检测服饰相关关键词（默认领域，但需要关键词支撑）
  if (/裙|襦|衫|袍|褂|衣|裳|领|袖|披帛|齐胸|襦裙|汉服|唐装|旗袍|和服|kimono|garment|dress|clothing|服饰|面料|织锦|刺绣|裁剪|缝制/.test(combined)) {
    return 'clothing';
  }

  // 兜底：如果图片描述中都没有明确领域关键词，基于图片描述的整体判断
  // 图片描述中如果提到了"人物""人像"等，默认服装
  if (/人物|人像|女子|男子|角色|portrait|person|figure|woman|man/.test(combined)) {
    return 'clothing';
  }

  // 默认服装
  return 'clothing';
}

/**
 * 根据用户提示词推荐最匹配的二创风格
 * @param prompt 用户提示词
 * @param imageDescription 图片内容描述（用于领域检测）
 */
export function suggestRemixStyle(prompt: string, imageDescription?: string): RemixStylePreset | null {
  const t = prompt.toLowerCase();
  const domain = imageDescription ? detectDesignDomain(imageDescription, prompt) : null;

  // 风格迁移关键词
  if (/赛博|古风|赛博古风|cyberpunk.*chinese|霓虹.*古/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'cyberpunk_classic') || null;
  if (/水墨|武侠|江湖|写意|国画/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'ink_wuxia') || null;
  if (/日漫|动漫|新海诚|宫崎骏|anime/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'anime_classic') || null;
  if (/油画|伦勃朗|莫奈|古典绘画/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'oil_master') || null;
  if (/蒸汽朋克|steampunk|齿轮|维多利亚/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'steampunk_retro') || null;
  if (/蒸汽波|vaporwave|故障|glitch|80年代|复古未来/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'vaporwave_glitch') || null;

  // 场景重构关键词
  if (/现代|都市|当代|穿越.*现代/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'modern_rewrite') || null;
  if (/末日|废土|apocalyp|生存|荒芜/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'post_apocalyptic') || null;
  if (/童话|仙境|梦幻|魔法|奇幻/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'fairy_tale') || null;
  if (/星际|太空|宇宙|飞船|space|cosmos/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'space_cosmos') || null;

  // 角色重塑关键词
  if (/q版|chibi|萌|可爱|大头/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'chibi_cute') || null;
  if (/暗黑|反派|邪恶|黑化|villain|dark/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'dark_villain') || null;

  // 跨界混搭关键词
  if (/东西|融合|混搭|中西/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'west_meets_east') || null;
  if (/自然.*科技|生物.*机械|organic.*tech/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'nature_tech') || null;

  // 仅标注/文化解读关键词
  if (/标注|解读|介绍|非遗|文化|传统|工艺|妆面|纹样|说明|解析|识辨|识别/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'annotate_culture') || null;
  if (/结构|层次|拆解|分解|构图|透视/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'annotate_structure') || null;
  if (/年代|考证|朝代|时代|历史|时期|校验|准确/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'annotate_period') || null;

  // 艺术线稿关键词
  if (/线稿|线画|素描|速写|手绘|白描|线描|pen.*ink|line.*draw|sketch/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'style_art_line') || null;

  // 设计还原关键词 — 服装
  if (/工艺图|工艺设计|制图|服装图|服装设计|缝制|裁剪图|工艺单|spec.*draw|tech.*pack/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_clothing_craft') || null;
  if (/服装.*结构|服装.*拆解|裁片|部件图|服装.*爆炸|garment.*exploded|pattern.*piece/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_clothing_structure') || null;
  if (/服装.*多视图|服装.*三视图|服装.*正面.*侧面|服装.*正侧背/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_clothing_multiview') || null;

  // 设计还原关键词 — 妆容
  if (/妆容|妆面|化妆|妆造|美妆|makeup/.test(t)) {
    if (/结构|层次|拆解|分解|步骤|分层/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_makeup_structure') || null;
    return REMIX_STYLE_PRESETS.find(p => p.id === 'design_makeup_craft') || null;
  }

  // 设计还原关键词 — 发饰
  if (/发饰|发簪|步摇|凤冠|头饰|头面|hair.*accessor|hairpin|headdress/.test(t)) {
    if (/结构|拆解|分解|部件/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_hair_structure') || null;
    return REMIX_STYLE_PRESETS.find(p => p.id === 'design_hair_craft') || null;
  }

  // 设计还原关键词 — 建筑
  if (/建筑|古建|殿|阁|亭|楼|塔|庙|宫|院|木构|architect/.test(t)) {
    if (/多视图|三视图|剖面|平面|正侧|多角度/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_arch_multiview') || null;
    if (/结构|拆解|分解|部件|梁柱|斗拱|构架/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === 'design_arch_structure') || null;
    return REMIX_STYLE_PRESETS.find(p => p.id === 'design_arch_craft') || null;
  }

  // 通用设计还原兜底 — 根据图片内容自动选择领域
  const fallbackDomain = domain || 'clothing';
  if (/结构分解|拆解图|爆炸图|exploded/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === `design_${fallbackDomain}_structure`) || null;
  if (/多视图|三视图|正面.*侧面|正侧背|design.*sheet|spec.*sheet|多角度/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === `design_${fallbackDomain}_multiview`) || REMIX_STYLE_PRESETS.find(p => p.id === `design_${fallbackDomain}_structure`) || null;
  if (/设计图|还原图|图纸|复原|设计还原|蓝图|blueprint/.test(t)) return REMIX_STYLE_PRESETS.find(p => p.id === `design_${fallbackDomain}_craft`) || null;

  return null;
}

/**
 * 根据保留元素列表生成提示词指令
 */
export function buildPreserveInstruction(preservedElements: ElementKey[]): string {
  if (preservedElements.length === 0) return '';

  // 多层级约束：正面描述 + 具体特征清单 + 反面禁止
  const descriptors: Record<ElementKey, { label: string; features: string; negative: string }> = {
    character: {
      label: '角色外貌与服饰',
      features: '角色的面部特征、发型、服装款式、饰品、体型比例、标志性装扮必须与原图高度一致',
      negative: '不得改变角色的种族、性别、年龄、核心服饰',
    },
    scene: {
      label: '场景与背景环境',
      features: '场景的空间结构、建筑/自然元素、地面/天空、标志性环境物体必须与原图保持一致',
      negative: '不得将室内变室外、城市变荒野、白天变黑夜',
    },
    composition: {
      label: '画面构图与视角',
      features: '主体的位置、大小比例、画面分割方式、前景/中景/远景层次必须与原图一致',
      negative: '不得改变景别(特写变全景)、视角(正面变侧面)、主体位置',
    },
    atmosphere: {
      label: '光影氛围与情绪',
      features: '光线的方向、色温、明暗对比、情绪基调(温暖/冷峻/神秘等)必须保持',
      negative: '不得将温馨变恐怖、明亮变阴暗、宁静变混乱',
    },
    color: {
      label: '主色调与配色方案',
      features: '画面的主色、辅助色、高光色、阴影色必须与原图保持同色系',
      negative: '不得将暖色调变为冷色调、高饱和变低饱和',
    },
  };

  const items = preservedElements.map(k => descriptors[k]);
  const labels = items.map(d => d.label).join('、');
  const features = items.map(d => d.features).join('；');
  const negatives = items.map(d => d.negative).join('；');

  return [
    `【必须保留】${labels}——这是硬性约束，不可违反。`,
    `具体要求：${features}`,
    `反面约束：${negatives}`,
    `在以上保留约束的基础上，对其他元素进行创意变异。`,
  ].join('\n');
}

/**
 * 构建保留元素验证提示词（用于后生成验证）
 */
export function buildVerifyPrompt(preservedElements: ElementKey[]): string {
  if (preservedElements.length === 0) return '';

  const labels: Record<ElementKey, string> = {
    character: '角色外貌与服饰',
    scene: '场景与背景环境',
    composition: '画面构图与视角',
    atmosphere: '光影氛围与情绪',
    color: '主色调与配色方案',
  };

  const items = preservedElements.map(k => labels[k]);
  return `请判断这张生成图片是否成功保留了以下元素：${items.join('、')}。对每项给出保留/未保留的判断。`;
}

/**
 * 分类标签映射
 */
export const REMIX_CATEGORIES: { id: RemixStylePreset['category']; label: string; icon: string }[] = [
  { id: 'annotate_only', label: '文化标注', icon: '🔍' },
  { id: 'design_restore', label: '设计还原', icon: '📐' },
  { id: 'style_transfer', label: '风格迁移', icon: '🎨' },
  { id: 'scene_rebuild', label: '场景重构', icon: '🏔️' },
  { id: 'character_reshape', label: '角色重塑', icon: '🧑' },
  { id: 'crossover', label: '跨界混搭', icon: '☯️' },
];
