import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// AIGC 合规检测 API - 基于《深度合成服务规定》《生成式AI管理暂行办法》等法规
// 对 AI 生成内容进行风险分类检测

interface ComplianceCheckRequest {
  content: string;
  type: 'video' | 'image' | 'text' | 'audio';
  title?: string;
  prompt?: string;
}

interface ComplianceIssue {
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  legalBasis: string;
  suggestion: string;
}

interface ComplianceCheckResult {
  overallRisk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  issues: ComplianceIssue[];
  piiDetected: { type: string; value: string; position: number }[];
  watermarkRequired: boolean;
  labelRequired: boolean;
  summary: string;
}

// PII 检测（不依赖 Python，纯 JS 实现）
function detectPII(text: string): { type: string; value: string; position: number }[] {
  const patterns: { type: string; pattern: RegExp }[] = [
    { type: 'phone', pattern: /1[3-9]\d{9}/g },
    { type: 'id_card', pattern: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g },
    { type: 'email', pattern: /[\w.-]+@[\w.-]+\.\w+/g },
    { type: 'bank_card', pattern: /(?:62|4\d|5[1-5])\d{14,17}/g },
    { type: 'address', pattern: /(?:省|市|区|县|路|街|号|楼|室|栋|层).{2,20}/g },
  ];

  const results: { type: string; value: string; position: number }[] = [];
  for (const { type, pattern } of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        type,
        value: match[0],
        position: match.index,
      });
    }
  }
  return results;
}

// 关键词风险检测
function detectKeywordRisks(text: string): ComplianceIssue[] {
  const riskKeywords: { category: string; keywords: string[]; riskLevel: ComplianceIssue['riskLevel']; legalBasis: string }[] = [
    {
      category: '政治敏感',
      keywords: ['颠覆', '分裂', '恐怖', '极端'],
      riskLevel: 'critical',
      legalBasis: '《深度合成服务规定》第7条：不得生成含有危害国家安全内容',
    },
    {
      category: '虚假信息',
      keywords: ['伪造', '造假', '虚假新闻', '冒充官方'],
      riskLevel: 'high',
      legalBasis: '《生成式AI管理暂行办法》第12条：不得生成虚假信息',
    },
    {
      category: '色情低俗',
      keywords: ['裸体', '色情', '淫秽'],
      riskLevel: 'critical',
      legalBasis: '《深度合成服务规定》第7条：不得生成淫秽色情内容',
    },
    {
      category: '暴力血腥',
      keywords: ['杀戮', '血腥', '暴力', '自残'],
      riskLevel: 'high',
      legalBasis: '《网络信息内容生态治理规定》第6条：不得制作暴力血腥内容',
    },
    {
      category: '歧视偏见',
      keywords: ['种族歧视', '性别歧视', '地域歧视'],
      riskLevel: 'medium',
      legalBasis: '《生成式AI管理暂行办法》第12条：不得含有歧视性内容',
    },
    {
      category: '未成年人保护',
      keywords: ['未成年', '儿童', '青少年', '少男少女'],
      riskLevel: 'high',
      legalBasis: '《未成年人网络保护条例》第26条：AI生成内容涉及未成年人需特别标注',
    },
    {
      category: '知识产权',
      keywords: ['版权', '商标', '专利侵权', '盗版'],
      riskLevel: 'medium',
      legalBasis: '《著作权法》第24条：AI生成内容需尊重知识产权',
    },
    {
      category: '肖像权',
      keywords: ['换脸', '人脸替换', 'AI换脸', 'Deepfake'],
      riskLevel: 'high',
      legalBasis: '《民法典》第1019条：不得利用信息技术手段伪造他人肖像',
    },
  ];

  const issues: ComplianceIssue[] = [];
  const lowerText = text.toLowerCase();

  for (const rule of riskKeywords) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword)) {
        issues.push({
          category: rule.category,
          riskLevel: rule.riskLevel,
          description: `检测到敏感关键词「${keyword}」，可能涉及${rule.category}相关风险`,
          legalBasis: rule.legalBasis,
          suggestion: getSuggestion(rule.category, rule.riskLevel),
        });
      }
    }
  }

  return issues;
}

function getSuggestion(category: string, riskLevel: string): string {
  const suggestions: Record<string, string> = {
    政治敏感: '请移除相关敏感内容，确保内容不涉及政治敏感话题',
    虚假信息: '请确保内容真实可靠，避免生成虚假或误导性信息',
    色情低俗: '请移除低俗色情内容，确保内容健康向上',
    暴力血腥: '请减少暴力元素，避免过于血腥的画面描述',
    歧视偏见: '请使用中性语言，避免任何形式的歧视性表达',
    未成年人保护: '涉及未成年人内容需添加特别标注和风险提示',
    知识产权: '请确保使用原创或已授权内容，标注来源',
    肖像权: 'AI换脸需获得本人书面同意，并添加AI生成标识',
  };
  const base = suggestions[category] || '请检查并调整相关内容';
  if (riskLevel === 'critical') return `【必须修改】${base}，否则内容不可发布`;
  if (riskLevel === 'high') return `【强烈建议修改】${base}`;
  return `【建议优化】${base}`;
}

function calculateOverallRisk(issues: ComplianceIssue[]): ComplianceCheckResult['overallRisk'] {
  if (issues.some(i => i.riskLevel === 'critical')) return 'critical';
  if (issues.some(i => i.riskLevel === 'high')) return 'high';
  if (issues.some(i => i.riskLevel === 'medium')) return 'medium';
  if (issues.length > 0) return 'low';
  return 'safe';
}

// LLM 增强检测（调用 AI 服务进行深度分析）
async function llmEnhancedCheck(
  content: string,
  type: string,
  title?: string,
  prompt?: string
): Promise<ComplianceIssue[]> {
  try {
    const legalBasis = await readFile(
      join(process.cwd(), 'src/lib/aigc-compliance/references/legal-basis.md'),
      'utf-8'
    ).catch(() => '');
    const platformPolicies = await readFile(
      join(process.cwd(), 'src/lib/aigc-compliance/references/platform-policies.md'),
      'utf-8'
    ).catch(() => '');

    const systemPrompt = `你是AIGC合规检测专家，基于以下法规和平台政策对AI生成内容进行风险评估：

${legalBasis}

${platformPolicies}

请严格按照以下JSON格式输出检测结果数组，每个元素包含：
- category: 风险类别
- riskLevel: riskLevel (low/medium/high/critical)  
- description: 风险描述
- legalBasis: 法条依据
- suggestion: 修改建议

如果没有风险，返回空数组 []`;

    const userPrompt = `请检测以下AI生成的${type}内容是否存在合规风险：
${title ? `标题：${title}` : ''}
${prompt ? `用户提示词：${prompt}` : ''}
内容：${content.substring(0, 2000)}`;

    // 使用项目已有的 AI 服务适配器
    const { CozeAPI } = await import('@/lib/coze-api');
    const response = await CozeAPI.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1 }
    );

    // 解析 LLM 返回的 JSON
    const llmContent = response.content || '';
    const jsonMatch = llmContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: Record<string, string>) => ({
        category: item.category || '其他',
        riskLevel: item.riskLevel || 'low',
        description: item.description || '',
        legalBasis: item.legalBasis || '',
        suggestion: item.suggestion || '',
      }));
    }
    return [];
  } catch (error) {
    console.error('[compliance] LLM enhanced check failed:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ComplianceCheckRequest;
    const { content, type, title, prompt } = body;

    if (!content || !type) {
      return NextResponse.json(
        { error: '请提供 content 和 type 参数' },
        { status: 400 }
      );
    }

    // 第一层：PII 检测
    const piiDetected = detectPII(content);

    // 第二层：关键词风险检测
    const keywordIssues = detectKeywordRisks(content);

    // 第三层：LLM 增强检测（深度语义分析）
    const llmIssues = await llmEnhancedCheck(content, type, title, prompt);

    // 合并去重
    const allIssues = [...keywordIssues];
    for (const llmIssue of llmIssues) {
      if (!allIssues.some(ki => ki.category === llmIssue.category)) {
        allIssues.push(llmIssue);
      }
    }

    // 判断是否需要水印和标识
    const watermarkRequired = type === 'image' || type === 'video';
    const labelRequired = true; // 所有 AIGC 内容均需标识

    const overallRisk = calculateOverallRisk(allIssues);

    const summary = generateSummary(overallRisk, allIssues, piiDetected, watermarkRequired);

    const result: ComplianceCheckResult = {
      overallRisk,
      issues: allIssues,
      piiDetected,
      watermarkRequired,
      labelRequired,
      summary,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[compliance] Check failed:', error);
    return NextResponse.json(
      { error: '合规检测失败，请稍后重试' },
      { status: 500 }
    );
  }
}

function generateSummary(
  risk: ComplianceCheckResult['overallRisk'],
  issues: ComplianceIssue[],
  pii: ComplianceCheckResult['piiDetected'],
  watermark: boolean
): string {
  const riskLabels: Record<string, string> = {
    safe: '✅ 安全 - 内容符合合规要求',
    low: '⚠️ 低风险 - 建议优化个别表述',
    medium: '🟡 中风险 - 存在需修改的合规问题',
    high: '🔴 高风险 - 必须修改后方可发布',
    critical: '🚫 严重风险 - 内容不可发布',
  };

  let summary = riskLabels[risk];
  if (issues.length > 0) {
    summary += `\n发现 ${issues.length} 个风险项`;
  }
  if (pii.length > 0) {
    summary += `，${pii.length} 处个人隐私信息`;
  }
  if (watermark) {
    summary += '，需添加AI生成水印标识';
  }
  return summary;
}
