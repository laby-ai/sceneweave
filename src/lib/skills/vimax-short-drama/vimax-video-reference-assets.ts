import { updateTask, type BackgroundTask } from '@/lib/task-manager';

import type { VimaxAgentReferenceAsset } from './vimax-agent-contract';

export function resolveAndPersistVimaxVideoReferenceAssets(input: {
  task?: BackgroundTask;
  supplied?: VimaxAgentReferenceAsset[];
  persisted: VimaxAgentReferenceAsset[];
}): VimaxAgentReferenceAsset[] {
  const assets = Array.isArray(input.supplied) && input.supplied.length > 0
    ? input.supplied
    : input.persisted;
  if (!input.task || assets === input.persisted) return assets;
  if (!updateTask(input.task.id, {
    result: { ...(input.task.result || {}), vimaxReferenceAssets: assets },
  })) throw new Error('已批准参考素材保存失败，未提交付费视频任务。');
  return assets;
}
