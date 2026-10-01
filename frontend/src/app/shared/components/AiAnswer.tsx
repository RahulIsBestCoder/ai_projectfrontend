import React from 'react';

const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(input: string, keyPrefix: string): React.ReactNode[] {
  const text = input.replace(/\\([|*`#<>])/g, '$1');
  return text.split(INLINE_RE).map((part, index) => {
    const key = `${keyPrefix}-in-${index}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={key} className="ai-inline-code">{part.slice(1, -1)}</code>;
    return <React.Fragment key={key}>{part.split(DATE_RE).map((value, dateIndex) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? <time key={dateIndex} className="ai-date" dateTime={value}>{value}</time>
      : <React.Fragment key={dateIndex}>{value}</React.Fragment>)}</React.Fragment>;
  });
}

type Block =
  | { kind: 'p'; text: string; lead?: boolean }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] };

const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r/g, '').replace(/\\\|/g, '|').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listKind: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ kind: 'p', text, lead: blocks.length === 0 });
    paragraph = [];
  };
  const flushList = () => {
    if (listKind && listItems.length) blocks.push({ kind: listKind, items: listItems });
    listKind = null;
    listItems = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const nextLine = lines[index + 1]?.trim() || '';
    if (line.includes('|') && /^\|?\s*:?-{3,}/.test(nextLine) && nextLine.includes('|')) {
      flushParagraph(); flushList();
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes('|')) { rows.push(tableCells(lines[index])); index++; }
      index--;
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^(?:[-*•–—]|\d+[.)])\s+(.*)$/);
    if (heading) { flushParagraph(); flushList(); blocks.push({ kind: 'h', text: heading[2] }); }
    else if (bullet) {
      flushParagraph();
      const kind = /^\d+[.)]/.test(line) ? 'ol' : 'ul';
      if (listKind !== kind) { flushList(); listKind = kind; }
      listItems.push(bullet[1]);
    } else if (/^.+:\s*$/.test(line) && line.length <= 80) {
      flushParagraph(); flushList(); blocks.push({ kind: 'h', text: line.replace(/:\s*$/, '') });
    } else if (listKind) listItems[listItems.length - 1] += ` ${line}`;
    else paragraph.push(line);
  }
  flushParagraph(); flushList();
  return blocks;
}

function TableCell({ text, prefix }: { text: string; prefix: string }) {
  return <>{text.split(/<br\s*\/?\s*>/i).map((line) => line.trim()).filter(Boolean).map((line, index) => (
    <span key={index} className="ai-table-line">{renderInline(line.replace(/^[•-]\s*/, ''), `${prefix}-${index}`)}</span>
  ))}</>;
}

export const AiAnswer: React.FC<{ text: string }> = ({ text }) => {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);
  return <div className="ai-answer">{blocks.map((block, index) => {
    if (block.kind === 'table') return <div key={index} className="ai-table-wrap"><table>
      <thead><tr>{block.headers.map((header, cell) => <th key={cell}>{renderInline(header, `${index}-h-${cell}`)}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.headers.map((_, cell) => (
        <td key={cell}><TableCell text={row[cell] || ''} prefix={`${index}-${rowIndex}-${cell}`} /></td>
      ))}</tr>)}</tbody>
    </table></div>;
    if (block.kind === 'ul' || block.kind === 'ol') {
      const Tag = block.kind;
      return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `${index}-${itemIndex}`)}</li>)}</Tag>;
    }
    if (block.kind === 'h') return <h4 key={index}>{renderInline(block.text, `${index}`)}</h4>;
    return <p key={index} className={block.lead ? 'ai-lead' : undefined}>{renderInline(block.text, `${index}`)}</p>;
  })}</div>;
};

export default AiAnswer;
