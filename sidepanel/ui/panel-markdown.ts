import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).renderMarkdown = function renderMarkdown(text: string) {
  if (!text) return '';

  const escape = (value = '') => this.escapeHtmlBasic(value);
  const escapeAttr = (value = '') => this.escapeAttribute(value);

  let working = String(text).replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  working = working.replace(codeBlockRegex, (_: string, lang = '', body = '') => {
    const placeholder = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    const languageClass = lang ? ` class="language-${escapeAttr(lang.toLowerCase())}"` : '';
    codeBlocks.push(`<pre><code${languageClass}>${escape(body)}</code></pre>`);
    return placeholder;
  });

  // Extract tables before processing other content
  const tables: string[] = [];
  const tableRegex = /(?:^|\n)((?:\|[^\n]*)+\|(?:\n|\r?\n?))+/gm;
  working = working.replace(tableRegex, (match: string) => {
    const placeholder = `@@TABLE_${tables.length}@@`;
    tables.push(this.renderMarkdownTable(match.trim()));
    return placeholder;
  });

  const applyInline = (value = '') => {
    let html = escape(value);
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_: string, alt: string, url: string) => `<img alt="${escape(alt)}" src="${escapeAttr(url)}">`,
    );
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_: string, label: string, url: string) =>
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
    );
    html = html.replace(/`([^`]+)`/g, (_: string, code: string) => `<code>${escape(code)}</code>`);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/(?<!\*)\*(?!\s)(.+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_(?!\s)(.+?)_(?!_)/g, '<em>$1</em>');
    return html;
  };

  const lines = working.split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      blocks.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      blocks.push('</ol>');
      inOl = false;
    }
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${applyInline(paragraph.join('\n'))}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    const placeholderMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (placeholderMatch) {
      flushParagraph();
      closeLists();
      blocks.push(trimmed);
      continue;
    }

    // Handle table placeholders
    const tableMatch = trimmed.match(/^@@TABLE_(\d+)@@$/);
    if (tableMatch) {
      flushParagraph();
      closeLists();
      blocks.push(trimmed);
      continue;
    }

    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushParagraph();
      closeLists();
      blocks.push('<hr>');
      continue;
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^\s*>\s*/.test(line)) {
      flushParagraph();
      closeLists();
      blocks.push(`<blockquote>${applyInline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (inOl) {
        blocks.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        blocks.push('<ul>');
        inUl = true;
      }
      blocks.push(`<li>${applyInline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      if (inUl) {
        blocks.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        blocks.push('<ol>');
        inOl = true;
      }
      blocks.push(`<li>${applyInline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeLists();

  let html = blocks.join('');
  codeBlocks.forEach((block, index) => {
    const placeholder = `@@CODE_BLOCK_${index}@@`;
    html = html.split(placeholder).join(block);
  });

  tables.forEach((table, index) => {
    const placeholder = `@@TABLE_${index}@@`;
    html = html.split(placeholder).join(table);
  });

  return html;
};

(SidePanelUI.prototype as any).renderMarkdownTable = function renderMarkdownTable(tableText: string): string {
  const escape = (value = '') => this.escapeHtmlBasic(value);
  
  const lines = tableText.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return `<p>${escape(tableText)}</p>`;
  
  // Parse header row
  const headerLine = lines[0];
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell);
  
  // Check if second line is separator
  const separatorLine = lines[1];
  const isSeparator = /^\s*[-:|\s]+$/.test(separatorLine);
  
  const bodyStartIndex = isSeparator ? 2 : 1;
  const bodyLines = lines.slice(bodyStartIndex);
  
  if (headers.length === 0) return `<p>${escape(tableText)}</p>`;
  
  // Build table HTML
  let html = '<div class="table-wrapper"><table class="markdown-table">';
  
  // Header
  html += '<thead><tr>';
  headers.forEach(header => {
    html += `<th>${escape(header)}</th>`;
  });
  html += '</tr></thead>';
  
  // Body
  if (bodyLines.length > 0) {
    html += '<tbody>';
    bodyLines.forEach(rowLine => {
      const cells = rowLine
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell);
      
      if (cells.length > 0) {
        html += '<tr>';
        cells.forEach((cell, idx) => {
          // Use th for first column if it looks like a header cell
          const tag = idx === 0 && cell.length < 30 ? 'th' : 'td';
          html += `<${tag}>${escape(cell)}</${tag}>`;
        });
        // Fill empty cells to match header count
        for (let i = cells.length; i < headers.length; i++) {
          html += '<td></td>';
        }
        html += '</tr>';
      }
    });
    html += '</tbody>';
  }
  
  html += '</table></div>';
  return html;
};
