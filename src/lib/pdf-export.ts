'use client';

import jsPDF from 'jspdf';

interface PDFSection {
  title: string;
  content: string;
}

/**
 * 将文本内容生成为PDF并触发下载
 */
export function downloadTextAsPDF(
  filename: string,
  sections: PDFSection[],
  options?: {
    title?: string;
    fontSize?: number;
    lineHeight?: number;
  }
) {
  const {
    title = '绘影工作室 - 创作内容',
    fontSize = 12,
    lineHeight = 1.6,
  } = options || {};

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // 添加标题
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 10;

  // 添加分隔线
  doc.setDrawColor(239, 68, 68); // #EF4444
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 添加时间戳
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, margin, y);
  y += 8;

  // 遍历各段落
  for (const section of sections) {
    // 检查是否需要新页
    if (y > pageHeight - 30) {
      doc.addPage();
      y = margin;
    }

    // 段落标题
    doc.setFontSize(fontSize + 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68); // #EF4444
    const sectionTitleLines = doc.splitTextToSize(section.title, maxWidth);
    doc.text(sectionTitleLines, margin, y);
    y += sectionTitleLines.length * (fontSize * lineHeight * 0.35) + 2;

    // 段落内容
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(33, 33, 33);
    const contentLines = doc.splitTextToSize(section.content, maxWidth);

    for (let i = 0; i < contentLines.length; i++) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(contentLines[i], margin, y);
      y += fontSize * lineHeight * 0.35;
    }

    y += 4; // 段落间距
  }

  // 添加页脚
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${i} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  doc.save(filename);
}

/**
 * 将HTML元素导出为PDF（通过简单文本提取）
 */
export function downloadElementAsPDF(
  element: HTMLElement,
  filename: string,
  title?: string
) {
  const sections: PDFSection[] = [];

  // 提取所有标题和内容
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const contents = element.querySelectorAll('p, div, span, textarea, pre');

  // 尝试从元素结构中提取段落
  const processed = new Set<Element>();

  headings.forEach((heading) => {
    if (processed.has(heading)) return;
    processed.add(heading);

    const section: PDFSection = {
      title: heading.textContent?.trim() || '',
      content: '',
    };

    // 获取标题后面紧邻的内容
    let sibling = heading.nextElementSibling;
    const contentParts: string[] = [];
    while (sibling && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName)) {
      const text = sibling.textContent?.trim();
      if (text) contentParts.push(text);
      processed.add(sibling);
      sibling = sibling.nextElementSibling;
    }
    section.content = contentParts.join('\n');
    sections.push(section);
  });

  // 如果没有找到标题结构，直接提取所有文本
  if (sections.length === 0) {
    sections.push({
      title: title || '内容',
      content: element.innerText || element.textContent || '',
    });
  }

  downloadTextAsPDF(filename, sections, { title });
}

/**
 * 简易纯文本PDF下载
 */
export function downloadPlainTextAsPDF(
  filename: string,
  text: string,
  title?: string
) {
  downloadTextAsPDF(filename, [{ title: title || '内容', content: text }], { title: title || '绘影工作室' });
}
