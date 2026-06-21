'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Video,
  Image as ImageIcon,
  Sparkles,
  SlidersHorizontal,
  Eye,
  ArrowLeft,
  X,
} from 'lucide-react';
import {
  ALL_PRESET_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type GenerationTemplate,
} from '@/constants/templates';

interface TemplateSection {
  category: string;
  label: string;
  icon: React.ReactNode;
  templates: GenerationTemplate[];
}

export default function TemplatesPage() {
  const router = useRouter();
  const [globalSearch, setGlobalSearch] = useState('');
  const [sectionSearches, setSectionSearches] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<GenerationTemplate | null>(null);
  const [compareTemplate, setCompareTemplate] = useState<GenerationTemplate | null>(null);
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 按分类分组
  const sections = useMemo<TemplateSection[]>(() => {
    const videoTemplates = ALL_PRESET_TEMPLATES.filter(t => t.type === 'video');
    const imageTemplates = ALL_PRESET_TEMPLATES.filter(t => t.type === 'image');

    const videoSections: TemplateSection[] = TEMPLATE_CATEGORIES
      .filter(c => c.id !== 'all')
      .map(cat => ({
        category: cat.id,
        label: cat.name,
        icon: <span>{cat.icon}</span>,
        templates: videoTemplates.filter(t => t.category === cat.id),
      }))
      .filter(s => s.templates.length > 0);

    const imageSections: TemplateSection[] = TEMPLATE_CATEGORIES
      .filter(c => c.id !== 'all')
      .map(cat => ({
        category: cat.id,
        label: cat.name,
        icon: <span>{cat.icon}</span>,
        templates: imageTemplates.filter(t => t.category === cat.id),
      }))
      .filter(s => s.templates.length > 0);

    return [
      ...videoSections,
      ...imageSections,
    ];
  }, []);

  // 全局搜索过滤
  const filteredSections = useMemo(() => {
    if (!globalSearch.trim()) return sections;
    const q = globalSearch.toLowerCase();
    return sections
      .map(sec => ({
        ...sec,
        templates: sec.templates.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q))
        ),
      }))
      .filter(sec => sec.templates.length > 0);
  }, [sections, globalSearch]);

  // 分区内搜索
  const getSectionFiltered = (section: TemplateSection) => {
    const q = sectionSearches[section.category]?.toLowerCase() || '';
    if (!q) return section.templates;
    return section.templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  };

  const scrollSection = (category: string, direction: 'left' | 'right') => {
    const el = scrollRefs.current[category];
    if (!el) return;
    const scrollAmount = 320;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleUseTemplate = (template: GenerationTemplate) => {
    router.push(`/?template=${template.id}`);
  };

  return (
    <div className="min-h-screen bg-background text-white">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h1 className="text-lg font-semibold">模板中心</h1>
          <div className="flex-1" />
          {/* 全局搜索 */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="搜索模板..."
              className="pl-9 h-9 bg-accent/30 border-border text-white placeholder:text-white/30 text-sm rounded-full"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {filteredSections.length === 0 && (
          <div className="text-center py-20 text-white/40">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">未找到匹配的模板</p>
            <p className="text-sm mt-1">尝试其他关键词或清空搜索</p>
          </div>
        )}

        {filteredSections.map(section => {
          const filtered = getSectionFiltered(section);
          if (filtered.length === 0) return null;

          return (
            <div key={section.category} className="space-y-3">
              {/* 分区标题 + 搜索 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-white/90">
                  {section.icon}
                  <h2 className="text-base font-semibold">{section.label}</h2>
                  <Badge variant="secondary" className="bg-accent/50 text-muted-foreground text-xs px-2 py-0">
                    {filtered.length}
                  </Badge>
                </div>
                <div className="flex-1" />
                {/* 分区搜索 */}
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                  <Input
                    value={sectionSearches[section.category] || ''}
                    onChange={e =>
                      setSectionSearches(prev => ({
                        ...prev,
                        [section.category]: e.target.value,
                      }))
                    }
                    placeholder="搜索..."
                    className="pl-8 h-7 bg-accent/30 border-border text-white placeholder:text-white/25 text-xs rounded-full"
                  />
                </div>
                {/* 左右滑动按钮 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollSection(section.category, 'left')}
                    className="w-7 h-7 rounded-full bg-accent/30 hover:bg-accent flex items-center justify-center text-white/40 hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollSection(section.category, 'right')}
                    className="w-7 h-7 rounded-full bg-accent/30 hover:bg-accent flex items-center justify-center text-white/40 hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 横向滚动卡片列表 */}
              <div
                ref={el => { scrollRefs.current[section.category] = el; }}
                className="flex gap-4 overflow-x-auto scrollbar-thin pb-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {filtered.map(template => (
                  <div
                    key={template.id}
                    className="flex-shrink-0 w-[260px] group cursor-pointer"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    {/* 卡片 */}
                    <div className="relative rounded-xl border border-white/8 bg-white/3 overflow-hidden transition-all duration-200 hover:border-[#EF4444]/30 hover:bg-accent/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#EF4444]/5">
                      {/* 缩略图区域 */}
                      <div className="relative h-[146px] bg-gradient-to-br from-white/5 to-white/2 flex items-center justify-center">
                        {template.type === 'video' ? (
                          <Video className="w-10 h-10 text-white/15" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-white/15" />
                        )}
                        {/* 类型标签 */}
                        <div className="absolute top-2 left-2">
                          <Badge className={`text-[10px] px-1.5 py-0 ${template.type === 'video' ? 'bg-red-600/80' : 'bg-emerald-600/80'} text-white border-0`}>
                            {template.type === 'video' ? '视频' : '图片'}
                          </Badge>
                        </div>
                        {/* 热度标签 */}
                        {template.usageCount > 1000 && (
                          <div className="absolute top-2 right-2">
                            <Badge className="text-[10px] px-1.5 py-0 bg-red-600/70 text-white border-0">
                              热门
                            </Badge>
                          </div>
                        )}
                        {/* hover 叠加层 */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={e => { e.stopPropagation(); handleUseTemplate(template); }}
                            className="bg-[#EF4444] text-black hover:bg-[#EF4444]/80 text-xs h-8 px-4 rounded-full"
                          >
                            使用模板
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              if (compareTemplate?.id === template.id) {
                                setCompareTemplate(null);
                              } else {
                                setCompareTemplate(template);
                              }
                            }}
                            className={`text-xs h-8 px-3 rounded-full ${compareTemplate?.id === template.id ? 'bg-red-600 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            对比
                          </Button>
                        </div>
                      </div>
                      {/* 信息区 */}
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-white/90 truncate">{template.name}</h3>
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{template.description}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {template.tags?.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] text-white/30 bg-accent/30 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 模板详情弹窗 */}
      {selectedTemplate && !compareTemplate && (
        <TemplateDetailOverlay
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onUse={() => handleUseTemplate(selectedTemplate)}
          onCompare={() => {
            setCompareTemplate(selectedTemplate);
          }}
        />
      )}

      {/* 对比视图 */}
      {compareTemplate && (
        <CompareOverlay
          templateA={compareTemplate}
          templateB={selectedTemplate && selectedTemplate.id !== compareTemplate.id ? selectedTemplate : null}
          onClose={() => { setCompareTemplate(null); setSelectedTemplate(null); }}
          onUse={handleUseTemplate}
        />
      )}
    </div>
  );
}

/* ---- 子组件 ---- */

function TemplateDetailOverlay({
  template,
  onClose,
  onUse,
  onCompare,
}: {
  template: GenerationTemplate;
  onClose: () => void;
  onUse: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="relative h-48 bg-gradient-to-br from-white/5 to-white/2 flex items-center justify-center">
          {template.type === 'video' ? (
            <Video className="w-16 h-16 text-white/10" />
          ) : (
            <ImageIcon className="w-16 h-16 text-white/10" />
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* 内容 */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.tags?.map(tag => (
              <Badge key={tag} variant="secondary" className="bg-accent/50 text-muted-foreground text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-accent/30 rounded-lg p-2">
              <div className="text-white/40 text-xs">风格</div>
              <div className="text-foreground/80 mt-0.5">{template.style || '-'}</div>
            </div>
            <div className="bg-accent/30 rounded-lg p-2">
              <div className="text-white/40 text-xs">情绪</div>
              <div className="text-foreground/80 mt-0.5">{template.mood || '-'}</div>
            </div>
            <div className="bg-accent/30 rounded-lg p-2">
              <div className="text-white/40 text-xs">使用次数</div>
              <div className="text-foreground/80 mt-0.5">{template.usageCount ?? 0}</div>
            </div>
          </div>
          {template.variables && template.variables.length > 0 && (
            <div>
              <div className="text-xs text-white/40 mb-2">可配置参数 ({template.variables.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map(v => (
                  <span key={v.id} className="text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded-full">
                    {v.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={onUse} className="flex-1 bg-[#EF4444] text-black hover:bg-[#EF4444]/80 rounded-full">
              <Sparkles className="w-4 h-4 mr-2" />
              使用此模板
            </Button>
            <Button onClick={onCompare} variant="outline" className="border-white/20 text-foreground/70 hover:bg-accent/50 rounded-full">
              <Eye className="w-4 h-4 mr-2" />
              对比
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareOverlay({
  templateA,
  templateB,
  onClose,
  onUse,
}: {
  templateA: GenerationTemplate;
  templateB: GenerationTemplate | null;
  onClose: () => void;
  onUse: (t: GenerationTemplate) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-4xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#EF4444]" />
            模板对比
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* 对比区域 */}
        <div className="grid grid-cols-2 divide-x divide-white/10">
          {[templateA, templateB].map((t, idx) => (
            <div key={t?.id ?? idx} className="p-5 space-y-4">
              {t ? (
                <>
                  <div className="h-36 bg-gradient-to-br from-white/5 to-white/2 rounded-lg flex items-center justify-center">
                    {t.type === 'video' ? <Video className="w-10 h-10 text-white/10" /> : <ImageIcon className="w-10 h-10 text-white/10" />}
                  </div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/40">风格</span>
                      <span className="text-foreground/80">{t.style || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">情绪</span>
                      <span className="text-foreground/80">{t.mood || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">类型</span>
                      <Badge className={`text-[10px] ${t.type === 'video' ? 'bg-red-600/80' : 'bg-emerald-600/80'} text-white border-0`}>
                        {t.type === 'video' ? '视频' : '图片'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">参数</span>
                      <span className="text-foreground/80">{t.variables?.length ?? 0} 个</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">使用次数</span>
                      <span className="text-foreground/80">{t.usageCount ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.tags?.map(tag => (
                      <span key={tag} className="text-[10px] text-white/30 bg-accent/30 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                  <Button onClick={() => onUse(t)} className="w-full bg-[#EF4444] text-black hover:bg-[#EF4444]/80 rounded-full">
                    使用此模板
                  </Button>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-white/20 text-sm">
                  点击其他模板的「对比」按钮添加到此栏
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
