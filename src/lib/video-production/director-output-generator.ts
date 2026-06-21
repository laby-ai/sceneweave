/**
 * 导演方案输出生成器 (v3.1)
 * 支持专业导演方案 + 标准影视剧本双格式输出
 */

import type {
  DirectorOutput, WriterOutput, PipelineOutputV31,
  DirectorPlanMeta, OutputFormat,
} from './types';

/**
 * 导演方案输出生成器
 * 按照专业导演方案格式生成完整 Markdown 输出
 */
export class DirectorOutputGenerator {
  private pipeline: PipelineOutputV31;

  constructor(pipeline: PipelineOutputV31) {
    this.pipeline = pipeline;
  }

  /**
   * 生成输出 (按格式选择)
   */
  generate(format: OutputFormat = 'director_plan'): string {
    switch (format) {
      case 'director_plan':
        return this.generateDirectorPlan();
      case 'screenplay':
        return this.generateScreenplay();
      case 'both':
        return [
          this.generateDirectorPlan(),
          '\n\n---\n\n',
          this.generateScreenplay(),
        ].join('');
      default:
        return this.generateDirectorPlan();
    }
  }

  /**
   * 生成专业导演方案 Markdown
   */
  generateDirectorPlan(): string {
    const { story, direction, metadata } = this.pipeline;
    const meta = this.buildPlanMeta();
    const duration = metadata.config.duration;
    const aspectRatio = metadata.config.aspectRatio;

    const sections: string[] = [];

    // 一、故事构思
    sections.push(this.generateStoryConcept(meta, duration, aspectRatio));

    // 二、三幕式结构设计
    sections.push(this.generateThreeActStructure(duration));

    // 三、情绪曲线
    sections.push(this.generateEmotionCurve(duration));

    // 四、人物塑造
    sections.push(this.generateCharacterCards(story));

    // 五、分镜详细设计
    sections.push(this.generateStoryboardShots(direction));

    // 六、技术规格
    sections.push(this.generateTechSpecs(duration, aspectRatio));

    return sections.join('\n\n---\n\n');
  }

  /**
   * 生成标准影视剧本 Markdown
   */
  generateScreenplay(): string {
    const { story, direction } = this.pipeline;

    const lines: string[] = [];
    lines.push(`# 《${story.outline.slice(0, 20)}》完整场景剧本\n`);
    lines.push(`**类型**：${story.typeName}`);
    lines.push(`**时长**：约${Math.ceil(this.pipeline.metadata.config.duration / 60)}分钟`);
    lines.push(`**视觉风格**：${this.pipeline.metadata.config.style}\n`);

    // 人物表
    lines.push('## 人物表\n');
    const chars = story.characterProfiles;
    for (const [, char] of Object.entries(chars)) {
      lines.push(`- **${char.name}**: ${char.appearance}，${char.personality}`);
    }

    // 三幕
    lines.push('\n---\n');
    lines.push('## 第一幕：建置\n');
    this.appendActScenes(lines, direction, 0, 0.25);

    lines.push('\n---\n');
    lines.push('## 第二幕：冲突\n');
    this.appendActScenes(lines, direction, 0.25, 0.75);

    lines.push('\n---\n');
    lines.push('## 第三幕：结局\n');
    this.appendActScenes(lines, direction, 0.75, 1.0);

    lines.push('\n---\n*剧本终*');

    return lines.join('\n');
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private buildPlanMeta(): DirectorPlanMeta {
    const { story } = this.pipeline;
    return {
      title: story.outline.slice(0, 20),
      videoType: story.typeName,
      duration: this.pipeline.metadata.config.duration,
      aspectRatio: this.pipeline.metadata.config.aspectRatio,
      coreTheme: story.outline,
      themeRefinement: `基于${story.typeName}类型的结构化叙事`,
      narrativeStrategy: story.template.structure.map((s) => s.desc).join(' → '),
      emotionalTone: story.template.structure.map((s) => s.emotion).join(' → '),
    };
  }

  private generateStoryConcept(meta: DirectorPlanMeta, duration: number, aspectRatio: string): string {
    return `# ${meta.title} — 完整导演方案

## 一、故事构思

| 项目 | 内容 |
|------|------|
| 片名 | ${meta.title} |
| 类型 | ${meta.videoType} |
| 时长 | ${duration}秒 |
| 画幅 | ${aspectRatio} |
| 核心主题 | ${meta.coreTheme} |

**主题提炼**: ${meta.themeRefinement}

**叙事策略**: ${meta.narrativeStrategy}

**情感基调**: ${meta.emotionalTone}`;
  }

  private generateThreeActStructure(duration: number): string {
    const act1Duration = Math.round(duration * 0.25);
    const act2Duration = Math.round(duration * 0.50);
    const act3Duration = duration - act1Duration - act2Duration;

    return `## 二、三幕式结构设计

| 阶段 | 时间段 | 时长 | 占比 | 核心任务 |
|------|--------|------|------|----------|
| 第一幕 | 0-${act1Duration}s | ${act1Duration}s | 25% | 建置世界与氛围 |
| 第二幕 | ${act1Duration}-${act1Duration + act2Duration}s | ${act2Duration}s | 50% | 情感积累与深化 |
| 第三幕 | ${act1Duration + act2Duration}-${duration}s | ${act3Duration}s | 25% | 高潮与情感释放 |`;
  }

  private generateEmotionCurve(duration: number): string {
    const curve = this.pipeline.direction.emotionCurve;
    const q = Math.round(duration / 4);
    const h = Math.round(duration / 2);
    const tq = Math.round(duration * 3 / 4);

    let curveTable = '| 时间点 | 情绪 | 强度 |\n|--------|------|------|\n';
    for (const point of curve) {
      const time = Math.round((point.sequence / Math.max(curve.length, 1)) * duration);
      curveTable += `| ${time}s | ${point.emotion} | ${(point.intensity * 100).toFixed(0)}% |\n`;
    }

    return `## 三、情绪曲线

\`\`\`
情感强度 ▲
         │                                    ● 高潮
100%     │                                 ●────●
75%      │────────────────●─────────────────────●
50%      │          ●  ●  ●  ●
25%      │     ●  ●  ●  ●  ●  ●
  0%     └────────────────────────────────────────────────▶
         0s   ${q}s   ${h}s   ${tq}s   ${duration}s
\`\`\`

### 情绪节奏表

${curveTable}`;
  }

  private generateCharacterCards(story: WriterOutput): string {
    const sections: string[] = ['## 四、人物塑造\n'];

    for (const [, char] of Object.entries(story.characterProfiles)) {
      sections.push(`### ${char.id} ${char.name}`);
      sections.push(`- 外貌: ${char.appearance}`);
      sections.push(`- 性格: ${char.personality}`);
      sections.push(`- 动机: ${char.motivation}`);
      sections.push(`- 弧光: ${char.arc}`);

      const rels = Object.entries(char.relationships);
      if (rels.length > 0) {
        sections.push(`- 关系: ${rels.map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      }
      if (char.referenceSheet) {
        sections.push(`- 参考图提示词: \`${char.referenceSheet}\``);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private generateStoryboardShots(direction: DirectorOutput): string {
    const sections: string[] = ['## 五、分镜详细设计\n'];

    for (const shot of direction.shots) {
      sections.push(`### 分镜 ${shot.sequence} — ${shot.shotId}\n`);
      sections.push('| 项目 | 内容 |');
      sections.push('|------|------|');
      sections.push(`| 景别 | ${shot.shotType} |`);
      sections.push(`| 运镜 | ${shot.cameraMovement} |`);
      sections.push(`| 时长 | ${shot.duration}s |`);
      sections.push(`| 主体 | ${shot.subject} |`);
      sections.push(`| 环境 | ${shot.environment} |`);
      sections.push(`| 光影 | ${shot.lighting} |`);
      sections.push(`| 风格 | ${shot.style} |`);
      sections.push(`\n**画面描述**: ${shot.visualPrompt}`);
      if (shot.audioContent) {
        sections.push(`\n**音频**: ${shot.audioType} — ${shot.audioContent}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private generateTechSpecs(duration: number, aspectRatio: string): string {
    return `## 六、技术规格

| 项目 | 规格 |
|------|------|
| 输出格式 | MP4 (H.265) |
| 分辨率 | ${aspectRatio === '9:16' ? '1080x1920' : aspectRatio === '1:1' ? '1080x1080' : '1920x1080'} |
| 帧率 | 30fps |
| 宽高比 | ${aspectRatio} |
| 音频 | AAC 192kbps |
| 总时长 | ${duration}s |
| 生成方式 | 混合调度（素材库+AI生成） |

---

*本方案由 AI 自动化导演系统 v3.1 生成*`;
  }

  private appendActScenes(
    lines: string[],
    direction: DirectorOutput,
    startRatio: number,
    endRatio: number,
  ): void {
    const shots = direction.shots;
    const startIdx = Math.floor(startRatio * shots.length);
    const endIdx = Math.floor(endRatio * shots.length);

    for (let i = startIdx; i < endIdx && i < shots.length; i++) {
      const shot = shots[i];
      lines.push(`\n### 场景${i + 1}：${shot.subject || shot.shotId}\n`);
      lines.push(`**${shot.shotType} / ${shot.cameraMovement}** — ${shot.duration}s`);
      lines.push(`\n${shot.visualPrompt}`);
      if (shot.audioContent) {
        lines.push(`\n*${shot.audioType}: ${shot.audioContent}*`);
      }
      lines.push('');
    }
  }
}

/** 生成导演方案 */
export function generateDirectorOutput(
  pipeline: PipelineOutputV31,
  format: OutputFormat = 'director_plan',
): string {
  const generator = new DirectorOutputGenerator(pipeline);
  return generator.generate(format);
}
