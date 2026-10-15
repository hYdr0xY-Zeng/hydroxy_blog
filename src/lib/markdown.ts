import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Element, ElementContent, Parent, Root } from 'hast';

export type MarkdownHeading = { depth: number; slug: string; text: string };

const SHIKI_LANGUAGE_LOADERS = {
  bash: () => import('@shikijs/langs/bash'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  css: () => import('@shikijs/langs/css'),
  go: () => import('@shikijs/langs/go'),
  html: () => import('@shikijs/langs/html'),
  java: () => import('@shikijs/langs/java'),
  javascript: () => import('@shikijs/langs/javascript'),
  json: () => import('@shikijs/langs/json'),
  markdown: () => import('@shikijs/langs/markdown'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  sql: () => import('@shikijs/langs/sql'),
  typescript: () => import('@shikijs/langs/typescript'),
  xml: () => import('@shikijs/langs/xml'),
  yaml: () => import('@shikijs/langs/yaml')
};
const SHIKI_LANGUAGES = new Set(Object.keys(SHIKI_LANGUAGE_LOADERS));
const SHIKI_ALIASES: Record<string, string> = { js: 'javascript', sh: 'bash', shell: 'bash', ts: 'typescript', yml: 'yaml', md: 'markdown' };
type ShikiHighlighter = {
  codeToHtml(code: string, options: { lang: string; theme: string }): string;
  loadLanguage(language: Awaited<ReturnType<typeof SHIKI_LANGUAGE_LOADERS.bash>>['default']): Promise<void>;
};

let shikiHighlighter: Promise<ShikiHighlighter> | undefined;
const languageLoads = new Map<string, Promise<void>>();
const highlightedBlocks = new Map<string, string>();
let highlightedBytes = 0;
const MAX_HIGHLIGHT_BYTES = 2 * 1024 * 1024;
const MAX_HIGHLIGHT_BLOCKS = 128;

async function getHighlighter(languages: string[]) {
  shikiHighlighter ??= (async () => {
    const [core, engine, theme] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/themes/github-dark')
    ]);
    return core.createHighlighterCore({
      themes: [theme.default],
      langs: [],
      engine: engine.createJavaScriptRegexEngine({ forgiving: true })
    });
  })().catch((error) => { shikiHighlighter = undefined; throw error; });
  const highlighter = await shikiHighlighter;
  await Promise.all([...new Set(languages)].map((language) => {
    let loading = languageLoads.get(language);
    if (!loading) {
      loading = SHIKI_LANGUAGE_LOADERS[language as keyof typeof SHIKI_LANGUAGE_LOADERS]()
        .then((module) => highlighter.loadLanguage(module.default))
        .catch((error) => { languageLoads.delete(language); throw error; });
      languageLoads.set(language, loading);
    }
    return loading;
  }));
  return highlighter;
}

function highlightedCode(highlighter: ShikiHighlighter, language: string, source: string) {
  const key = `${language}\0${source}`;
  const cached = highlightedBlocks.get(key);
  if (cached !== undefined) {
    highlightedBlocks.delete(key);
    highlightedBlocks.set(key, cached);
    return cached;
  }
  const html = highlighter.codeToHtml(source, { lang: language, theme: 'github-dark' });
  const size = (key.length + html.length) * 2;
  if (size <= MAX_HIGHLIGHT_BYTES) {
    while (highlightedBlocks.size >= MAX_HIGHLIGHT_BLOCKS || highlightedBytes + size > MAX_HIGHLIGHT_BYTES) {
      const oldest = highlightedBlocks.entries().next().value;
      if (!oldest) break;
      highlightedBytes -= (oldest[0].length + oldest[1].length) * 2;
      highlightedBlocks.delete(oldest[0]);
    }
    highlightedBlocks.set(key, html);
    highlightedBytes += size;
  }
  return html;
}

function codeElement(pre: Element) {
  return pre.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
}

function codeLanguage(code: Element) {
  const classes = code.properties.className;
  return Array.isArray(classes) ? classes.find((value): value is string => typeof value === 'string' && value.startsWith('language-'))?.slice(9) : undefined;
}

function attachCodeLanguages() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      const pre = node as Element;
      if (pre.tagName !== 'pre') return;
      const language = codeElement(pre) ? codeLanguage(codeElement(pre)!) : undefined;
      if (language) pre.properties['data-language'] = language;
    });
  };
}

function highlightCodeBlocks() {
  return async (tree: Root) => {
    const blocks: Array<{ code: Element; index: number; parent: Parent; rawLanguage: string; language: string }> = [];
    visit(tree, 'element', (node, index, parent) => {
      const pre = node as Element;
      if (pre.tagName !== 'pre' || typeof index !== 'number' || !parent) return;
      const code = codeElement(pre);
      if (!code) return;
      const rawLanguage = codeLanguage(code);
      if (!rawLanguage || rawLanguage === 'mermaid') return;
      const language = SHIKI_ALIASES[rawLanguage] ?? rawLanguage;
      if (SHIKI_LANGUAGES.has(language)) blocks.push({ code, index, parent, rawLanguage, language });
    });
    if (!blocks.length) return;
    const highlighter = await getHighlighter(blocks.map((block) => block.language));
    blocks.forEach(({ code, index, parent, rawLanguage, language }) => {
      const rendered = highlightedCode(highlighter, language, toString(code));
      const html = rendered.replace('<pre', '<pre data-language="' + rawLanguage + '"');
      parent.children[index] = { type: 'raw', value: html } as unknown as ElementContent;
    });
  };
}

function collectHeadings(headings: MarkdownHeading[]) {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      const heading = node as Element;
      if (!/^h[23]$/.test(heading.tagName)) return;
      const slug = typeof heading.properties.id === 'string' ? heading.properties.id : '';
      if (slug) headings.push({ depth: Number(heading.tagName.slice(1)), slug, text: toString(heading) });
    });
  };
}

export async function renderMarkdown(markdown: string) {
  const headings: MarkdownHeading[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(attachCodeLanguages)
    .use(highlightCodeBlocks)
    .use(() => collectHeadings(headings));

  if (/\$|\\(?:\(|\[)/.test(markdown)) {
    const { default: rehypeKatex } = await import('rehype-katex');
    processor.use(rehypeKatex);
  }

  const rendered = await processor
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return { html: String(rendered), headings };
}
