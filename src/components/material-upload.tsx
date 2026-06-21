'use client';

import { useState, useRef, DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, Video, FileText, Loader2, Check } from 'lucide-react';

export interface Material {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  file?: File;
}

interface MaterialUploadProps {
  materials: Material[];
  onMaterialsChange: (materials: Material[]) => void;
  acceptTypes?: ('image' | 'video')[];
  maxCount?: number;
  disabled?: boolean;
}

export function MaterialUpload({
  materials,
  onMaterialsChange,
  acceptTypes = ['image', 'video'],
  maxCount = 5,
  disabled = false,
}: MaterialUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptString = acceptTypes.includes('image') && acceptTypes.includes('video')
    ? 'image/*,video/*'
    : acceptTypes.includes('image')
    ? 'image/*'
    : 'video/*';

  const getIconByType = (type: 'image' | 'video') => {
    return type === 'image' ? ImageIcon : Video;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || disabled || isUploading) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxCount - materials.length;

    if (fileArray.length > remainingSlots) {
      alert(`最多只能上传 ${maxCount} 个素材，还可上传 ${remainingSlots} 个`);
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = fileArray.map(async (file) => {
        // 创建 FormData 上传文件
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload/material', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`上传失败: ${file.name}`);
        }

        const data = await response.json();

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
          url: data.url,
          name: file.name,
          file,
        };
      });

      const newMaterials = await Promise.all(uploadPromises);
      onMaterialsChange([...materials, ...newMaterials]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败，请重试');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleRemoveMaterial = (id: string) => {
    if (disabled) return;
    onMaterialsChange(materials.filter(m => m.id !== id));
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          素材上传
        </CardTitle>
        <CardDescription>
          上传参考图片或视频，用于生成更符合预期的内容
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上传区域 */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary cursor-pointer'}
          `}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={acceptString}
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">正在上传...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">点击或拖拽上传素材</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {acceptTypes.includes('image') && acceptTypes.includes('video')
                    ? '支持图片和视频格式'
                    : acceptTypes.includes('image')
                    ? '支持图片格式'
                    : '支持视频格式'}
                </p>
                <p className="text-xs text-muted-foreground">
                  最多上传 {maxCount} 个，已上传 {materials.length} 个
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 素材列表 */}
        {materials.length > 0 && (
          <div className="space-y-3">
            <Label>已上传的素材 ({materials.length}/{maxCount})</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {materials.map((material) => {
                const Icon = getIconByType(material.type);
                return (
                  <div
                    key={material.id}
                    className="relative group border rounded-lg overflow-hidden bg-background"
                  >
                    {material.type === 'image' ? (
                      <img
                        src={material.url}
                        alt={material.name}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 bg-muted flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* 悬浮操作 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMaterial(material.id);
                        }}
                        disabled={disabled}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* 类型标识 */}
                    <div className="absolute top-2 left-2">
                      <Icon className="w-4 h-4 text-white drop-shadow-md" />
                    </div>

                    {/* 完成标识 */}
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-green-500 drop-shadow-md" />
                    </div>

                    {/* 文件名 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                      <p className="text-xs text-white truncate">
                        {material.name}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 提示信息 */}
        {materials.length === 0 && !isUploading && (
          <div className="bg-red-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-xs text-red-800">
                <p className="font-medium mb-1">素材使用说明</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>上传的素材将作为生成内容的参考</li>
                  <li>图片素材：用于生成风格相似的图片/视频</li>
                  <li>视频素材：用于生成场景相似的视频</li>
                  <li>支持多素材上传，系统会智能融合</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
