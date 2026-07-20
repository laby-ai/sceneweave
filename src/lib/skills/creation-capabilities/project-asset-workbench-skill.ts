import type { CreationCapabilitySkill } from './types';

export const projectAssetWorkbenchSkill = {
  id: 'project-asset-workbench',
  name: '项目素材工作台',
  description: '组织并写回剧本、角色、场景、分镜、片段和任务资产。',
  sourceProject: 'Toonflow-app',
  standard: 'sceneweave-vimax-skill-v1',
  referenceMode: 'behavioral-reference',
  implementation: 'sceneweave-native',
  runtime: 'sceneweave',
  executor: 'existing-sceneweave-chain',
  inputs: ['taskId', 'productionProject', 'assetPatch', 'storyboardPatch'],
  outputs: ['productionCanvas', 'projectAssets', 'storyboard', 'writebackResult'],
  operations: [
    {
      id: 'workbench.load-project-assets',
      name: '加载项目资产',
      description: '从真实任务和项目资产构建工作台视图。',
      runtime: 'sceneweave',
      entrypoint: '/api/node-editor/production-canvas',
      method: 'GET',
      cost: 'no-cost',
    },
    {
      id: 'workbench.write-project-asset',
      name: '写回项目资产',
      description: '把资产修改写回当前 ProductionProject 真源。',
      runtime: 'sceneweave',
      entrypoint: '/api/production/projects/:taskId/assets/:assetId',
      method: 'PATCH',
      cost: 'no-cost',
    },
    {
      id: 'workbench.write-storyboard-shot',
      name: '写回分镜镜头',
      description: '按 shotId 保存镜头描述、时长和字幕等可编辑字段。',
      runtime: 'sceneweave',
      entrypoint: '/api/production/projects/:taskId/storyboard/:shotId',
      method: 'PATCH',
      cost: 'no-cost',
    },
  ],
} satisfies CreationCapabilitySkill;
