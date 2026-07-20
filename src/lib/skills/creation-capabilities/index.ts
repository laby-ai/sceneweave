import { directorArtifactsSkill } from './director-artifacts-skill';
import { productionGovernanceSkill } from './production-governance-skill';
import { projectAssetWorkbenchSkill } from './project-asset-workbench-skill';
import { segmentedProductionSkill } from './segmented-production-skill';
import { sessionDeliverySkill } from './session-delivery-skill';
import type { CreationCapabilitySkill, CreationCapabilitySkillId } from './types';

export type { CreationCapabilityOperation, CreationCapabilitySkill, CreationCapabilitySkillId } from './types';

export const CREATION_CAPABILITY_SKILLS: CreationCapabilitySkill[] = [
  directorArtifactsSkill,
  projectAssetWorkbenchSkill,
  segmentedProductionSkill,
  productionGovernanceSkill,
  sessionDeliverySkill,
];

export function getCreationCapabilitySkill(id: CreationCapabilitySkillId): CreationCapabilitySkill {
  const skill = CREATION_CAPABILITY_SKILLS.find(candidate => candidate.id === id);
  if (!skill) throw new Error(`Unknown creation capability skill: ${id}`);
  return skill;
}

export function listCreationCapabilityOperations() {
  return CREATION_CAPABILITY_SKILLS.flatMap(skill => skill.operations);
}
