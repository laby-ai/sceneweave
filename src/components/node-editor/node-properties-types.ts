import type { Node } from 'reactflow';
import type { CustomNodeData } from './node-editor-shared';

export interface NodePropertiesSectionProps {
  selectedNode: Node<CustomNodeData>;
  onUpdateNode: (id: string, data: Partial<CustomNodeData>) => void;
  isGenerating: boolean;
  batchGenerateStoryboardImages: (storyboardNodeId: string) => Promise<void>;
  generateSingleStoryboardImage: (storyboardNodeId: string, storyboardIndex: number) => Promise<void>;
  generateVideoFromImage: (imageNodeId: string) => Promise<void>;
  generateAudio: (audioNodeId: string) => Promise<void>;
  composeFinalVideo: () => Promise<void>;
  batchGenerateStoryboardVideos: (storyboardNodeId: string) => Promise<void>;
  regenerateImage: (imageNodeId: string) => Promise<void>;
  regenerateVideoFromNode: (videoNodeId: string) => Promise<void>;
  selectedStoryboards: Set<string>;
  setSelectedStoryboards: (value: Set<string>) => void;
  canWriteBackProductionAsset: boolean;
  canvasSaveInfo: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  };
  onSaveStoryboardShot: (shotId: string) => Promise<void>;
  handleCharacterUpload: (files: FileList | File[]) => void;
  handleSceneUpload: (files: FileList | File[]) => void;
  removeCharacterUpload: (index: number) => void;
  removeSceneUpload: (index: number) => void;
  selectedProductionKind: string;
  isProductionVideoAsset: boolean;
  selectedVideoUrl: any;
  selectedVideoTaskId: any;
  selectedVideoCanExport: boolean;
}
