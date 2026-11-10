import type { ReactNode } from "react";

// A small, dependency-free renderer for the Markdown that publishers write in
// GitHub release notes and READMEs. It builds React elements directly (no
// HTML injection), drops raw HTML and images, and only links to http(s).

type ListBlock = { type: "list"; ordered: boolean; items: ListItem[] };
type ListItem = { text: string; children: ListBlock | null };
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; label: string | null; blocks: Block[] }
  | { type: "code"; text: string }
  | { type: "rule" }
  | ListBlock;

const listPattern = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const headingPattern = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const rulePattern = /^\s*(\*{3,}|-{3,}|_{3,})\s*$/;
const fencePattern = /^\s*(```|~~~)/;
const alertLabels: Record<string, string> = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};

function nestList(rows: { indent: number; ordered: boolean; text: string }[]) {
  const root: ListBlock = { type: "list", ordered: rows[0].ordered, items: [] };
  const stack = [{ indent: rows[0].indent, list: root }];
  for (const row of rows) {
    while (stack.length > 1 && row.indent < stack[stack.length - 1].indent)
      stack.pop();
    let top = stack[stack.length - 1];
    const parent = top.list.items[top.list.items.length - 1];
    if (row.indent > top.indent + 1 && parent) {
      const child: ListBlock = {
        type: "list",
        ordered: row.ordered,
        items: [],
      };
      parent.children = child;
      top = { indent: row.indent, list: child };
      stack.push(top);
    }
    top.list.items.push({ text: row.text, children: null });
  }
  return root;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (fencePattern.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !fencePattern.test(lines[i]))
        body.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const heading = headingPattern.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      i++;
      continue;
    }
    if (rulePattern.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        body.push(lines[i++].replace(/^\s*>\s?/, ""));
      const alert = /^\s*\[!(\w+)\]\s*$/.exec(body[0] ?? "");
      const label = alert
        ? (alertLabels[alert[1].toUpperCase()] ?? null)
        : null;
      blocks.push({
        type: "quote",
        label,
        blocks: parseBlocks(alert ? body.slice(1) : body),
      });
      continue;
    }
    if (listPattern.test(line)) {
      const rows: { indent: number; ordered: boolean; text: string }[] = [];
      while (i < lines.length) {
        const item = listPattern.exec(lines[i]);
        if (item) {
          rows.push({
            indent: item[1].replace(/\t/g, "    ").length,
            ordered: /\d/.test(item[2]),
            text: item[3],
          });
          i++;
        } else if (lines[i].trim() && /^\s+/.test(lines[i])) {
          // An indented continuation of the previous item.
          rows[rows.length - 1].text += ` ${lines[i].trim()}`;
          i++;
        } else if (
          !lines[i].trim() &&
          i + 1 < lines.length &&
          listPattern.test(lines[i + 1])
        ) {
          i++;
        } else break;
      }
      blocks.push(nestList(rows));
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !fencePattern.test(lines[i]) &&
      !headingPattern.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !listPattern.test(lines[i])
    ) {
      // A row of = or - under text marks that text as a heading.
      const underline = /^\s*(=+|-+)\s*$/.exec(lines[i]);
      if (underline && body.length) {
        const text = body.pop() as string;
        if (body.length)
          blocks.push({ type: "paragraph", text: body.splice(0).join("\n") });
        blocks.push({
          type: "heading",
          level: underline[1][0] === "=" ? 1 : 2,
          text,
        });
        i++;
        continue;
      }
      if (rulePattern.test(lines[i])) break;
      body.push(lines[i++].trim());
    }
    if (body.length) blocks.push({ type: "paragraph", text: body.join("\n") });
  }
  return blocks;
}

const inlinePattern =
  /(`[^`\n]+`)|(!?)\[((?:[^\[\]\n]|\[[^\]\n]*\])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^\n]+?)\*\*|(?<![\w])__([^\n]+?)__(?![\w])|\*([^*\s][^*\n]*?)\*|(?<![\w])_([^_\n]+?)_(?![\w])|(https?:\/\/[^\s<>\])]+)/g;

function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${keyPrefix}-${index++}`;
    const [whole, code, bang, label, href, strongA, strongB, emA, emB, bare] =
      match;
    let end = start + whole.length;
    if (code) {
      nodes.push(<code key={key}>{code.slice(1, -1)}</code>);
    } else if (href !== undefined) {
      const content = bang ? [] : inline(label, key);
      if (content.length) {
        nodes.push(
          /^https?:\/\//i.test(href) ? (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {content}
            </a>
          ) : (
            <span key={key}>{content}</span>
          ),
        );
      }
    } else if (strongA ?? strongB) {
      nodes.push(
        <strong key={key}>
          {inline((strongA ?? strongB) as string, key)}
        </strong>,
      );
    } else if (emA ?? emB) {
      nodes.push(<em key={key}>{inline((emA ?? emB) as string, key)}</em>);
    } else if (bare) {
      // Sentence punctuation after a pasted link isn't part of the link.
      const url = bare.replace(/[.,;:!?'"]+$/, "");
      end = start + url.length;
      nodes.push(
        <a key={key} href={url} target="_blank" rel="noreferrer">
          {url.replace(/^https?:\/\/(www\.)?/, "")}
        </a>,
      );
    }
    last = end;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderList(list: ListBlock, key: string): ReactNode {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag key={key}>
      {list.items.map((item, index) => (
        <li key={index}>
          {inline(item.text)}
          {item.children && renderList(item.children, "nested")}
        </li>
      ))}
    </Tag>
  );
}

function renderBlocks(blocks: Block[], headingOffset: number): ReactNode[] {
  return blocks.map((block, index) => {
    const key = String(index);
    switch (block.type) {
      case "heading": {
        const Tag =
          block.level <= 2
            ? (`h${headingOffset}` as "h3")
            : (`h${headingOffset + 1}` as "h4");
        return <Tag key={key}>{inline(block.text)}</Tag>;
      }
      case "paragraph":
        return <p key={key}>{inline(block.text)}</p>;
      case "quote":
        return (
          <blockquote
            key={key}
            className={block.label ? "markdown-callout" : undefined}
          >
            {block.label && (
              <strong className="markdown-callout-label">{block.label}</strong>
            )}
            {renderBlocks(block.blocks, headingOffset)}
          </blockquote>
        );
      case "code":
        return (
          <pre key={key}>
            <code>{block.text}</code>
          </pre>
        );
      case "rule":
        return <hr key={key} />;
      case "list":
        return renderList(block, key);
    }
  });
}

export function Markdown({
  source,
  headingLevel = 3,
  className = "",
  id,
}: {
  source: string;
  /** The level given to the text's top headings, below the page's own. */
  headingLevel?: 3 | 4;
  className?: string;
  id?: string;
}) {
  const cleaned = source
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-zA-Z][^>\n]*>/g, "");
  return (
    <div id={id} className={`markdown ${className}`.trim()}>
      {renderBlocks(parseBlocks(cleaned.split("\n")), headingLevel)}
    </div>
  );
}
