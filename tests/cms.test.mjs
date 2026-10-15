import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/cms.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { saveDocument, saveLearnDirectory, getLearnTree } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'));

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('migrations/0001_dynamic_content.sql', 'utf8'));
  const database = {
    prepare(query) {
      const statement = sql.prepare(query);
      let values = [];
      const adapter = {
        bind(...input) { values = input; return adapter; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return statement.run(...values); }
      };
      return adapter;
    }
  };
  const locals = { runtime: { env: { HYDROXY_DB: database, HYDROXY_MEDIA: {} } } };
  const node = (path, parent = null) => sql.prepare('INSERT INTO learn_nodes(path,parent_path,label) VALUES(?,?,?)').run(path, parent, path);
  node('computer-science');
  node('computer-science/XCPC-Algorithm', 'computer-science');
  node('computer-science/XCPC-Algorithm/data-structrue', 'computer-science/XCPC-Algorithm');
  const input = {
    kind: 'learn', title: 'Data Structure', description: '', body_markdown: 'Old body',
    parent_path: 'computer-science/XCPC-Algorithm/data-structrue', slug: 'template',
    mood: null, cover_key: null, status: 'published', tags: ['cs'], sort_order: 9999
  };
  return { sql, locals, node, input };
}

test('legacy parent supports publishing, drafting, archiving and immediate tree updates', async () => {
  const { sql, locals, input } = fixture();
  try {
    const original = await saveDocument(locals, input);
    for (const status of ['draft', 'published', 'archived', 'published']) {
      const saved = await saveDocument(locals, { ...input, id: original.id, status, body_markdown: `Updated ${status}` });
      assert.equal(saved.status, status);
      assert.equal(saved.path, original.path);
      const tree = await getLearnTree(locals);
      assert.equal(tree.byPath.has(original.path), status === 'published');
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM search_index').get().n, status === 'published' ? 1 : 0);
    }
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM redirects').get().n, 0);
  } finally { sql.close(); }
});

test('unchanged legacy slug is allowed, but new or moved uppercase slugs are not', async () => {
  const { sql, locals, input } = fixture();
  try {
    const path = 'computer-science/XCPC-Algorithm/Old_Name';
    sql.prepare("INSERT INTO documents(id,kind,path,title,status) VALUES('legacy','learn',?,'Old','published')").run(path);
    sql.prepare("INSERT INTO learn_nodes(path,parent_path,label,document_id) VALUES(?,'computer-science/XCPC-Algorithm','Old','legacy')").run(path);
    const edit = { ...input, id: 'legacy', parent_path: 'computer-science/XCPC-Algorithm', slug: 'Old_Name' };
    assert.equal((await saveDocument(locals, edit)).path, path);
    await assert.rejects(saveDocument(locals, { ...edit, parent_path: '' }), /slug/);
    await assert.rejects(saveDocument(locals, { ...input, slug: 'NEW' }), /slug/);
  } finally { sql.close(); }
});

test('directory creation accepts exact legacy parents and rejects invalid and duplicate paths before writing', async () => {
  const { sql, locals, input } = fixture();
  try {
    const dir = { parent_path: input.parent_path, slug: 'new-notes', label: 'Notes' };
    const result = await saveLearnDirectory(locals, dir);
    assert.equal(result.path, input.parent_path + '/new-notes');
    await assert.rejects(saveLearnDirectory(locals, dir), /already in use/);
    for (const parent_path of ['missing', 'computer-science/../elsewhere', '/computer-science', 'computer-science//child', 'computer-science/%2e%2e', 'computer-science\\child']) {
      await assert.rejects(saveDocument(locals, { ...input, parent_path }), /parent|directory/);
    }
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM documents').get().n, 0);
    await assert.rejects(saveDocument(locals, { ...input, parent_path: input.parent_path, slug: 'new-notes' }), /already in use/);
  } finally { sql.close(); }
});

test('root move records a redirect; self-parent and directory moves leave the database unchanged', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    const original = await saveDocument(locals, input);
    await assert.rejects(saveDocument(locals, { ...input, id: original.id, parent_path: original.path }), /own parent/);
    const moved = await saveDocument(locals, { ...input, id: original.id, parent_path: '', slug: 'root-note' });
    assert.equal(moved.path, 'root-note');
    assert.equal(sql.prepare('SELECT to_path FROM redirects WHERE from_path=?').get('/learn/' + original.path + '/').to_path, '/learn/root-note/');
    node('root-note/child', 'root-note');
    await assert.rejects(saveDocument(locals, { ...input, id: original.id, parent_path: '', slug: 'another' }), /child nodes/);
    assert.equal(sql.prepare('SELECT path FROM documents WHERE id=?').get(original.id).path, 'root-note');
  } finally { sql.close(); }
});
