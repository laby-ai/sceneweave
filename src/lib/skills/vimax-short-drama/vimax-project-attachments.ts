import { readFile } from 'node:fs/promises';

import {
  getProjectAttachmentStoreRoot,
  listProjectAttachments,
  readProjectAttachment,
  type ProjectAttachmentOwner,
  type ProjectAttachmentRecord,
} from '@/lib/project-attachments/project-attachment-store';
import type { VimaxAgentReferenceAsset } from './vimax-agent-contract';

const MAX_ATTACHMENTS = 12;
const MAX_DOCUMENT_CHARACTERS = 20_000;

export function normalizeVimaxProjectAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === 'string').map(id => id.trim()).filter(Boolean))]
    .slice(0, MAX_ATTACHMENTS);
}

export async function resolveVimaxProjectAttachments(
  owner: ProjectAttachmentOwner,
  projectId: string,
  value: unknown,
): Promise<ProjectAttachmentRecord[]> {
  const ids = normalizeVimaxProjectAttachmentIds(value);
  if (ids.length === 0) return [];
  const records = await listProjectAttachments(getProjectAttachmentStoreRoot(), owner, projectId);
  const byId = new Map(records.map(record => [record.id, record]));
  const selected = ids.map(id => byId.get(id));
  if (selected.some(record => !record)) throw new Error('project_attachment_not_found');
  return selected as ProjectAttachmentRecord[];
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: false,
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items
      .map(item => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' '));
    if (pages.join('\n').length >= MAX_DOCUMENT_CHARACTERS) break;
  }
  return pages.join('\n').slice(0, MAX_DOCUMENT_CHARACTERS);
}

async function documentContext(
  owner: ProjectAttachmentOwner,
  record: ProjectAttachmentRecord,
): Promise<string> {
  const stored = await readProjectAttachment(
    getProjectAttachmentStoreRoot(),
    owner,
    record.projectId,
    record.id,
  );
  const buffer = await readFile(stored.absolutePath);
  if (record.mimeType === 'text/plain' || record.mimeType === 'text/markdown') {
    return buffer.toString('utf8').replace(/\0/g, '').slice(0, MAX_DOCUMENT_CHARACTERS).trim();
  }
  if (record.mimeType === 'application/pdf') return (await extractPdfText(buffer)).trim();
  return '';
}

export async function appendVimaxProjectAttachmentContext(
  prompt: string,
  owner: ProjectAttachmentOwner,
  records: ProjectAttachmentRecord[],
): Promise<string> {
  if (records.length === 0) return prompt;
  const lines: string[] = [];
  for (const [index, record] of records.entries()) {
    const kind = record.kind === 'image' ? '图片' : record.kind === 'video' ? '视频' : '文档';
    const extracted = record.kind === 'document' ? await documentContext(owner, record) : '';
    lines.push(`附件${index + 1}：${kind}「${record.name}」${extracted ? `\n${extracted}` : ''}`);
  }
  return `${prompt}\n\n【当前项目附件，按用户顺序】\n${lines.join('\n\n')}\n规划时必须尊重这些素材，不得替换已提供的主体和场景。`;
}

export async function materializeVimaxProjectImageAttachments(
  owner: ProjectAttachmentOwner,
  records: ProjectAttachmentRecord[],
): Promise<VimaxAgentReferenceAsset[]> {
  return Promise.all(records
    .filter(record => record.kind === 'image')
    .map(async record => {
      const stored = await readProjectAttachment(
        getProjectAttachmentStoreRoot(),
        owner,
        record.projectId,
        record.id,
      );
      const image = await readFile(stored.absolutePath);
      return {
        kind: 'reference',
        label: record.name,
        url: `data:${record.mimeType};base64,${image.toString('base64')}`,
      };
    }));
}
