'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Type,
  Palette,
  Layers,
  Sliders,
  Plus,
  Trash2,
  Download,
  Eye,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  isDragging: boolean;
}

interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hue: number;
}

interface ImageEditorProps {
  imageUrl: string;
  onSave?: (editedImageUrl: string) => void;
  onCancel?: () => void;
}

export function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // 文字图层
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [newText, setNewText] = useState('');

  // 滤镜设置
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    hue: 0,
  });

  // 历史记录
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    loadImage();
  }, [imageUrl]);

  useEffect(() => {
    if (imageLoaded) {
      renderCanvas();
    }
  }, [textLayers, filters, zoom, rotation]);

  const loadImage = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      renderCanvas();
      saveToHistory();
    };
    img.onerror = () => {
      console.error('Failed to load image');
    };
    img.src = imageUrl;
  };

  const renderCanvas = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布大小
    const img = imageRef.current;
    canvas.width = img.width;
    canvas.height = img.height;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 应用滤镜
    ctx.filter = `
      brightness(${filters.brightness}%)
      contrast(${filters.contrast}%)
      saturate(${filters.saturation}%)
      blur(${filters.blur}px)
      hue-rotate(${filters.hue}deg)
    `;

    // 绘制图像（应用旋转）
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();

    // 重置滤镜（文字不受滤镜影响）
    ctx.filter = 'none';

    // 绘制文字图层
    textLayers.forEach((layer) => {
      ctx.save();
      ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.fillText(layer.text, layer.x, layer.y);

      // 如果是选中的图层，绘制边框
      if (layer.id === selectedLayerId) {
        const metrics = ctx.measureText(layer.text);
        const padding = 5;
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          layer.x - padding,
          layer.y - layer.fontSize - padding,
          metrics.width + padding * 2,
          layer.fontSize + padding * 2
        );
      }
      ctx.restore();
    });
  };

  const addTextLayer = () => {
    if (!newText.trim()) return;

    const newLayer: TextLayer = {
      id: Date.now().toString(),
      text: newText,
      x: 100,
      y: 100,
      fontSize: 24,
      color: '#FFFFFF',
      fontFamily: 'Arial',
      fontWeight: 'normal',
      isDragging: false,
    };

    setTextLayers([...textLayers, newLayer]);
    setSelectedLayerId(newLayer.id);
    setNewText('');
    setIsAddingText(false);
    saveToHistory();
  };

  const updateSelectedLayer = (updates: Partial<TextLayer>) => {
    if (!selectedLayerId) return;

    setTextLayers(
      textLayers.map((layer) =>
        layer.id === selectedLayerId ? { ...layer, ...updates } : layer
      )
    );
    saveToHistory();
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayerId) return;

    setTextLayers(textLayers.filter((layer) => layer.id !== selectedLayerId));
    setSelectedLayerId(null);
    saveToHistory();
  };

  const saveToHistory = () => {
    const currentState = {
      textLayers: [...textLayers],
      filters: { ...filters },
      rotation,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setTextLayers(prevState.textLayers);
      setFilters(prevState.filters);
      setRotation(prevState.rotation);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setTextLayers(nextState.textLayers);
      setFilters(nextState.filters);
      setRotation(nextState.rotation);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `edited-poster-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const editedImageUrl = canvasRef.current.toDataURL('image/png');
    onSave?.(editedImageUrl);
  };

  const selectedLayer = textLayers.find((layer) => layer.id === selectedLayerId);

  return (
    <div className="w-full h-full flex flex-col bg-card/80">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={historyIndex <= 0}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-accent/70 mx-2" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground ml-2">{Math.round(zoom * 100)}%</span>
          <div className="w-px h-6 bg-accent/70 mx-2" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRotation((rotation + 90) % 360)}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            下载
          </Button>
          <Button className="bg-[#EF4444] text-black hover:bg-[#EF4444]/80" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 */}
        <div className="w-80 border-r border-border overflow-y-auto">
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">
                <Type className="w-4 h-4 mr-1" />
                文字
              </TabsTrigger>
              <TabsTrigger value="filters">
                <Sliders className="w-4 h-4 mr-1" />
                滤镜
              </TabsTrigger>
              <TabsTrigger value="layers">
                <Layers className="w-4 h-4 mr-1" />
                图层
              </TabsTrigger>
            </TabsList>

            {/* 文字面板 */}
            <TabsContent value="text" className="p-4 space-y-4">
              {!isAddingText ? (
                <Button
                  className="w-full"
                  onClick={() => setIsAddingText(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加文字
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="输入文字内容"
                    onKeyDown={(e) => e.key === 'Enter' && addTextLayer()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addTextLayer}>
                      添加
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingText(false);
                        setNewText('');
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {selectedLayer && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="font-medium">编辑文字</h4>
                  <div>
                    <Label className="text-sm">内容</Label>
                    <Input
                      value={selectedLayer.text}
                      onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">字号: {selectedLayer.fontSize}px</Label>
                    <Slider
                      value={[selectedLayer.fontSize]}
                      onValueChange={([value]) =>
                        updateSelectedLayer({ fontSize: value })
                      }
                      min={12}
                      max={72}
                      step={1}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">颜色</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) =>
                          updateSelectedLayer({ color: e.target.value })
                        }
                        className="w-12 h-8 p-0 border-0"
                      />
                      <Input
                        value={selectedLayer.color}
                        onChange={(e) =>
                          updateSelectedLayer({ color: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">字体</Label>
                    <Select
                      value={selectedLayer.fontFamily}
                      onValueChange={(value) =>
                        updateSelectedLayer({ fontFamily: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                        <SelectItem value="Times New Roman">
                          Times New Roman
                        </SelectItem>
                        <SelectItem value="Courier New">
                          Courier New
                        </SelectItem>
                        <SelectItem value="Verdana">Verdana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">字重</Label>
                    <Select
                      value={selectedLayer.fontWeight}
                      onValueChange={(value) =>
                        updateSelectedLayer({ fontWeight: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">正常</SelectItem>
                        <SelectItem value="bold">粗体</SelectItem>
                        <SelectItem value="100">极细</SelectItem>
                        <SelectItem value="300">细体</SelectItem>
                        <SelectItem value="500">中等</SelectItem>
                        <SelectItem value="700">加粗</SelectItem>
                        <SelectItem value="900">超粗</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={deleteSelectedLayer}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除文字
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* 滤镜面板 */}
            <TabsContent value="filters" className="p-4 space-y-6">
              <div>
                <Label className="text-sm">
                  亮度: {filters.brightness}%
                </Label>
                <Slider
                  value={[filters.brightness]}
                  onValueChange={([value]) =>
                    setFilters({ ...filters, brightness: value })
                  }
                  min={0}
                  max={200}
                  step={1}
                />
              </div>
              <div>
                <Label className="text-sm">
                  对比度: {filters.contrast}%
                </Label>
                <Slider
                  value={[filters.contrast]}
                  onValueChange={([value]) =>
                    setFilters({ ...filters, contrast: value })
                  }
                  min={0}
                  max={200}
                  step={1}
                />
              </div>
              <div>
                <Label className="text-sm">
                  饱和度: {filters.saturation}%
                </Label>
                <Slider
                  value={[filters.saturation]}
                  onValueChange={([value]) =>
                    setFilters({ ...filters, saturation: value })
                  }
                  min={0}
                  max={200}
                  step={1}
                />
              </div>
              <div>
                <Label className="text-sm">模糊: {filters.blur}px</Label>
                <Slider
                  value={[filters.blur]}
                  onValueChange={([value]) =>
                    setFilters({ ...filters, blur: value })
                  }
                  min={0}
                  max={20}
                  step={0.5}
                />
              </div>
              <div>
                <Label className="text-sm">
                  色相: {filters.hue}°
                </Label>
                <Slider
                  value={[filters.hue]}
                  onValueChange={([value]) =>
                    setFilters({ ...filters, hue: value })
                  }
                  min={0}
                  max={360}
                  step={1}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  setFilters({
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    blur: 0,
                    hue: 0,
                  })
                }
              >
                重置滤镜
              </Button>
            </TabsContent>

            {/* 图层面板 */}
            <TabsContent value="layers" className="p-4 space-y-2">
              {textLayers.length === 0 ? (
                <p className="text-sm text-foreground/70 text-center py-8">
                  暂无文字图层
                </p>
              ) : (
                textLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedLayerId === layer.id
                        ? 'border-[#EF4444] bg-[#EF4444]/10'
                        : 'border-border hover:border-white/20'
                    }`}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[150px]">
                          {layer.text}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTextLayers(
                            textLayers.filter((l) => l.id !== layer.id)
                          );
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 画布区域 */}
        <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center overflow-hidden p-8">
          {imageLoaded ? (
            <div
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease-out',
              }}
            >
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full shadow-2xl"
              />
            </div>
          ) : (
            <div className="text-foreground/70">加载中...</div>
          )}
        </div>
      </div>
    </div>
  );
}
