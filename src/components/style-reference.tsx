'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/file-upload';
import { Loader2, Sparkles, Palette, Layers, Copy, Check } from 'lucide-react';
import { FILTER_OPTIONS } from '@/constants/filters';
import { STYLE_OPTIONS, MOOD_OPTIONS } from '@/constants/styles';

interface StyleReferenceProps {
  onStyleGenerated?: (stylePrompt: string) => void;
  disabled?: boolean;
  type?: 'image' | 'video';
}

// 模拟风格分析结果
const MOCK_STYLE_ANALYSIS = [
  { label: '艺术风格', value: '写实风格', confidence: 0.92 },
  { label: '色彩基调', value: '暖色调', confidence: 0.88 },
  { label: '光影效果', value: '柔和自然光', confidence: 0.85 },
  { label: '构图方式', value: '中心构图', confidence: 0.78 },
];

export function StyleReference({ 
  onStyleGenerated, 
  disabled = false,
  type = 'image'
}: StyleReferenceProps) {
  const [referenceFile, setReferenceFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<typeof MOCK_STYLE_ANALYSIS | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFileSelect = (file: File, previewUrl: string) => {
    setReferenceFile({ file, previewUrl });
    setAnalysisResult(null);
    setGeneratedPrompt('');
  };

  const handleClear = () => {
    setReferenceFile(null);
    setAnalysisResult(null);
    setGeneratedPrompt('');
  };

  const handleAnalyze = async () => {
    if (!referenceFile) return;

    setIsAnalyzing(true);
    try {
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 使用模拟分析结果
      setAnalysisResult(MOCK_STYLE_ANALYSIS);

      // 生成风格提示词
      const stylePrompt = generateStylePrompt(MOCK_STYLE_ANALYSIS);
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

  const generateStylePrompt = (analysis: typeof MOCK_STYLE_ANALYSIS) => {
    const styleTags = analysis.map(item => item.value).join('，');
    return `参考图片风格：${styleTags}。保持相似的艺术风格、色彩搭配和光影效果。`;
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

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Layers className="w-5 h-5 text-red-600" />
          风格参考
        </CardTitle>
        <CardDescription>
          上传{type === 'image' ? '图片' : '视频'}作为风格参考，生成类似风格的内容
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                分析风格
              </>
            )}
          </Button>
        )}

        {/* Analysis Result */}
        {analysisResult && (
          <div className="space-y-4">
            {/* Style Tags */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                风格分析结果
              </p>
              <div className="flex flex-wrap gap-2">
                {analysisResult.map((item, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {item.label}：{item.value}
                    <span className="text-xs opacity-70">
                      ({Math.round(item.confidence * 100)}%)
                    </span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Generated Prompt */}
            {generatedPrompt && (
              <div className="space-y-2">
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
                <p className="text-sm bg-muted p-3 rounded-lg border">
                  {generatedPrompt}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
