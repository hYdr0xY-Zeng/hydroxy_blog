import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/AdminLifePanel.astro', import.meta.url), 'utf8');
export const fields = {
  anime: ['title', 'cn_title', 'year', 'score', 'status', 'cover_key', 'sort_order', 'note', 'visibility'],
  gallery: ['title', 'alt', 'media_key', 'sort_order', 'visibility']
};
export const entries = {
  anime: [
    { id: 'anime-a', title: 'Original anime', cn_title: '\u4e2d\u6587\u6807\u9898', year: 2026, score: 9.1, status: 'watching', cover_key: 'shared.png', sort_order: 12, note: 'A multiline note\nwith details.', visibility: 'draft' },
    { id: 'anime-b', title: 'Fallback original title', cn_title: '', year: null, score: null, status: 'completed', cover_key: null, sort_order: -2, note: '', visibility: 'archived' }
  ],
  gallery: [
    { id: 'gallery-a', title: 'Gallery title', alt: 'Original alt text', media_key: 'shared.png', sort_order: 11, visibility: 'draft' },
    { id: 'gallery-b', title: 'Other gallery title', alt: '', media_key: 'second.png', sort_order: -3, visibility: 'archived' }
  ]
};
export const displayTitle = (entry) => entry.cn_title || entry.title;
export const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Keep local synthetic data separate from the real built interaction scripts.
export function panel(kind, deleted = new Set(), records = entries[kind]) {
  const controls = fields[kind].map((name) => {
    const label = source.match(new RegExp(`<label[^>]*>([^<]+)<(?:input|textarea|select)[^>]*name="${name}"`))?.[1];
    assert.ok(label, `Real label for ${name}`);
    if (name === 'visibility') return `<label>${label}<select name="visibility"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>`;
    if (name === 'note') return `<label class="admin-life__wide">${label}<textarea name="note"></textarea></label>`;
    const numeric = ['year', 'score', 'sort_order'].includes(name);
    return `<label>${label}<input name="${name}" ${numeric ? 'type="number" step="any"' : ''} ${name === 'sort_order' ? 'value="0"' : ''} ${['title', 'media_key'].includes(name) ? 'required' : ''}></label>`;
  }).join('');
  const title = kind === 'anime' ? 'Anime Log' : 'Gallery';
  return `<section class="admin-panel admin-life" id="admin-${kind}" data-admin-panel data-life-panel="${kind}" aria-labelledby="admin-${kind}-heading">
    <div class="admin-panel__head"><h2 id="admin-${kind}-heading">${title}</h2></div>
    <div class="admin-split admin-life__workspace"><div class="admin-life__collection">
      <form class="admin-form admin-life__search" method="get" action="/admin/#admin-${kind}"><label>Search<input type="search" name="${kind}_q"></label><button class="text-button">SEARCH</button></form>
      <p class="admin-life__count">${records.length} records</p>
      <ul class="admin-life__list admin-scroll-list" tabindex="0" aria-label="${title} entries">${records.filter((entry) => !deleted.has(entry.id)).map((entry) => `<li><button class="text-button admin-life__edit" type="button" data-life-entry="${escape(JSON.stringify(entry))}" aria-pressed="false"><strong>${escape(displayTitle(entry))}</strong><span>${entry.visibility}</span><span>EDIT</span></button><button class="text-button danger-button" type="button" data-life-delete data-life-id="${entry.id}" data-life-title="${escape(displayTitle(entry))}">DELETE</button></li>`).join('')}</ul>
      <nav class="pagination" aria-label="${title} pages"><span>Prev</span><div class="pagination__pages"><span aria-current="page">1</span><a href="?${kind}_page=2#admin-${kind}">2</a></div><a href="?${kind}_page=2#admin-${kind}">Next</a></nav>
    </div><div class="admin-life__editing"><div class="admin-life__editor-actions"><button class="text-button" type="button" data-life-new>NEW / RESET</button></div>
      <form class="admin-form admin-life__editor" data-life-form="${kind}"><p class="admin-life__selection" data-life-selection>New / published</p><fieldset data-life-fields><input name="id" type="hidden">${controls}<div class="admin-life__wide"><button class="text-button" type="submit">SAVE</button></div></fieldset><output data-life-error></output></form>
    </div></div>
    <dialog class="delete-dialog pixel-panel" data-life-delete-dialog><form data-life-delete-form><h2>Delete ${kind}</h2><p>Confirm <strong data-life-delete-title></strong></p><label>Confirmation<input data-life-confirmation autocomplete="off" required autofocus></label><div><button class="text-button" type="button" data-life-cancel>CANCEL</button><button class="text-button danger-button" type="submit">DELETE</button></div><output data-life-delete-error aria-live="polite"></output></form></dialog>
  </section>`;
}
