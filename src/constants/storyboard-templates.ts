/**
 * 分镜头场景预设模板
 * 提供常用的工作流模板供用户选择
 */

import type { StoryboardScene } from '@/types/storyboard-scene';

// 模板类型
export interface StoryboardTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail?: string;
  scenes: Array<Partial<StoryboardScene> & {
    title?: string;
    description: string;
    duration: number;
  }>;
  tags: string[];
  useCases: string[];
  author?: string;
  isPublic?: boolean;
  usageCount?: number;
}

// 产品展示模板 - 经典4场景
export const PRODUCT_SHOWCASE_TEMPLATE: StoryboardTemplate = {
  id: 'product-showcase-classic',
  name: '产品展示（经典4场景）',
  category: '产品展示',
  description: '经典的产品展示分镜头模板，包含场景展示、细节特写、使用演示、环境展示四个核心场景',
  tags: ['产品', '电商', '展示'],
  useCases: ['电商产品视频', '产品宣传片', '新品发布'],
  scenes: [
    {
      title: '场景展示',
      description: '展示产品整体外观，全景展示产品在真实环境中的摆放和整体造型',
      duration: 5
    },
    {
      title: '细节特写',
      description: '特写镜头展示产品细节、材质、工艺、logo等关键特征',
      duration: 4
    },
    {
      title: '使用演示',
      description: '展示产品的使用方法、功能特点、操作流程',
      duration: 6
    },
    {
      title: '环境展示',
      description: '产品在真实使用场景中的展示，突出产品与环境的融合',
      duration: 5
    }
  ]
};

// Vlog风格模板
export const VLOG_STYLE_TEMPLATE: StoryboardTemplate = {
  id: 'vlog-style',
  name: 'Vlog风格',
  category: 'Vlog/叙事',
  description: 'Vlog风格的分镜头模板，自然流畅，适合个人叙事和日常生活记录',
  tags: ['Vlog', '个人', '日常'],
  useCases: ['日常Vlog', '旅行记录', '生活分享'],
  scenes: [
    {
      title: '开场问候',
      description: '镜头前直接与观众打招呼，介绍本期内容主题',
      duration: 4
    },
    {
      title: '内容展开',
      description: '主要内容展示，多角度、多景别展现核心事件',
      duration: 8
    },
    {
      title: '细节互动',
      description: '特写镜头展示关键细节，增加互动感和代入感',
      duration: 5
    },
    {
      title: '总结收尾',
      description: '总结本期内容，与观众互动，预告下一期',
      duration: 4
    }
  ]
};

// 剧情叙事模板
export const DRAMA_STORY_TEMPLATE: StoryboardTemplate = {
  id: 'drama-story',
  name: '剧情叙事',
  category: '剧情/故事',
  description: '经典的三幕式叙事结构，包含开端、发展、高潮、结局',
  tags: ['剧情', '故事', '叙事'],
  useCases: ['短视频剧情', '品牌故事', '微电影'],
  scenes: [
    {
      title: '开端（铺垫）',
      description: '介绍人物、环境、背景，建立故事基调',
      duration: 5
    },
    {
      title: '发展（推进）',
      description: '事件发展，冲突出现，情节层层递进',
      duration: 8
    },
    {
      title: '高潮（爆发）',
      description: '矛盾激化，情节达到最高点，情感最强烈时刻',
      duration: 6
    },
    {
      title: '结局（收尾）',
      description: '矛盾解决，故事收尾，给观众完整感',
      duration: 5
    }
  ]
};

// 教育讲解模板
export const EDUCATION_TEMPLATE: StoryboardTemplate = {
  id: 'education-explainer',
  name: '教育讲解',
  category: '教育/知识',
  description: '适合知识讲解、教程类视频，结构清晰，便于理解',
  tags: ['教育', '教程', '知识'],
  useCases: ['知识科普', '技能教程', '产品教学'],
  scenes: [
    {
      title: '引入主题',
      description: '提出问题或话题，引起观众兴趣，点明本期主题',
      duration: 4
    },
    {
      title: '核心讲解',
      description: '主要内容讲解，多角度、分步骤详细说明',
      duration: 10
    },
    {
      title: '演示示例',
      description: '实际操作演示，通过实例让观众更直观理解',
      duration: 8
    },
    {
      title: '总结回顾',
      description: '总结重点，回顾关键知识点，给出行动建议',
      duration: 4
    }
  ]
};

// 广告推广模板
export const ADVERTISING_TEMPLATE: StoryboardTemplate = {
  id: 'advertising-promo',
  name: '广告推广',
  category: '广告/营销',
  description: '适合产品推广和营销视频，突出卖点，促进转化',
  tags: ['广告', '营销', '推广'],
  useCases: ['产品广告', '促销视频', '品牌宣传片'],
  scenes: [
    {
      title: '痛点/需求',
      description: '展示用户痛点或需求场景，引起共鸣',
      duration: 3
    },
    {
      title: '产品登场',
      description: '产品登场，展示产品如何解决问题',
      duration: 4
    },
    {
      title: '卖点展示',
      description: '突出产品核心卖点和优势',
      duration: 6
    },
    {
      title: '行动号召',
      description: '引导用户采取行动，促进转化',
      duration: 4
    }
  ]
};

// 美食展示模板
export const FOOD_SHOWCASE_TEMPLATE: StoryboardTemplate = {
  id: 'food-showcase',
  name: '美食展示',
  category: '美食/生活',
  description: '适合美食类视频，展现食材、制作过程和成品',
  tags: ['美食', '烹饪', '生活'],
  useCases: ['美食视频', '烹饪教程', '餐厅宣传'],
  scenes: [
    {
      title: '食材展示',
      description: '展示新鲜食材，强调品质和新鲜感',
      duration: 4
    },
    {
      title: '制作过程',
      description: '关键制作步骤展示，突出手艺和细节',
      duration: 8
    },
    {
      title: '成品特写',
      description: '最终成品展示，特写细节，激发食欲',
      duration: 5
    },
    {
      title: '享用时刻',
      description: '展示享用美食的场景，传递幸福感',
      duration: 4
    }
  ]
};

// 所有模板集合
export const STORYBOARD_TEMPLATES: StoryboardTemplate[] = [
  PRODUCT_SHOWCASE_TEMPLATE,
  VLOG_STYLE_TEMPLATE,
  DRAMA_STORY_TEMPLATE,
  EDUCATION_TEMPLATE,
  ADVERTISING_TEMPLATE,
  FOOD_SHOWCASE_TEMPLATE
];

// 模板分类
export const STORYBOARD_TEMPLATE_CATEGORIES = [
  '产品展示',
  'Vlog/叙事',
  '剧情/故事',
  '教育/知识',
  '广告/营销',
  '美食/生活'
] as const;

export type StoryboardTemplateCategory = typeof STORYBOARD_TEMPLATE_CATEGORIES[number];

// 根据分类获取模板
export function getTemplatesByCategory(category: string): StoryboardTemplate[] {
  return STORYBOARD_TEMPLATES.filter(template => template.category === category);
}

// 根据ID获取模板
export function getTemplateById(id: string): StoryboardTemplate | undefined {
  return STORYBOARD_TEMPLATES.find(template => template.id === id);
}

// 搜索模板
export function searchTemplates(query: string): StoryboardTemplate[] {
  const lowerQuery = query.toLowerCase();
  return STORYBOARD_TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// 生成场景实例
export function createScenesFromTemplate(template: StoryboardTemplate): StoryboardScene[] {
  let currentTime = 0;
  
  return template.scenes.map((sceneTemplate, index) => {
    const startTime = currentTime;
    const endTime = currentTime + sceneTemplate.duration;
    currentTime = endTime;
    
    return {
      id: `scene-${Date.now()}-${index}`,
      index,
      startTime,
      endTime,
      duration: sceneTemplate.duration,
      title: sceneTemplate.title,
      description: sceneTemplate.description,
      shotIds: [],
      status: 'draft' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  });
}
