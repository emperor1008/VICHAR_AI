import React from "react";

/** Escape HTML so user content can never inject markup. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold**, *italic*, `code`, [link](url)
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(esc(text.slice(last, m.index)));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-${i}`}>{esc(token.slice(2, -2))}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${keyBase}-${i}`}>{esc(token.slice(1, -1))}</em>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`${keyBase}-${i}`}>{esc(token.slice(1, -1))}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const [label, url] = [link[1], link[2]];
        const safeUrl = url.startsWith("http") ? url : "#";
        nodes.push(
          <a key={`${keyBase}-${i}`} href={safeUrl} target="_blank" rel="noreferrer noopener" className="text-matcha underline">
            {esc(label)}
          </a>,
        );
      }
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(esc(text.slice(last)));
  return nodes;
}

/** Minimal block-level markdown renderer (headings, lists, quotes, code, paragraphs). */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (list) {
      const items = list.items;
      const ordered = list.ordered;
      blocks.push(
        ordered ? (
          <ol key={`l-${blocks.length}`} className="list-decimal">
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `li-${idx}`)}</li>
            ))}
          </ol>
        ) : (
          <ul key={`l-${blocks.length}`} className="list-disc">
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it, `li-${idx}`)}</li>
            ))}
          </ul>
        ),
      );
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      flushList();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={`p-${blocks.length}`}>
          <code className={lang ? `language-${esc(lang)}` : ""}>{esc(codeLines.join("\n"))}</code>
        </pre>,
      );
      continue;
    }

    const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      if (!list) list = { ordered: /\d/.test(listMatch[1]), items: [] };
      list.items.push(listMatch[2]);
      i++;
      continue;
    }
    flushList();

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,3})/)?.[1].length ?? 1;
      const content = renderInline(trimmed.replace(/^#{1,3}\s/, ""), `h-${i}`);
      const Tag = (["h1", "h2", "h3"] as const)[level - 1];
      blocks.push(<Tag key={`p-${blocks.length}`}>{content}</Tag>);
    } else if (/^>\s/.test(trimmed)) {
      blocks.push(
        <blockquote key={`p-${blocks.length}`}>{renderInline(trimmed.slice(2), `q-${i}`)}</blockquote>,
      );
    } else if (trimmed === "") {
      if (i > 0 && lines[i - 1].trim() !== "") blocks.push(<div key={`s-${i}`} className="h-2" />);
    } else {
      blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line, `p-${i}`)}</p>);
    }
    i++;
  }
  flushList();

  return <div className={`md-body ${className}`}>{blocks}</div>;
}
