import type { ProductionAsset, ProductionProject } from '@/lib/production-project';

type StoryboardShot = ProductionProject['storyboard']['shots'][number];

const editableAssetKinds = new Set<ProductionAsset['kind']>([
  'script',
  'character',
  'scene',
  'prop',
  'storyboard',
]);

export interface VimaxProjectEditorView {
  project: ProductionProject;
  editableAssets: ProductionAsset[];
  shots: StoryboardShot[];
}

export interface VimaxAssetWritebackResponse {
  success: boolean;
  asset?: ProductionAsset;
  error?: string;
}

export interface VimaxStoryboardWritebackResponse {
  success: boolean;
  shot?: StoryboardShot;
  storyboard?: ProductionProject['storyboard'];
  error?: string;
}

export function resolveVimaxProjectEditorView(result: unknown): VimaxProjectEditorView | null {
  if (!result || typeof result !== 'object') return null;
  const project = (result as { productionProject?: unknown }).productionProject;
  if (!project || typeof project !== 'object') return null;
  const candidate = project as ProductionProject;
  if (!Array.isArray(candidate.assets) || !Array.isArray(candidate.storyboard?.shots)) return null;
  return {
    project: candidate,
    editableAssets: candidate.assets.filter(asset => editableAssetKinds.has(asset.kind)),
    shots: candidate.storyboard.shots,
  };
}

export function applyVimaxAssetEditorWriteback(
  project: ProductionProject,
  response: VimaxAssetWritebackResponse,
): ProductionProject {
  if (!response.success || !response.asset) throw new Error(response.error || '素材保存失败');
  if (!project.assets.some(asset => asset.id === response.asset?.id)) throw new Error('素材不存在');
  return {
    ...project,
    assets: project.assets.map(asset => asset.id === response.asset?.id ? response.asset as ProductionAsset : asset),
  };
}

export function applyVimaxStoryboardEditorWriteback(
  project: ProductionProject,
  response: VimaxStoryboardWritebackResponse,
): ProductionProject {
  if (!response.success || !response.shot || !response.storyboard) {
    throw new Error(response.error || '分镜保存失败');
  }
  if (!project.storyboard.shots.some(shot => shot.id === response.shot?.id)) throw new Error('分镜不存在');
  return { ...project, storyboard: response.storyboard };
}
