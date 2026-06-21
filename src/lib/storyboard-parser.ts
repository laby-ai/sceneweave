/**
 * 分镜解析器
 * 将自然语言分镜描述解析为结构化数据
 * 源自自动化导演技能 01_storyboard_parser.py
 */

/** 解析后的分镜 */
export interface ParsedShot {
  shotNumber: number;
  shotType: string;       // 景别：极远景/远景/中景/近景/特写/大特写
  movement: string;       // 运镜：固定/推/拉/摇/移/跟/升/降/甩
  lighting: string;       // 光线：硬光/软光/逆光/顶光/底光/剪影/霓虹
  content: string;        // 画面内容
  dialogue: string;       // 对白
  duration: number;       // 时长（秒）
  characters: string[];   // 出镜角色
  soundEffect: string;    // 音效
}

/** 分镜解析结果 */
export interface StoryboardParseResult {
  shots: ParsedShot[];
  totalDuration: number;
  shotCount: number;
  summary: string;
}

/** 景别关键词映射 */
const SHOT_KEYWORDS: Record<string, string[]> = {
  极远景: ['极远景', 'ELS', '大远景', '航拍', '鸟瞰'],
  远景: ['远景', 'WS', '全景', '大全景'],
  中景: ['中景', 'MS', '半身', ' waist'],
  近景: ['近景', 'CU', '胸部以上'],
  特写: ['特写', 'TCU', '大特写', '面部特写', '眼神'],
  大特写: ['大特写', 'ECU', '局部特写', '细节'],
};

/** 运镜关键词映射 */
const MOVEMENT_KEYWORDS: Record<string, string[]> = {
  固定: ['固定', '静止', '不动', '定机位'],
  推: ['推', '推进', 'zoom in', '推镜头'],
  拉: ['拉', '拉远', 'zoom out', '拉镜头'],
  摇: ['摇', '摇镜头', 'pan', '左右摇', '上下摇'],
  移: ['移', '移动', '移镜头', 'track', '横移'],
  跟: ['跟', '跟拍', '跟踪', '跟随'],
  升: ['升', '上升', 'crane up', '升起'],
  降: ['降', '下降', 'crane down', '降落'],
  甩: ['甩', '甩镜头', 'whip pan'],
  环绕: ['环绕', '旋转', 'orbit', '航拍环绕'],
};

/** 光线关键词映射 */
const LIGHTING_KEYWORDS: Record<string, string[]> = {
  硬光: ['硬光', '强光', '直射', '硬朗'],
  软光: ['软光', '柔光', '散射', '柔和'],
  逆光: ['逆光', '背光', '轮廓光', '剪影'],
  顶光: ['顶光', '正上方', '顶灯'],
  底光: ['底光', '下方', '脚光', '底灯'],
  霓虹: ['霓虹', '彩色光', '赛博', 'cyberpunk'],
  自然光: ['自然光', '日光', '阳光', '天光'],
  暖光: ['暖光', '暖色', '金黄色', '温馨'],
  冷光: ['冷光', '冷色', '蓝色调', '冷峻'],
};

/** 分镜解析器 */
export class StoryboardParser {
  /** 解析自然语言分镜文本 */
  parse(storyboardText: string): StoryboardParseResult {
    const lines = storyboardText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const shots: ParsedShot[] = [];
    let shotNumber = 1;

    for (const line of lines) {
      const shot = this.parseLine(line, shotNumber);
      if (shot.content.length > 0) {
        shots.push(shot);
        shotNumber++;
      }
    }

    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

    return {
      shots,
      totalDuration,
      shotCount: shots.length,
      summary: `共${shots.length}个镜头，总时长${totalDuration}秒`,
    };
  }

  /** 解析单行 */
  private parseLine(line: string, shotNumber: number): ParsedShot {
    const shotType = this.detectKeyword(line, SHOT_KEYWORDS);
    const movement = this.detectKeyword(line, MOVEMENT_KEYWORDS);
    const lighting = this.detectKeyword(line, LIGHTING_KEYWORDS);
    const duration = this.extractDuration(line);
    const dialogue = this.extractDialogue(line);
    const soundEffect = this.extractSoundEffect(line);

    // 清理内容：移除标记符号后作为画面内容
    let content = line
      .replace(/^\d+[\.、]\s*/, '')
      .replace(/「[^」]*」/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/【[^】]*】/g, '')
      .trim();

    // 限制内容长度
    if (content.length > 100) {
      content = content.substring(0, 100) + '...';
    }

    return {
      shotNumber,
      shotType,
      movement,
      lighting,
      content: content || line,
      dialogue,
      duration,
      characters: this.extractCharacters(line),
      soundEffect,
    };
  }

  /** 检测关键词 */
  private detectKeyword(text: string, keywordMap: Record<string, string[]>): string {
    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((k) => text.includes(k))) {
        return category;
      }
    }
    return '';
  }

  /** 提取时长 */
  private extractDuration(text: string): number {
    const match = text.match(/(\d+(?:\.\d+)?)\s*[秒秒s]/);
    if (match) return parseFloat(match[1]);
    return 3; // 默认3秒
  }

  /** 提取对白 */
  private extractDialogue(text: string): string {
    const match = text.match(/「([^」]*)」/);
    return match ? match[1] : '';
  }

  /** 提取音效 */
  private extractSoundEffect(text: string): string {
    const match = text.match(/\[([^\]]*)\]/);
    return match ? match[1] : '';
  }

  /** 提取角色 */
  private extractCharacters(text: string): string[] {
    const names = text.match(/[\u4e00-\u9fa5]{2,4}(?:说道|说|喊|叫)/g);
    return names ? names.map((n) => n.replace(/(?:说道|说|喊|叫)$/, '')) : [];
  }
}

/** 全局解析器实例 */
export const storyboardParser = new StoryboardParser();
