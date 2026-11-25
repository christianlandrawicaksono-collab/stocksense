"use client";

import React from "react";

interface MarkdownMessageProps {
  content: string;
}

/**
 * Parser inline Markdown aman (tanpa dangerouslySetInnerHTML) untuk **bold**, *italic*, dan `code`.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*\n]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={key} className="font-semibold text-white">
          {renderInline(token.slice(2, -2), key)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-slate-800/90 text-[#2DD4BF] font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={key} className="italic text-slate-200">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

/**
 * Merender output Markdown Gemini menjadi heading, daftar bullet/bernomor, garis pemisah, dan paragraf rapi.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Garis pemisah horizontal (--- atau ***)
    if (/^([-*_])\1{2,}\s*$/.test(trimmed)) {
      blocks.push(<hr key={`b-${blockKey++}`} className="border-slate-800/90 my-2.5" />);
      i++;
      continue;
    }

    // Heading Markdown (# s/d ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const sizeClass =
        level === 1
          ? "text-sm font-bold text-white mt-3 mb-1"
          : level === 2
          ? "text-[13px] font-bold text-white mt-3 mb-1"
          : "text-xs font-semibold text-emerald-300 mt-2.5 mb-1";

      blocks.push(
        <h4 key={`b-${blockKey++}`} className={sizeClass}>
          {renderInline(headingText, `h-${blockKey}`)}
        </h4>
      );
      i++;
      continue;
    }

    // Bullet list (*, -, •)
    if (/^[\*\-•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const itemMatch = cur.match(/^[\*\-•]\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1]);
          i++;
        } else if (cur && !/^(#{1,4}\s|\d+\.\s|[-*_]{3,})/.test(cur) && /^\s{2,}/.test(lines[i])) {
          // Sambungan baris terindentasi ke item sebelumnya
          items[items.length - 1] += ` ${cur}`;
          i++;
        } else {
          break;
        }
      }
      const listKey = blockKey++;
      blocks.push(
        <ul key={`b-${listKey}`} className="list-disc pl-4 space-y-1.5 my-1.5 text-slate-300">
          {items.map((item, idx) => (
            <li key={`li-${listKey}-${idx}`} className="leading-relaxed">
              {renderInline(item, `ul-${listKey}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1., 2., ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const itemMatch = cur.match(/^\d+\.\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1]);
          i++;
        } else if (cur && !/^(#{1,4}\s|[\*\-•]\s|[-*_]{3,})/.test(cur) && /^\s{2,}/.test(lines[i])) {
          items[items.length - 1] += ` ${cur}`;
          i++;
        } else {
          break;
        }
      }
      const listKey = blockKey++;
      blocks.push(
        <ol key={`b-${listKey}`} className="list-decimal pl-4 space-y-1.5 my-1.5 text-slate-300">
          {items.map((item, idx) => (
            <li key={`ol-${listKey}-${idx}`} className="leading-relaxed">
              {renderInline(item, `ol-${listKey}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
        i++;
      }
      const qKey = blockKey++;
      blocks.push(
        <blockquote
          key={`b-${qKey}`}
          className="border-l-2 border-[#1E7B85] pl-3 py-0.5 text-slate-300 italic my-1.5"
        >
          {renderInline(quoteLines.join(" "), `q-${qKey}`)}
        </blockquote>
      );
      continue;
    }

    // Paragraf standar (gabungkan baris berturut-turut yang bukan blok khusus)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        !cur ||
        /^(#{1,4}\s|[\*\-•]\s|\d+\.\s|[-*_]{3,}\s*$|>\s?)/.test(cur)
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }
    const pKey = blockKey++;
    blocks.push(
      <p key={`b-${pKey}`} className="leading-relaxed text-slate-300">
        {renderInline(paraLines.join(" "), `p-${pKey}`)}
      </p>
    );
  }

  return <div className="space-y-1.5 text-xs font-sans">{blocks}</div>;
};
