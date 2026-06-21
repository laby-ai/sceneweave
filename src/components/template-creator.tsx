'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Save,
  Eye,
  Settings,
  Type,
  Image as ImageIcon,
  Video,
  Sparkles,
  X,
  Check
} from 'lucide-react';
import {
  TEMPLATE_CATEGORIES,
  type GenerationTemplate,
  type TemplateVariable
} from '@/constants/templates';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';
import { FILTER_OPTIONS } from '@/constants/filters';
import { COLOR_THEME_OPTIONS } from '@/constants/colors';

interface TemplateCreatorProps {
  initialTemplate?: GenerationTemplate;
  onSave?: (template: GenerationTemplate) => void;
  onCancel?: () => void;
}

const VARIABLE_TYPES = [
  { value: 'text', label: '文本输入' },
  { value: 'select', label: '下拉选择' },
  { value: 'number', label: '数字输入' },
];

export function TemplateCreator({ initialTemplate, onSave, onCancel }: TemplateCreatorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [templateType, setTemplateType] = useState<'video' | 'image'>(initialTemplate?.type || 'image');
  const [templateName, setTemplateName] = useState(initialTemplate?.name || '');
  const [templateDescription, setTemplateDescription] = useState(initialTemplate?.description || '');
  const [category, setCategory] = useState(initialTemplate?.category || 'custom');
  const [promptTemplate, setPromptTemplate] = useState(initialTemplate?.promptTemplate || '');
  const [variables, setVariables] = useState<TemplateVariable[]>(initialTemplate?.variables || []);
  const [tags, setTags] = useState<string[]>(initialTemplate?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isPublic, setIsPublic] = useState(initialTemplate?.isPublic ?? true);

  // 高级设置
  const [style, setStyle] = useState(initialTemplate?.style || 'none');
  const [mood, setMood] = useState(initialTemplate?.mood || 'none');
  const [filter, setFilter] = useState(initialTemplate?.filter || 'none');
  const [colorTheme, setColorTheme] = useState(initialTemplate?.colorTheme || 'none');

  // 添加新变量
  const addVariable = () => {
    const newVariable: TemplateVariable = {
      id: Date.now().toString(),
      name: '新变量',
      type: 'text',
      required: true,
      placeholder: '请输入...',
    };
    setVariables([...variables, newVariable]);
  };

  // 更新变量
  const updateVariable = (id: string, updates: Partial<TemplateVariable>) => {
    setVariables(variables.map(v => 
      v.id === id ? { ...v, ...updates } : v
    ));
  };

  // 删除变量
  const removeVariable = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
  };

  // 添加标签
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // 删除标签
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // 生成预览
  const getPreviewPrompt = () => {
    let result = promptTemplate;
    variables.forEach(variable => {
      const placeholder = `{${variable.id}}`;
      const value = variable.defaultValue || `[${variable.name}]`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });
    return result;
  };

  // 保存模板
  const handleSave = () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    if (!promptTemplate.trim()) {
      alert('请输入提示词模板');
      return;
    }

    const newTemplate: GenerationTemplate = {
      id: initialTemplate?.id || Date.now().toString(),
      name: templateName,
      description: templateDescription,
      type: templateType,
      category,
      promptTemplate,
      variables,
      style: style !== 'none' ? style : undefined,
      mood: mood !== 'none' ? mood : undefined,
      filter: filter !== 'none' ? filter : undefined,
      colorTheme: colorTheme !== 'none' ? colorTheme : undefined,
      tags,
      isPublic,
      usageCount: initialTemplate?.usageCount || 0,
      createdAt: initialTemplate?.createdAt || Date.now(),
    };

    if (onSave) {
      onSave(newTemplate);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {initialTemplate ? '编辑模板' : '创建新模板'}
              </CardTitle>
              <CardDescription>
                创建专业的生成模板，支持自定义变量
              </CardDescription>
            </div>
            {onCancel && (
              <Button variant="secondary" size="sm" onClick={onCancel}>
                <X className="w-4 h-4 mr-2" />
                取消
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                编辑
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                预览
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-6 mt-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  基本信息
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">模板名称 *</Label>
                    <Input
                      id="template-name"
                      placeholder="输入模板名称..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-type">模板类型</Label>
                    <Select value={templateType} onValueChange={(v) => setTemplateType(v as any)}>
                      <SelectTrigger id="template-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video" key="template-type-video">
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            视频模板
                          </div>
                        </SelectItem>
                        <SelectItem value="image" key="template-type-image">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            图片模板
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">模板描述</Label>
                  <Textarea
                    id="template-description"
                    placeholder="简要描述这个模板的用途..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-category">分类</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="template-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <span>{cat.icon}</span>
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is-public">公开模板</Label>
                      <Switch
                        id="is-public"
                        checked={isPublic}
                        onCheckedChange={setIsPublic}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      公开后其他用户也可以使用此模板
                    </p>
                  </div>
                </div>
              </div>

              {/* Prompt Template */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  提示词模板
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="prompt-template">
                    模板内容（使用 {`{变量名}`} 定义变量）
                  </Label>
                  <Textarea
                    id="prompt-template"
                    placeholder="例如：一只可爱的{动物}在{地点}{动作}，{额外细节}"
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    提示：使用 {`{变量ID}`} 的格式在模板中插入变量，下方配置的变量会自动替换
                  </p>
                </div>
              </div>

              {/* Variables */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    变量配置
                  </h3>
                  <Button size="sm" onClick={addVariable}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加变量
                  </Button>
                </div>

                {variables.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">还没有配置变量</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      点击上方按钮添加变量，让模板更灵活
                    </p>
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {variables.map((variable) => (
                      <AccordionItem key={variable.id} value={variable.id}>
                        <AccordionTrigger className="border rounded-lg px-4 hover:no-underline">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-xs">
                              {variable.type === 'text' ? '文本' : variable.type === 'select' ? '选择' : '数字'}
                            </Badge>
                            <span className="font-medium">{variable.name}</span>
                            {variable.required && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>变量名称</Label>
                              <Input
                                value={variable.name}
                                onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>变量类型</Label>
                              <Select
                                value={variable.type}
                                onValueChange={(v) => updateVariable(variable.id, { type: v as any })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VARIABLE_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>占位符文本</Label>
                            <Input
                              value={variable.placeholder || ''}
                              onChange={(e) => updateVariable(variable.id, { placeholder: e.target.value })}
                              placeholder="请输入..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>默认值</Label>
                            <Input
                              value={variable.defaultValue || ''}
                              onChange={(e) => updateVariable(variable.id, { defaultValue: e.target.value })}
                              placeholder="可选的默认值"
                            />
                          </div>
                          {variable.type === 'select' && (
                            <div className="space-y-2">
                              <Label>选项（每行一个）</Label>
                              <Textarea
                                value={variable.options?.join('\n') || ''}
                                onChange={(e) => updateVariable(variable.id, { 
                                  options: e.target.value.split('\n').filter(Boolean) 
                                })}
                                placeholder="选项1&#10;选项2&#10;选项3"
                                rows={3}
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={variable.required}
                                onCheckedChange={(checked) => updateVariable(variable.id, { required: checked })}
                                id={`required-${variable.id}`}
                              />
                              <Label htmlFor={`required-${variable.id}`}>必填变量</Label>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeVariable(variable.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除变量
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">标签</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button onClick={addTag} disabled={!tagInput.trim()}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <Accordion type="single" collapsible>
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-sm font-medium">
                    高级设置（可选）
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>默认风格</Label>
                        <Select value={style} onValueChange={setStyle}>
                          <SelectTrigger>
                            <SelectValue placeholder="不设置" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" key="template-style-none">不设置</SelectItem>
                            {STYLE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认氛围</Label>
                        <Select value={mood} onValueChange={setMood}>
                          <SelectTrigger>
                            <SelectValue placeholder="不设置" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" key="template-mood-none">不设置</SelectItem>
                            {MOOD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认滤镜</Label>
                        <Select value={filter} onValueChange={setFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="不设置" />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认颜色主题</Label>
                        <Select value={colorTheme} onValueChange={setColorTheme}>
                          <SelectTrigger>
                            <SelectValue placeholder="不设置" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_THEME_OPTIONS.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                <div className="flex items-center gap-2">
                                  <span>{opt.icon}</span>
                                  {opt.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">预览</CardTitle>
                  <CardDescription>查看模板的实际效果</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>模板信息</Label>
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        {templateType === 'video' ? (
                          <Video className="w-4 h-4 text-red-500" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-rose-500" />
                        )}
                        <span className="font-medium">{templateName || '未命名模板'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {templateDescription || '暂无描述'}
                      </p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>生成的提示词</Label>
                    <div className="p-4 bg-muted rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {getPreviewPrompt() || '请先填写提示词模板'}
                      </pre>
                    </div>
                  </div>

                  {variables.length > 0 && (
                    <div className="space-y-2">
                      <Label>变量预览</Label>
                      <div className="p-4 bg-muted rounded-lg space-y-2">
                        {variables.map((variable) => (
                          <div key={variable.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                                {'{'}{variable.id}{'}'}
                              </code>
                              <span className="text-sm">{variable.name}</span>
                              {variable.required && (
                                <span className="text-red-500 text-xs">*</span>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {variable.type === 'text' ? '文本' : variable.type === 'select' ? '选择' : '数字'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button onClick={handleSave} disabled={!templateName.trim() || !promptTemplate.trim()}>
            <Save className="w-4 h-4 mr-2" />
            保存模板
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
