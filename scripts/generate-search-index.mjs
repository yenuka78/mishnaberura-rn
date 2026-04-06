import fs from 'node:fs/promises';
import path from 'node:path';
import MiniSearch from 'minisearch';

const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, 'assets');
const outputFile = path.join(projectRoot, 'src', 'searchIndex.generated.js');
const decoder = new TextDecoder('windows-1255');

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|center|tr|table|hr|h1|h2|h3|h4|h5|h6|u|b)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeText(text) {
  return text
    .replace(/["'`׳״.,;:!?()[\]{}<>/\\|+=_*~^-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classifyFile(file) {
  if (/_sh_mishna\.html$/i.test(file)) return 'mishna';
  if (/_sh_beur\.html$/i.test(file)) return 'beur';
  if (/_sh\.html$/i.test(file)) return 'main';
  return null;
}

function labelForKind(kind) {
  if (kind === 'main') return 'שולחן ערוך';
  if (kind === 'mishna') return 'משנה ברורה';
  if (kind === 'beur') return 'ביאור הלכה';
  return '';
}

function baseFileFor(file, kind) {
  if (kind === 'main') return file;
  return file.replace('_sh_mishna.html', '_sh.html').replace('_sh_beur.html', '_sh.html');
}

function commentaryFilesFor(baseFile) {
  return {
    mishnaFile: baseFile.replace('_sh.html', '_sh_mishna.html'),
    beurFile: baseFile.replace('_sh.html', '_sh_beur.html'),
  };
}

function getAnchorRegex(kind) {
  if (kind === 'main') return /<a name="(HtmpReportNum\d+_L2)"/gi;
  if (kind === 'mishna') return /<a name="(HtmpMishna\d+_L2)"/gi;
  if (kind === 'beur') return /<a name="(HtmpBeur\d+_L2)"/gi;
  return null;
}

function extractTitle(sectionHtml, fallbackTitle) {
  const plain = stripHtml(sectionHtml);
  const lines = plain
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.length >= 4 && line.length <= 160) {
      return line;
    }
  }

  return fallbackTitle;
}

function splitSections(html, kind, fallbackTitle) {
  const anchorRegex = getAnchorRegex(kind);
  const anchors = [...html.matchAll(anchorRegex)];

  if (anchors.length === 0) {
    return [{
      anchor: '',
      title: fallbackTitle,
      body: html,
    }];
  }

  return anchors.map((match, index) => {
    const start = match.index ?? 0;
    const end = index + 1 < anchors.length ? anchors[index + 1].index : html.length;
    const body = html.slice(start, end);
    return {
      anchor: match[1],
      title: extractTitle(body, fallbackTitle),
      body,
    };
  });
}

function chunkSections(sections, chunkSize) {
  const chunks = [];

  for (let index = 0; index < sections.length; index += chunkSize) {
    const group = sections.slice(index, index + chunkSize);
    const title = group[0]?.title || '';
    const anchor = group[0]?.anchor || '';
    const body = group.map(section => section.body).join('\n');

    chunks.push({ title, anchor, body });
  }

  return chunks;
}

function previewText(text, max = 220) {
  return text.length <= max ? text : `${text.slice(0, max).trim()}...`;
}

async function buildIndex() {
  const documents = [];
  const files = (await fs.readdir(assetsDir))
    .filter(file => file.endsWith('.html'))
    .sort();

  for (const file of files) {
    const kind = classifyFile(file);
    if (!kind) continue;

    const raw = await fs.readFile(path.join(assetsDir, file));
    const html = decoder.decode(raw);
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const fallbackTitle = stripHtml(titleMatch?.[1] ?? file);
    const baseFile = baseFileFor(file, kind);
    const { mishnaFile, beurFile } = commentaryFilesFor(baseFile);

    const sections = splitSections(html, kind, fallbackTitle);
    const documentsForFile = kind === 'main'
      ? sections
      : chunkSections(sections, 8);

    for (let index = 0; index < documentsForFile.length; index += 1) {
      const section = documentsForFile[index];
      const plain = stripHtml(section.body);
      const normalized = normalizeText(`${section.title} ${plain}`);

      if (!normalized) continue;

      documents.push({
        id: `${file}:${section.anchor || index}`,
        kind,
        file,
        baseFile,
        mishnaFile,
        beurFile,
        anchor: section.anchor,
        label: labelForKind(kind),
        title: section.title,
        preview: previewText(plain),
        text: normalized,
      });
    }
  }

  const miniSearch = new MiniSearch({
    fields: ['title', 'text'],
    storeFields: [
      'kind',
      'file',
      'baseFile',
      'mishnaFile',
      'beurFile',
      'anchor',
      'label',
      'title',
      'preview',
    ],
  });

  miniSearch.addAll(documents);

  const output = [
    `export const MINI_SEARCH_INDEX = ${JSON.stringify(miniSearch.toJSON())};`,
    `export const SEARCH_DOCUMENT_COUNT = ${documents.length};`,
    '',
  ].join('\n');

  await fs.writeFile(outputFile, output);
  console.log(`Wrote ${documents.length} search entries to ${path.relative(projectRoot, outputFile)}`);
}

buildIndex().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
