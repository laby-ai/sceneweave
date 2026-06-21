'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/file-upload';
import { 
  Loader2, Sparkles, Palette, Layers, Copy, Check, 
  Grid3X3, Zap, Eye, Shapes, Contrast, Maximize2, 
  Move, Type, Scissors, CircleDashed, Layers as LayersIcon
} from 'lucide-react';

interface StyleReferenceModalProps {
  onStyleGenerated?: (stylePrompt: string) => void;
  onImitateStyle?: (stylePrompt: string) => void;
  disabled?: boolean;
  type?: 'image' | 'video';
  triggerButton?: React.ReactNode;
}

// 扩展的模拟风格分析结果
interface AnalysisItem {
  label: string;
  value: string;
  confidence: number;
  category: 'style' | 'color' | 'composition' | 'lighting' | 'texture' | 'structure';
}

const MOCK_STYLE_ANALYSIS: AnalysisItem[] = [
  { label: '艺术风格', value: '写实风格', confidence: 0.92, category: 'style' },
  { label: '色彩基调', value: '暖色调', confidence: 0.88, category: 'color' },
  { label: '光影效果', value: '柔和自然光', confidence: 0.85, category: 'lighting' },
  { label: '构图方式', value: '中心构图', confidence: 0.78, category: 'composition' },
  { label: '纹理质感', value: '细腻光滑', confidence: 0.82, category: 'texture' },
  { label: '画面结构', value: '对称结构', confidence: 0.76, category: 'structure' },
];

const MOCK_STRUCTURE_ANALYSIS = [
  { label: '主体位置', value: '画面中心', confidence: 0.89 },
  { label: '层次深度', value: '三层结构', confidence: 0.84 },
  { label: '空间布局', value: '紧凑布局', confidence: 0.81 },
  { label: '视觉重心', value: '中下位置', confidence: 0.86 },
  { label: '元素分布', value: '均衡分布', confidence: 0.79 },
];

const MOCK_COLOR_ANALYSIS = [
  { label: '主色调', value: '#E8B86D', confidence: 0.91 },
  { label: '辅助色', value: '#8B6F47', confidence: 0.87 },
  { label: '点缀色', value: '#D4A574', confidence: 0.83 },
  { label: '色彩饱和度', value: '中等饱和度', confidence: 0.85 },
  { label: '对比度', value: '中高对比', confidence: 0.80 },
];

const CATEGORY_ICONS = {
  style: <Palette className="w-4 h-4" />,
  color: <CircleDashed className="w-4 h-4" />,
  composition: <Grid3X3 className="w-4 h-4" />,
  lighting: <Zap className="w-4 h-4" />,
  texture: <LayersIcon className="w-4 h-4" />,
  structure: <Shapes className="w-4 h-4" />,
};

export function StyleReferenceModal({ 
  onStyleGenerated, 
  onImitateStyle,
  disabled = false,
  type = 'image',
  triggerButton
}: StyleReferenceModalProps) {
  const [open, setOpen] = useState(false);
  const [referenceFile, setReferenceFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisItem[] | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileSelect = (file: File, previewUrl: string) => {
    setReferenceFile({ file, previewUrl });
    setAnalysisResult(null);
    setGeneratedPrompt('');
    setActiveTab('upload');
  };

  const handleClear = () => {
    setReferenceFile(null);
    setAnalysisResult(null);
    setGeneratedPrompt('');
    setActiveTab('upload');
  };

  const handleAnalyze = async () => {
    if (!referenceFile) return;

    setIsAnalyzing(true);
    setActiveTab('analysis');
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 2500));

      // 使用扩展的模拟分析结果
      setAnalysisResult(MOCK_STYLE_ANALYSIS);

      // 生成更详细的风格提示词
      const stylePrompt = generateDetailedStylePrompt(MOCK_STYLE_ANALYSIS);
      setGeneratedPrompt(stylePrompt);

      if (onStyleGenerated) {
        onStyleGenerated(stylePrompt);
      }
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDetailedStylePrompt = (analysis: AnalysisItem[]) => {
    const styleItems = analysis.filter(a => a.category === 'style').map(a => a.value).join('、');
    const colorItems = analysis.filter(a => a.category === 'color').map(a => a.value).join('、');
    const lightingItems = analysis.filter(a => a.category === 'lighting').map(a => a.value).join('、');
    const compositionItems = analysis.filter(a => a.category === 'composition').map(a => a.value).join('、');
    const textureItems = analysis.filter(a => a.category === 'texture').map(a => a.value).join('、');
    const structureItems = analysis.filter(a => a.category === 'structure').map(a => a.value).join('、');

    return `参考图片风格分析：
【艺术风格】${styleItems}
【色彩搭配】${colorItems}
【光影效果】${lightingItems}
【构图方式】${compositionItems}
【纹理质感】${textureItems}
【画面结构】${structureItems}

请按照以上风格特征生成相似风格的内容，保持艺术风格的一致性、色彩搭配的协调性、光影效果的统一性。`;
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // 延迟清除状态，让关闭动画完成
    setTimeout(() => {
      setReferenceFile(null);
      setAnalysisResult(null);
      setGeneratedPrompt('');
      setActiveTab('upload');
    }, 300);
  };

  const handleUseStyle = () => {
    if (onStyleGenerated && generatedPrompt) {
      onStyleGenerated(generatedPrompt);
    }
    handleClose();
  };

  const handleImitateStyle = () => {
    if (onImitateStyle && generatedPrompt) {
      onImitateStyle(generatedPrompt);
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            className="flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            风格参考
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Layers className="w-5 h-5 text-red-600" />
            风格参考分析
          </DialogTitle>
          <DialogDescription>
            上传{type === 'image' ? '图片' : '视频'}作为参考，AI将分析其艺术风格、色彩搭配、构图结构等特征
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                上传文件
              </TabsTrigger>
              <TabsTrigger value="analysis" disabled={!referenceFile} className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                风格分析
              </TabsTrigger>
              <TabsTrigger value="structure" disabled={!analysisResult} className="flex items-center gap-2">
                <Shapes className="w-4 h-4" />
                结构分析
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 mt-4">
              {/* File Upload */}
              <FileUpload
                onFileSelect={handleFileSelect}
                onClear={handleClear}
                type={type}
                accept={type === 'image' ? 'image/*' : 'video/*'}
                currentFile={referenceFile}
                disabled={disabled}
              />

              {/* Analyze Button */}
              {referenceFile && !analysisResult && (
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || disabled}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始风格分析
                    </>
                  )}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4 mt-4">
              {/* Style Analysis Result */}
              {analysisResult && (
                <div className="space-y-6">
                  {/* Analysis Categories */}
                  <div className="space-y-4">
                    {Object.entries(
                      analysisResult.reduce((acc, item) => {
                        if (!acc[item.category]) {
                          acc[item.category] = [];
                        }
                        acc[item.category].push(item);
                        return acc;
                      }, {} as Record<string, AnalysisItem[]>)
                    ).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]}
                          {category === 'style' && '艺术风格'}
                          {category === 'color' && '色彩特征'}
                          {category === 'composition' && '构图方式'}
                          {category === 'lighting' && '光影效果'}
                          {category === 'texture' && '纹理质感'}
                          {category === 'structure' && '画面结构'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {items.map((item, index) => (
                            <Badge 
                              key={index} 
                              variant="secondary" 
                              className="flex items-center gap-1"
                            >
                              {item.label}：{item.value}
                              <span className="text-xs opacity-70">
                                ({Math.round(item.confidence * 100)}%)
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Generated Prompt */}
                  {generatedPrompt && (
                    <div className="space-y-2 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          生成的风格提示词
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCopyPrompt}
                          className="flex items-center gap-2"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              复制
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted p-4 rounded-lg border max-h-48 overflow-y-auto">
                        <p className="text-sm whitespace-pre-wrap">
                          {generatedPrompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="structure" className="space-y-4 mt-4">
              {/* Structure Analysis */}
              {analysisResult && (
                <div className="space-y-6">
                  {/* Structure Analysis */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Grid3X3 className="w-4 h-4" />
                        画面结构分析
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {MOCK_STRUCTURE_ANALYSIS.map((item, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {item.label}：{item.value}
                            <span className="text-xs opacity-70">
                              ({Math.round(item.confidence * 100)}%)
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Contrast className="w-4 h-4" />
                        色彩系统分析
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {MOCK_COLOR_ANALYSIS.map((item, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {item.label}：{item.value}
                            <span className="text-xs opacity-70">
                              ({Math.round(item.confidence * 100)}%)
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visual Structure Preview */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Maximize2 className="w-4 h-4" />
                        构图示意
                      </p>
                      <div className="aspect-square bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center border-2 border-dashed">
                        <div className="text-center space-y-2">
                          <div className="w-24 h-24 bg-accent/300 rounded-lg mx-auto flex items-center justify-center">
                            <Move className="w-8 h-8 text-red-400" />
                          </div>
                          <p className="text-xs text-muted-foreground">中心构图示意</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        层次结构
                      </p>
                      <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg p-4 border-2 border-dashed">
                        <div className="space-y-2 h-full flex flex-col justify-center">
                          <div className="h-8 bg-white/70 rounded-md" />
                          <div className="h-8 bg-accent/300 rounded-md" />
                          <div className="h-8 bg-white/30 rounded-md" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-2">三层层次结构</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {generatedPrompt && (
          <div className="flex gap-3 pt-4 border-t mt-4">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              取消
            </Button>
            {onImitateStyle && (
              <Button 
                onClick={handleImitateStyle}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Type className="w-4 h-4 mr-2" />
                仿写此风格
              </Button>
            )}
            <Button 
              onClick={handleUseStyle}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              应用此风格
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
