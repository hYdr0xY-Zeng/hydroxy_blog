import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { Element, ElementContent, Parent, Root } from 'hast';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from '@shikijs/langs/bash';
import c from '@shikijs/langs/c';
import cpp from '@shikijs/langs/cpp';
import css from '@shikijs/langs/css';
import go from '@shikijs/langs/go';
import html from '@shikijs/langs/html';
import java from '@shikijs/langs/java';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import markdown from '@shikijs/langs/markdown';
import python from '@shikijs/langs/python';
import rust from '@shikijs/langs/rust';
import sql from '@shikijs/langs/sql';
import typescript from '@shikijs/langs/typescript';
import xml from '@shikijs/langs/xml';
import yaml from '@shikijs/langs/yaml';
import githubDark from '@shikijs/themes/github-dark';

export type MarkdownHeading = { depth: number; slug: string; text: string };

const SHIKI_LANGUAGES = new Set(['bash', 'c', 'cpp', 'css', 'go', 'html', 'java', 'javascript', 'json', 'markdown', 'python', 'rust', 'sql', 'typescript', 'xml', 'yaml']);
const SHIKI_ALIASES: Record<string, string> = { js: 'javascript', sh: 'bash', shell: 'bash', ts: 'typescript', yml: 'yaml', md: 'markdown' };
let shikiHighlighter: ReturnType<typeof createHighlighterCore> | undefined;

function getHighlighter() {
  return shikiHighlighter ??= createHighlighterCore({
    themes: [githubDark],
    langs: [bash, c, cpp, css, go, html, java, javascript, json, markdown, python, rust, sql, typescript, xml, yaml],
    engine: createJavaScriptRegexEngine({ forgiving: true })
  });
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
    const highlighter = await getHighlighter();
    blocks.forEach(({ code, index, parent, rawLanguage, language }) => {
      const rendered = highlighter.codeToHtml(toString(code), { lang: language, theme: 'github-dark' });
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
  const rendered = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(attachCodeLanguages)
    .use(highlightCodeBlocks)
    .use(() => collectHeadings(headings))
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return { html: String(rendered), headings };
}
