import { getSubjectStoreRoot } from '@/lib/subjects/subject-store-readiness';
import {
  listSubjects,
  readSubjectImage,
  type SubjectOwner,
  type SubjectRecord,
} from '@/lib/subjects/subject-store';
import type { VimaxAgentReferenceAsset } from './vimax-agent-contract';

const MAX_REFERENCES = 8;

function normalizeReferenceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === 'string').map(id => id.trim()).filter(Boolean))]
    .slice(0, MAX_REFERENCES);
}

function assetKind(type: SubjectRecord['type']): VimaxAgentReferenceAsset['kind'] {
  if (type === 'character') return 'character';
  if (type === 'scene') return 'scene';
  return 'prop';
}

export async function resolveVimaxInitialReferenceRecords(
  owner: SubjectOwner,
  value: unknown,
): Promise<SubjectRecord[]> {
  const ids = normalizeReferenceIds(value);
  if (ids.length === 0) return [];
  const records = await listSubjects(getSubjectStoreRoot(), owner);
  const byId = new Map(records.map(record => [record.id, record]));
  const selected = ids.map(id => byId.get(id));
  if (selected.some(record => !record)) throw new Error('initial_reference_not_found');
  return selected as SubjectRecord[];
}

export function appendVimaxInitialReferenceContext(prompt: string, records: SubjectRecord[]): string {
  if (records.length === 0) return prompt;
  const lines = records.map((record, index) => {
    const role = record.type === 'character' ? '角色' : record.type === 'scene' ? '场景' : '道具';
    return `参考${index + 1}：${role}「${record.name}」`;
  });
  return `${prompt}\n\n【用户已绑定参考素材】\n${lines.join('\n')}\n规划时必须复用这些身份和场景，不得替换。`;
}

export async function materializeVimaxInitialReferenceAssets(
  owner: SubjectOwner,
  records: SubjectRecord[],
): Promise<VimaxAgentReferenceAsset[]> {
  return Promise.all(records.map(async record => {
    const { image, mimeType } = await readSubjectImage(getSubjectStoreRoot(), owner, record.id);
    return {
      kind: assetKind(record.type),
      label: record.name,
      url: `data:${mimeType};base64,${image.toString('base64')}`,
    };
  }));
}

export { normalizeReferenceIds as normalizeVimaxInitialReferenceIds };
