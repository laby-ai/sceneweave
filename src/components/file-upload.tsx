'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, Video } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, previewUrl: string) => void;
  onClear: () => void;
  accept?: string;
  type?: 'image' | 'video';
  currentFile?: { file: File; previewUrl: string } | null;
  disabled?: boolean;
}

export function FileUpload({ 
  onFileSelect, 
  onClear, 
  accept = 'image/*,video/*',
  type = 'image',
  currentFile,
  disabled = false
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    try {
      // 验证文件类型
      if (type === 'image' && !file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
      }
      if (type === 'video' && !file.type.startsWith('video/')) {
        alert('请上传视频文件');
        return;
      }

      // 验证文件大小 (限制为 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('文件大小不能超过 50MB');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onFileSelect(file, previewUrl);
    } catch (error) {
      console.error('处理文件失败:', error);
      alert('文件处理失败，请重试');
    }
  }, [type, onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // 重置 input 值，允许重新选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // 防止按钮点击时触发
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleClear = useCallback(() => {
    if (currentFile?.previewUrl) {
      URL.revokeObjectURL(currentFile.previewUrl);
    }
    onClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentFile, onClear]);

  return (
    <div className="w-full">
      {currentFile ? (
        <Card className="border-2 border-dashed border-muted-foreground/25 transition-colors overflow-hidden">
          <CardContent className="p-0">
            <div className="relative">
              {type === 'image' ? (
                <img
                  src={currentFile.previewUrl}
                  alt="预览"
                  className="w-full h-48 object-cover"
                />
              ) : (
                <video
                  src={currentFile.previewUrl}
                  className="w-full h-48 object-cover"
                  controls
                />
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClear}
                className="absolute top-2 right-2 z-10"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-3">
              <p className="text-sm text-muted-foreground truncate">
                {currentFile.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(currentFile.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card 
          className={`border-2 border-dashed cursor-pointer transition-all ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleCardClick}
        >
          <CardContent className="p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
              disabled={disabled}
            />
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              {type === 'image' ? (
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Video className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium mb-1">
              拖拽{type === 'image' ? '图片' : '视频'}到这里或点击上传
            </p>
            <p className="text-xs text-muted-foreground">
              支持 JPG, PNG, MP4, MOV 等格式 (最大 50MB)
            </p>
            <Button 
              variant="secondary" 
              size="sm" 
              className="mt-4"
              disabled={disabled}
              onClick={handleButtonClick}
            >
              <Upload className="w-4 h-4 mr-2" />
              选择文件
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
