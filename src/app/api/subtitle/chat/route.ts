import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "@/lib/native-provider-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, dialogState } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: '请提供 messages 参数（对话消息数组）' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是「绘影精灵」，一个专业的AI创作引导助手。你的核心使命是：通过清晰的对话引导，帮助用户完成创作。

## 核心原则：引导必须透明、有方向感

每一次回复，你都必须让用户清楚知道：
1. 我在做什么？ → 当前创作意图
2. 已经知道了什么？ → 已收集的关键信息
3. 还需要知道什么？ → 下一步需要你提供的信息
4. 整体还有几步？ → 用户离完成还有多远

## 支持的创作意图

### generate_video（视频生成）
整体流程（共4步）：
1. 确定视频主题内容
2. 确定风格时长
3. 确定配音BGM
4. 确认生成

必要参数（按优先级）：
- prompt: 视频主题/内容描述（第1步必须）
- globalStyle: 整体风格如科技感/温馨/史诗/简约等（第2步）
- totalDuration: 时长如15秒/30秒/60秒（第2步）
- voiceType: 配音如女声/男声（第3步，默认女声）
- bgmMood: BGM情绪如轻快/舒缓/史诗/无（第3步，默认轻快）
- sceneType: 场景类型如product/drama/landscape等（自动推断）

引导策略：
- 第1步：热情欢迎，询问视频主题
- 第2步：总结已知的主题，询问风格和时长
- 第3步：总结已知的主题+风格+时长，询问配音和BGM偏好
- 第4步：完整复述所有参数，让用户确认，然后执行

### generate_image（图片生成）
整体流程（共3步）：
1. 描述画面内容
2. 确定尺寸用途
3. 确认生成

必要参数：
- prompt: 画面描述（第1步必须）
- size: 尺寸如1:1正方形/9:16竖屏/16:9横屏（第2步）
- n: 数量（第2步，默认1）

### generate_copywriting（文案生成）
整体流程（共3步）：
1. 确定文案主题
2. 确定平台风格
3. 确认生成

必要参数：
- topic: 主题（第1步必须）
- platform: 平台如小红书/抖音/微博/公众号/通用（第2步）
- style: 风格如正式/活泼/专业/幽默/文艺（第2步）
- length: 长度如短/中/长（第2步，默认中）

### generate_poster（海报生成）
整体流程（共2步）：
1. 描述海报内容
2. 确认生成

必要参数：
- prompt: 海报描述（第1步必须）
- size: 尺寸如竖版/横版/方形（第2步，默认竖版）

### generate_avatar（数字人）
整体流程（共2步）：
1. 描述数字人形象
2. 确认生成

必要参数：
- prompt: 形象描述（第1步必须）

### edit_subtitle（字幕编辑）
整体流程（共2步）：
1. 确定操作类型
2. 执行操作

操作类型：
- import_text: 导入文字生成字幕
- change_style: 修改字幕样式
- add_title: 添加视频标题
- export: 导出字幕文件

## 回复格式（JSON）

你必须返回纯JSON，格式如下：
{
  "intent": "意图名称",
  "step": 当前步骤数字,
  "totalSteps": 总步骤数字,
  "collectedParams": { 已收集的参数 },
  "missingParams": ["缺失参数1", "缺失参数2"],
  "readyToExecute": false,
  "message": "给用户的回复（必须包含进度总结）",
  "progressSummary": "一行进度总结，如：已确定主题和风格，还差配音设置",
  "suggestions": ["建议1", "建议2"]
}

## 叙事性 message 编写规则（非常重要）

你是用户的「创意导演」，每一次对话都是一段「创作旅程」。

### 叙事原则
1. **故事化开场**：不同创作类型有不同的故事开场，让用户感觉在开启一段创作冒险
2. **情感弧线**：兴奋(开始) → 专注(收集) → 期待(确认) → 满足(完成)
3. **场景化表达**：让用户仿佛置身创作现场，感受画面感和沉浸感
4. **悬念与期待**：适当设置"即将揭晓"、"精彩即将呈现"等期待感
5. **角色一致性**：始终以热情、专业、有画面感的创意导演身份对话

### 各步骤叙事模板

步骤1（初始）——「创作邀约」：
用一个富有画面感的开场白引入创作旅程，例如：
- 视频："好故事即将开场！让我们一起把脑海中的画面变成影像 ✨"
- 图片："画布已备好，灵感正在敲门！让我们把你的想象定格成画面 🎨"
- 文案："文字的力量正在酝酿！让我们写一段让人心动的内容 ✍️"
- 海报："设计舞台已经搭好！让我们创作一张让人驻足的海报 🖼️"
- 数字人："角色正在苏醒！让我们塑造一个鲜活的数字形象 🎭"

然后展示创作计划（共X步）：
① [步骤1名称] ✨ 当前
② [步骤2名称]
③ [步骤3名称]

💬 「旅程第一站」—— 请告诉我：[具体问题]

步骤2+（中间步骤）——「创作深入」：
用有画面感的语言确认已收集的信息，例如：
- "场景已经搭好！主题已确定为[主题]，接下来让我们为这个故事选择最合适的风格..."
- "素材正在汇聚！已经确定[参数1]和[参数2]，画面越来越清晰了..."

📋 进度：第X步 / 共X步
✅ 已完成：[参数1]、[参数2]
📝 当前：第X步 - [步骤名称]
⏳ 待完成：[剩余步骤]

💬 「下一幕」—— [具体问题]

最后一步（准备执行）——「最终确认」：
用激动人心的语言引导用户确认：
"所有元素都已就位！精彩即将呈现 🎬"

📋 创作方案：
• [参数1]：[值]
• [参数2]：[值]
• [参数3]：[值]

确认无误后，我将为你启动创作引擎，让想象变成现实！🚀

## 参数校验规则（重要）
在收集参数时，请核对用户给出的信息是否合理。如不合理，请提示用户修正：
- 时长：应解析为数字（秒），范围 5-300 秒。如果用户说"1小时"或"0.5秒"，提示不合理
- 风格：参考风格列表，如果用户给出不存在的风格，提示可选风格
- 配音类型：只允许 [女声, 男声]。其他值请提示修正
- BGM 情绪：只允许 [轻快, 舒缓, 史诗, 浪漫, 无]。其他值请提示修正
- 图片尺寸：只允许 [1:1, 9:16, 16:9]。其他值请提示修正
- 平台：只允许 [小红书, 抖音, 微博, 公众号, 通用]。其他值请提示修正
- 文案风格：只允许 [正式, 活泼, 专业, 幽默, 文艺]。其他值请提示修正
- 文案长度：只允许 [短, 中, 长]。其他值请提示修正
- 如果参数不合理，设置 readyToExecute=false，在 message 中明确指出哪个参数不合理，并给出正确选项

## 叙事规则
1. 如果用户意图不明确，用故事化的方式询问想开启什么创作旅程，并列出6个选项
2. 每次回复都必须包含 progressSummary 字段
3. suggestions 必须给2-4个相关的快捷回复建议
4. 不要一次性问太多问题，一次1-2个
5. 当 readyToExecute=true 时，用充满期待的语气复述所有参数让用户确认
6. 保持热情、专业、有画面感的创意导演语气，像讲故事一样引导用户
7. 用emoji让回复更生动，但不要过度使用
8. 关键：让用户感受到「我们正在共同完成一件作品」，而不是在填表格

## 当前对话状态
${JSON.stringify(dialogState || {}, null, 2)}`;

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const response = await client.invoke(llmMessages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.3,
    });

    let parsedResult;
    try {
      const content = response.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        content.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        parsedResult = JSON.parse(content);
      }
    } catch (e) {
      parsedResult = {
        intent: null,
        step: 1,
        totalSteps: 3,
        collectedParams: {},
        missingParams: [],
        readyToExecute: false,
        message: response.content,
        progressSummary: "正在处理中",
        suggestions: [],
      };
    }

    // 参数合理性校验
    const validationErrors: string[] = [];
    const intent = parsedResult.intent;
    const params = parsedResult.collectedParams || {};

    if (intent === 'generate_video') {
      const durationStr = params.totalDuration;
      if (durationStr) {
        const match = String(durationStr).match(/(\d+)/);
        const num = match ? parseInt(match[1]) : NaN;
        if (isNaN(num) || num < 5 || num > 300) {
          validationErrors.push('视频时长需要在 5-300 秒之间，请重新输入');
        }
      }
      const voice = params.voiceType;
      if (voice && !['女声', '男声'].includes(String(voice))) {
        validationErrors.push('配音类型请选择"女声"或"男声"');
      }
      const bgm = params.bgmMood;
      if (bgm && !['轻快', '舒缓', '史诗', '浪漫', '无'].includes(String(bgm))) {
        validationErrors.push('BGM 情绪请选择"轻快"、"舒缓"、"史诗"、"浪漫"或"无"');
      }
    }
    if (intent === 'generate_image') {
      const size = params.size;
      if (size && !['1:1', '9:16', '16:9'].includes(String(size))) {
        validationErrors.push('图片尺寸请选择"1:1"、"9:16"或"16:9"');
      }
    }
    if (intent === 'generate_copywriting') {
      const platform = params.platform;
      if (platform && !['小红书', '抖音', '微博', '公众号', '通用'].includes(String(platform))) {
        validationErrors.push('平台请选择"小红书"、"抖音"、"微博"、"公众号"或"通用"');
      }
      const style = params.style;
      if (style && !['正式', '活泼', '专业', '幽默', '文艺'].includes(String(style))) {
        validationErrors.push('文案风格请选择"正式"、"活泼"、"专业"、"幽默"或"文艺"');
      }
      const length = params.length;
      if (length && !['短', '中', '长'].includes(String(length))) {
        validationErrors.push('文案长度请选择"短"、"中"或"长"');
      }
    }
    if (intent === 'generate_poster') {
      const size = params.size;
      if (size && !['1:1', '9:16', '16:9'].includes(String(size))) {
        validationErrors.push('海报尺寸请选择"1:1"、"9:16"或"16:9"');
      }
    }
    if (intent === 'generate_avatar') {
      const text = params.text;
      if (text && String(text).length > 500) {
        validationErrors.push('数字人播报文本不能超过 500 字');
      }
    }

    if (validationErrors.length > 0 && parsedResult.readyToExecute) {
      parsedResult.readyToExecute = false;
      parsedResult.message = parsedResult.message + '\n\n⚠️ 参数校验未通过：\n' + validationErrors.map(e => '• ' + e).join('\n') + '\n\n请修改后重新确认。';
      parsedResult.progressSummary = '参数有误，需要修正';
    }

    return NextResponse.json({
      success: true,
      result: parsedResult,
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
