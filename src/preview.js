import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

// A deliberately small Markdown subset: enough to see the README the way GitHub
// will show it, without pulling a parser into the dependency list.
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text) {
  return text
    .replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function render(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let fence = null;
  let table = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const cells = (row) =>
    row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const flushTable = () => {
    if (!table) return;
    const head = `<thead><tr>${table.head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
    const body = table.rows
      .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
      .join("");
    html.push(`<table>${head}<tbody>${body}</tbody></table>`);
    table = null;
  };
  const flushList = () => {
    if (list) {
      html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const lineText = raw.replace(/\s+$/, "");

    if (fence !== null) {
      if (lineText.startsWith("```")) {
        html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = null;
      } else {
        fence.push(lineText);
      }
      continue;
    }
    if (lineText.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      fence = [];
      continue;
    }
    // HTML in a README passes straight through, which is how the banner block
    // and its centred image survive.
    if (/^\s*<(?!!--)/.test(lineText)) {
      flushParagraph();
      flushList();
      flushTable();
      html.push(lineText);
      continue;
    }
    if (lineText.trim() === "" ) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }
    const heading = lineText.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushTable();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(lineText.trim())) {
      flushParagraph();
      flushList();
      flushTable();
      html.push("<hr>");
      continue;
    }
    // Pipe tables: a header row, a separator row of dashes, then body rows.
    if (/^\s*\|.*\|\s*$/.test(lineText)) {
      flushParagraph();
      flushList();
      const row = cells(lineText);
      if (!table) {
        table = { head: row, rows: [], sawSeparator: false };
      } else if (!table.sawSeparator && row.every((c) => /^:?-{2,}:?$/.test(c))) {
        table.sawSeparator = true;
      } else {
        table.rows.push(row);
      }
      continue;
    }
    flushTable();

    const bullet = lineText.match(/^\s*[-*]\s+(.*)$/);
    const numbered = lineText.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const tag = bullet ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((bullet ?? numbered)[1]);
      continue;
    }
    flushList();
    paragraph.push(lineText.trim());
  }
  flushParagraph();
  flushList();
  flushTable();
  return html.join("\n");
}

const CSS = `
:root { color-scheme: light dark; }
body { margin: 0; background: #f6f8fa; font: 16px/1.6 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2328; }
main { max-width: 1012px; margin: 32px auto; padding: 0 16px 64px; }
.frame { background: #fff; border: 1px solid #d1d9e0; border-radius: 6px; padding: 32px 40px; }
.bar { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #59636e; padding: 8px 4px 12px; }
.bar strong { color: #1f2328; }
h1, h2, h3 { margin: 24px 0 16px; font-weight: 600; line-height: 1.25; }
h1 { font-size: 32px; border-bottom: 1px solid #d1d9e0; padding-bottom: 8px; }
h2 { font-size: 24px; border-bottom: 1px solid #d1d9e0; padding-bottom: 8px; }
h3 { font-size: 20px; }
p, ul, ol { margin: 0 0 16px; }
li { margin: 4px 0; }
code { background: #eff1f3; border-radius: 6px; padding: .2em .4em; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
pre code { background: none; padding: 0; }
img { max-width: 100%; }
table { border-collapse: collapse; margin: 0 0 16px; display: block; overflow: auto; }
th, td { border: 1px solid #d1d9e0; padding: 6px 13px; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(2n) td { background: #f6f8fa; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
hr { border: 0; border-top: 1px solid #d1d9e0; margin: 24px 0; }
sub { color: #59636e; font-size: 12px; }
@media (prefers-color-scheme: dark) {
  body { background: #010409; color: #f0f6fc; }
  .frame { background: #0d1117; border-color: #3d444d; }
  h1, h2 { border-color: #3d444d; }
  code { background: #151b23; }
  pre { background: #151b23; }
  .bar, sub { color: #9198a1; }
  .bar strong { color: #f0f6fc; }
  hr { border-color: #3d444d; }
  th, td { border-color: #3d444d; }
  th, tr:nth-child(2n) td { background: #151b23; }
}
`;

export function writePreview(readmePath, markdown, previewDir) {
  mkdirSync(previewDir, { recursive: true });
  const toReadme = relative(previewDir, dirname(readmePath)) || ".";
  // Rewrite relative asset paths so the preview loads the same files GitHub would.
  const fixed = markdown.replace(
    /(src|href)="(?!https?:|#|\/)([^"]+)"/g,
    (_, attr, value) => `${attr}="${join(toReadme, value).split("\\").join("/")}"`,
  );
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>README preview</title><style>${CSS}</style></head>
<body><main>
<div class="bar">README preview &middot; <strong>${escapeHtml(readmePath)}</strong></div>
<div class="frame">${render(fixed)}</div>
</main></body></html>`;
  const outFile = join(previewDir, "index.html");
  writeFileSync(outFile, page);
  return outFile;
}
