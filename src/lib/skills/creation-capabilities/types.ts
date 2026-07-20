export type CreationCapabilitySkillId =
  | 'director-artifacts'
  | 'project-asset-workbench'
  | 'segmented-production'
  | 'production-governance'
  | 'session-delivery';

export interface CreationCapabilityOperation {
  id: string;
  name: string;
  description: string;
  runtime: 'sceneweave';
  entrypoint: `/api/${string}` | `module:${string}`;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  cost: 'no-cost' | 'provider-gated';
  requires?: string[];
}

export interface CreationCapabilitySkill {
  id: CreationCapabilitySkillId;
  name: string;
  description: string;
  sourceProject: 'ViMAX' | 'Toonflow-app' | 'ArcReel' | 'OpenMontage' | 'LibTV Agent';
  standard: 'sceneweave-vimax-skill-v1';
  referenceMode: 'native-baseline' | 'behavioral-reference';
  implementation: 'sceneweave-native';
  runtime: 'sceneweave';
  executor: 'existing-sceneweave-chain';
  inputs: string[];
  outputs: string[];
  operations: CreationCapabilityOperation[];
}
