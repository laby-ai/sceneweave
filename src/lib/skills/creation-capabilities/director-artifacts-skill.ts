import type { CreationCapabilitySkill } from './types';

export const directorArtifactsSkill = {
  id: 'director-artifacts',
  name: '导演与创作资产',
  description: '把创意和脚本转成可审计的故事、角色、场景、镜头与连续性资产。',
  sourceProject: 'ViMAX',
  standard: 'sceneweave-vimax-skill-v1',
  referenceMode: 'native-baseline',
  implementation: 'sceneweave-native',
  runtime: 'sceneweave',
  executor: 'existing-sceneweave-chain',
  inputs: ['prompt', 'sceneType', 'style', 'duration', 'generationSettings'],
  outputs: ['plan', 'storyBible', 'shots', 'referenceAssets', 'videoTasks'],
  operations: [
    {
      id: 'director.plan',
      name: '生成制作方案',
      description: '复用现有创作智能体 plan 阶段和导演资产链。',
      runtime: 'sceneweave',
      entrypoint: '/api/smart/vimax-agent-step',
      method: 'POST',
      cost: 'provider-gated',
    },
    {
      id: 'director.reference-assets',
      name: '生成参考素材',
      description: '沿用已确认方案生成角色、场景和镜头参考资产。',
      runtime: 'sceneweave',
      entrypoint: '/api/smart/vimax-agent-step',
      method: 'POST',
      cost: 'provider-gated',
    },
    {
      id: 'director.video',
      name: '进入视频阶段',
      description: '沿用同一方案、镜头和素材进入真实视频任务。',
      runtime: 'sceneweave',
      entrypoint: '/api/smart/vimax-agent-step',
      method: 'POST',
      cost: 'provider-gated',
    },
  ],
} satisfies CreationCapabilitySkill;
