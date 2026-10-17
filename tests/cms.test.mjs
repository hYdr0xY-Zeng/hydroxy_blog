import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['src/lib/cms.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { saveDocument, saveLearnDirectory, getLearnTree, listLearnDirectories, listDocuments, deleteDocument, getDocument, getDocumentById, documentHref, getEngagementTotals, searchContent } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'));

const migrations = ['0001_dynamic_content.sql', '0002_article_engagement.sql', '0003_learn_node_types.sql'];
function migrate(sql, names = migrations) {
  for (const name of names) sql.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
}

function fixture({ beforeNodeTypes } = {}) {
  const sql = new DatabaseSync(':memory:');
  migrate(sql, migrations.slice(0, 2));
  beforeNodeTypes?.(sql);
  migrate(sql, migrations.slice(2));
  const database = {
    async batch(statements) {
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
    prepare(query) {
      const statement = sql.prepare(query);
      let values = [];
      const adapter = {
        bind(...input) { values = input; return adapter; },
        async first(column) { const row = statement.get(...values); return column ? row?.[column] ?? null : row ?? null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return statement.run(...values); }
      };
      return adapter;
    }
  };
  const locals = { runtime: { env: { HYDROXY_DB: database, HYDROXY_MEDIA: {} } } };
  const node = (path, parent = null) => sql.prepare("INSERT INTO learn_nodes(path,parent_path,label,node_type) VALUES(?,?,?,'directory')").run(path, parent, path);
  node('computer-science');
  node('computer-science/XCPC-Algorithm', 'computer-science');
  node('computer-science/XCPC-Algorithm/data-structrue', 'computer-science/XCPC-Algorithm');
  const input = {
    kind: 'learn', title: 'Data Structure', description: '', body_markdown: 'Old body',
    parent_path: 'computer-science/XCPC-Algorithm/data-structrue', slug: 'template',
    mood: null, cover_key: null, status: 'published', tags: ['cs'], sort_order: 9999
  };
  return { sql, database, locals, node, input };
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

test('root move records a redirect; articles cannot become parents', async () => {
  const { sql, locals, input } = fixture();
  try {
    const original = await saveDocument(locals, input);
    await assert.rejects(saveDocument(locals, { ...input, id: original.id, parent_path: original.path }));
    const moved = await saveDocument(locals, { ...input, id: original.id, parent_path: '', slug: 'root-note' });
    assert.equal(moved.path, 'root-note');
    assert.equal(sql.prepare('SELECT to_path FROM redirects WHERE from_path=?').get('/learn/' + original.path + '/').to_path, '/learn/root-note/');
    await assert.rejects(saveLearnDirectory(locals, { parent_path: moved.path, slug: 'child', label: 'Child' }));
    await assert.rejects(saveDocument(locals, { ...input, parent_path: moved.path, slug: 'child' }));
    assert.equal(sql.prepare('SELECT path FROM documents WHERE id=?').get(original.id).path, 'root-note');
  } finally { sql.close(); }
});

test('D1 batch adapter rolls back all statements on failure', async () => {
  const { sql, database } = fixture();
  try {
    await assert.rejects(database.batch([
      database.prepare("INSERT INTO tags(slug,label) VALUES('batch','Batch')"),
      database.prepare("INSERT INTO tags(slug,label) VALUES('batch','Duplicate')")
    ]));
    assert.equal(sql.prepare("SELECT COUNT(*) n FROM tags WHERE slug='batch'").get().n, 0);
    await database.batch([database.prepare("INSERT INTO tags(slug,label) VALUES('batch','Batch')")]);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM tags').get().n, 1);
  } finally { sql.close(); }
});

test('directories accept multiple articles and one intro without changing directory metadata', async () => {
  const { sql, locals, input } = fixture();
  try {
    const directory = await saveLearnDirectory(locals, { parent_path: input.parent_path, slug: 'notes', label: 'Stable directory label', sort_order: 17 });
    const first = await saveDocument(locals, { ...input, parent_path: directory.path, slug: 'first' });
    const second = await saveDocument(locals, { ...input, parent_path: directory.path, slug: 'second' });
    const intro = await saveDocument(locals, { ...input, parent_path: undefined, slug: undefined, directory_path: directory.path, title: 'Different intro title', sort_order: 99 });
    assert.equal(intro.path, directory.path);
    assert.notEqual(first.id, second.id);
    assert.equal(first.path, directory.path + '/first');
    assert.equal(second.path, directory.path + '/second');
    for (const article of [first, second]) assert.equal(sql.prepare('SELECT node_type FROM learn_nodes WHERE document_id=?').get(article.id).node_type, 'article');
    const row = sql.prepare('SELECT * FROM learn_nodes WHERE path=?').get(directory.path);
    assert.equal(row.node_type, 'directory');
    assert.equal(row.document_id, intro.id);
    assert.equal(row.label, 'Stable directory label');
    assert.equal(row.sort_order, 17);
    const updated = await saveDocument(locals, { ...input, id: intro.id, directory_path: directory.path, title: 'Edited intro', sort_order: 100, body_markdown: 'Updated intro' });
    assert.equal(updated.id, intro.id);
    assert.equal(updated.body_markdown, 'Updated intro');
    assert.equal(sql.prepare('SELECT label,sort_order FROM learn_nodes WHERE path=?').get(directory.path).label, row.label);
    assert.equal(sql.prepare('SELECT sort_order FROM learn_nodes WHERE path=?').get(directory.path).sort_order, 17);
    const directories = await listLearnDirectories(locals);
    assert.ok(directories.some((entry) => entry.path === directory.path));
    assert.ok(!directories.some((entry) => [first.path, second.path].includes(entry.path)));
    for (const options of [{}, { kind: 'learn' }, { includeUnpublished: true }, { kind: 'learn', includeUnpublished: true }]) {
      const documents = await listDocuments(locals, options);
      assert.ok(!documents.some((entry) => entry.id === intro.id));
      assert.ok(documents.some((entry) => entry.id === first.id));
      assert.ok(documents.some((entry) => entry.id === second.id));
    }
    await assert.rejects(saveDocument(locals, { ...input, directory_path: directory.path }));
    await assert.rejects(saveDocument(locals, { ...input, directory_path: first.path }));
    await assert.rejects(saveDocument(locals, { ...input, directory_path: 'missing' }));
  } finally { sql.close(); }
});

test('intro role and path are immutable, including on empty directories', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('empty');
    node('other');
    const intro = await saveDocument(locals, { ...input, directory_path: 'empty', body_markdown: '' });
    const before = snapshot(sql);
    for (const change of [
      { kind: 'essay', path: 'essay-intro' },
      { kind: 'profile', path: 'home' },
      { directory_path: 'other' },
      { directory_path: undefined, parent_path: '', slug: 'converted-article' }
    ]) {
      await assert.rejects(saveDocument(locals, { ...input, id: intro.id, directory_path: 'empty', ...change }));
      assert.deepEqual(snapshot(sql), before);
    }
    await assert.rejects(deleteDocument(locals, intro.id, intro.title));
    assert.deepEqual(snapshot(sql), before);
    const article = await saveDocument(locals, { ...input, parent_path: 'other' });
    const articleBefore = snapshot(sql);
    await assert.rejects(saveDocument(locals, { ...input, id: article.id, directory_path: 'other' }));
    assert.deepEqual(snapshot(sql), articleBefore);
  } finally { sql.close(); }
});

for (const status of ['draft', 'published', 'archived']) {
  test(`${status} directory intro cannot be deleted even with no body or children`, async () => {
    const { sql, locals, node, input } = fixture();
    try {
      node('empty');
      const intro = await saveDocument(locals, { ...input, directory_path: 'empty', status, body_markdown: '' });
      const before = snapshot(sql);
      await assert.rejects(deleteDocument(locals, intro.id, intro.title));
      assert.deepEqual(snapshot(sql), before);
      assert.equal((await getDocument(locals, 'learn', 'empty', true)).id, intro.id);
    } finally { sql.close(); }
  });
}

function snapshot(sql) {
  return Object.fromEntries(['documents', 'learn_nodes', 'redirects', 'document_tags', 'tags', 'search_index', 'document_daily_views', 'document_likes', 'media_assets', 'anime_entries', 'gallery_entries'].map((table) => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}

async function rejectsWithoutWrites(sql, operation, label) {
  const before = snapshot(sql);
  const changes = sql.prepare('SELECT total_changes() AS n').get().n;
  await assert.rejects(operation, undefined, label);
  assert.deepEqual(snapshot(sql), before, label);
  assert.equal(sql.prepare('SELECT total_changes() AS n').get().n, changes, `${label}: must reject before any write`);
}

test('getDocumentById reports directory and ordinary article roles without losing document data', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('intro');
    const intro = await saveDocument(locals, { ...input, directory_path: 'intro', status: 'draft' });
    const article = await saveDocument(locals, input);
    const essay = await saveDocument(locals, { ...input, kind: 'essay', path: 'essay' });
    for (const [document, role] of [[intro, 'directory'], [article, 'article'], [essay, undefined]]) {
      const { learn_node_type, ...loaded } = await getDocumentById(locals, document.id);
      assert.equal(learn_node_type, role);
      assert.deepEqual(loaded, document);
    }
    assert.equal(await getDocumentById(locals, 'missing'), null);
  } finally { sql.close(); }
});

test('engagement totals exclude directory history while preserving article and essay history', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('intro');
    const intro = await saveDocument(locals, { ...input, directory_path: 'intro' });
    const article = await saveDocument(locals, input);
    const essay = await saveDocument(locals, { ...input, kind: 'essay', path: 'essay' });
    const profile = await saveDocument(locals, { ...input, kind: 'profile', path: 'home' });
    const draft = await saveDocument(locals, { ...input, slug: 'draft', status: 'draft' });
    const archived = await saveDocument(locals, { ...input, slug: 'archived', status: 'archived' });
    for (const [index, document] of [intro, article, essay, profile, draft, archived].entries()) {
      for (let visitor = 0; visitor <= index; visitor++) {
        sql.prepare('INSERT INTO document_daily_views(document_id,visitor_hash,viewed_on) VALUES(?,?,?)').run(document.id, `visitor-${visitor}`, '2026-10-17');
      }
      sql.prepare('INSERT INTO document_likes(document_id,visitor_hash) VALUES(?,?)').run(document.id, 'visitor-0');
    }
    const before = snapshot(sql);
    assert.deepEqual(await getEngagementTotals(locals), { views: 5, likes: 2 });
    assert.deepEqual(snapshot(sql), before, 'Reading totals must retain excluded historical engagement');
    await saveDocument(locals, { ...input, id: intro.id, directory_path: 'intro', body_markdown: '' });
    assert.deepEqual(await getEngagementTotals(locals), { views: 5, likes: 2 });
    await saveDocument(locals, { ...input, id: article.id, status: 'archived' });
    assert.deepEqual(await getEngagementTotals(locals), { views: 3, likes: 1 });
    await saveDocument(locals, { ...input, id: article.id });
    assert.deepEqual(await getEngagementTotals(locals), { views: 5, likes: 2 });
  } finally { sql.close(); }
});

test('search removes blank introductions and restores exactly one index row on republish', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('intro');
    const article = await saveDocument(locals, { ...input, title: 'Searchneedle article' });
    const intro = await saveDocument(locals, { ...input, directory_path: 'intro', title: 'Searchneedle intro' });
    for (const [body_markdown, status, visible] of [
      ['', 'published', false], ['  \n\t\r', 'published', false],
      ['Restored body', 'draft', false], ['Restored body', 'published', true],
      ['Restored body', 'published', true], ['Restored body', 'archived', false],
      ['Republished body', 'published', true]
    ]) {
      await saveDocument(locals, { ...input, id: intro.id, directory_path: 'intro', title: intro.title, body_markdown, status });
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM search_index WHERE entity_id=?').get(intro.id).n, visible ? 1 : 0);
      const results = await searchContent(locals, 'Searchneedle');
      assert.equal(results.filter((row) => row.entity_id === intro.id).length, visible ? 1 : 0);
      assert.ok(results.some((row) => row.entity_id === article.id), 'Unrelated article must remain indexed');
      if (visible) assert.equal(results.find((row) => row.entity_id === intro.id).path, 'intro');
    }
  } finally { sql.close(); }
});

for (const body of ['', '   ', '\n\t\r']) {
  test(`0003 removes a blank intro search row (${JSON.stringify(body)}) without dropping history`, async () => {
    const { sql, locals, input } = fixture({ beforeNodeTypes(database) {
      database.prepare("INSERT INTO documents(id,kind,path,source_path,title,body_markdown,status) VALUES('blank-intro','learn','intro','src/content/learn/intro/index.md','Searchneedle intro',?,'published')").run(body);
      database.exec("INSERT INTO learn_nodes(path,label,document_id) VALUES('intro','Intro','blank-intro')");
      database.prepare("INSERT INTO search_index(entity_id,entity_kind,path,title,body) VALUES('blank-intro','learn','intro','Searchneedle intro',?)").run(body);
      database.exec("INSERT INTO document_daily_views(document_id,visitor_hash,viewed_on) VALUES('blank-intro','visitor','2026-10-17'); INSERT INTO document_likes(document_id,visitor_hash) VALUES('blank-intro','visitor')");
    } });
    try {
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM search_index WHERE entity_id='blank-intro'").get().n, 0);
      assert.deepEqual(await searchContent(locals, 'Searchneedle'), []);
      assert.deepEqual(await getEngagementTotals(locals), { views: 0, likes: 0 });
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM document_daily_views').get().n, 1);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM document_likes').get().n, 1);
      const intro = await saveDocument(locals, { ...input, id: 'blank-intro', directory_path: 'intro', title: 'Searchneedle intro' });
      assert.equal(intro.id, 'blank-intro');
      assert.equal((await searchContent(locals, 'Searchneedle'))[0].entity_id, intro.id);
      assert.equal((await getDocumentById(locals, intro.id)).learn_node_type, 'directory');
    } finally { sql.close(); }
  });
}

test('invalid parents reject new articles, moves, kind conversions and directories before any write', async () => {
  const { sql, locals, input } = fixture();
  try {
    const article = await saveDocument(locals, input);
    const essay = await saveDocument(locals, { ...input, kind: 'essay', path: 'essay' });
    for (const parent_path of ['missing', article.path, article.path + '/missing', 'computer-science/../other', '/computer-science', 'computer-science//child', 'computer-science/%2e%2e', 'computer-science\\child']) {
      for (const id of [undefined, article.id, essay.id]) {
        await rejectsWithoutWrites(sql, () => saveDocument(locals, { ...input, id, parent_path, slug: 'changed', title: 'Must not persist', tags: ['must-not-persist'] }), `document ${id ?? 'new'} parent ${parent_path}`);
      }
      await rejectsWithoutWrites(sql, () => saveLearnDirectory(locals, { parent_path, slug: 'new-directory', label: 'Must not persist' }), `directory parent ${parent_path}`);
    }
  } finally { sql.close(); }
});

test('directory role cannot be bypassed with omitted paths, colliding paths or forged roles', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('intro');
    node('other');
    const intro = await saveDocument(locals, { ...input, directory_path: 'intro' });
    const article = await saveDocument(locals, input);
    const essay = await saveDocument(locals, { ...input, kind: 'essay', path: 'essay' });
    for (const change of [
      { directory_path: undefined, parent_path: '', slug: 'intro' },
      { directory_path: '', parent_path: '', slug: 'intro' },
      { directory_path: 'other' },
      { kind: 'essay', path: 'intro' },
      { kind: 'profile', path: 'home', directory_path: undefined },
      { kind: 'essay', path: 'essay', learn_node_type: 'article', node_type: 'article' }
    ]) {
      await rejectsWithoutWrites(sql, () => saveDocument(locals, { ...input, id: intro.id, directory_path: 'intro', ...change }), `intro role ${JSON.stringify(change)}`);
    }
    for (const id of [undefined, article.id, essay.id]) {
      await rejectsWithoutWrites(sql, () => saveDocument(locals, { ...input, id, parent_path: '', slug: 'other', path: 'other', learn_node_type: 'directory', node_type: 'directory' }), `directory path collision ${id ?? 'new'}`);
    }
    for (const id of [article.id, essay.id]) {
      await rejectsWithoutWrites(sql, () => saveDocument(locals, { ...input, id, directory_path: 'other', learn_node_type: 'directory' }), `convert to intro ${id}`);
    }
    for (const directory_path of ['', 'missing', article.path, 'intro', '../other', '/other', 'other//child', 'other/%2e%2e', 'other\\child']) {
      await rejectsWithoutWrites(sql, () => saveDocument(locals, { ...input, directory_path, tags: ['must-not-persist'] }), `invalid intro directory ${directory_path}`);
    }
  } finally { sql.close(); }
});

test('public directories require nonempty published intro or published descendants', async () => {
  const { sql, locals, node, input } = fixture();
  try {
    node('visibility');
    node('visibility/notes', 'visibility');
    const path = 'visibility/notes';
    const intro = await saveDocument(locals, { ...input, directory_path: path, body_markdown: '  \n\t' });
    const visible = async (expected) => {
      const tree = await getLearnTree(locals);
      assert.equal(tree.byPath.has(path), expected);
      assert.equal(tree.byPath.has('visibility'), expected);
      assert.ok((await getLearnTree(locals, { includeUnpublished: true, includeEmpty: true })).byPath.has(path));
      assert.ok((await listLearnDirectories(locals)).some((entry) => entry.path === path));
    };
    await visible(false);
    for (const status of ['draft', 'archived', 'published']) {
      await saveDocument(locals, { ...input, id: intro.id, directory_path: path, status, body_markdown: 'Directory introduction' });
      await visible(status === 'published');
    }
    await saveDocument(locals, { ...input, id: intro.id, directory_path: path, status: 'draft' });
    const child = await saveDocument(locals, { ...input, parent_path: path, status: 'draft' });
    await visible(false);
    for (const status of ['published', 'archived', 'published', 'draft']) {
      await saveDocument(locals, { ...input, id: child.id, parent_path: path, status });
      await visible(status === 'published');
      assert.equal((await getLearnTree(locals)).byPath.has(child.path), status === 'published');
    }
    assert.equal(await getDocument(locals, 'learn', child.path), null);
  } finally { sql.close(); }
});

test('database enforces node types and directory-only parents on insert and update', () => {
  const { sql, node } = fixture();
  try {
    sql.exec("INSERT INTO learn_nodes(path,label) VALUES('article','Article')");
    assert.equal(sql.prepare("SELECT node_type FROM learn_nodes WHERE path='article'").get().node_type, 'article');
    node('directory');
    node('directory/child', 'directory');
    const before = snapshot(sql);
    for (const query of [
      "INSERT INTO learn_nodes(path,parent_path,label,node_type) VALUES('article/child','article','Child','directory')",
      "INSERT INTO learn_nodes(path,parent_path,label,node_type) VALUES('self','self','Self','directory')",
      "INSERT INTO learn_nodes(path,label,node_type) VALUES('invalid','Invalid','folder')",
      "INSERT INTO learn_nodes(path,label,node_type) VALUES('null-type','Invalid',NULL)",
      "UPDATE learn_nodes SET parent_path='article' WHERE path='directory/child'",
      "UPDATE learn_nodes SET parent_path=path WHERE path='directory'",
      "UPDATE learn_nodes SET node_type='folder' WHERE path='article'",
      "UPDATE learn_nodes SET node_type='article' WHERE path='directory'"
    ]) {
      assert.throws(() => sql.exec(query), undefined, query);
      assert.deepEqual(snapshot(sql), before);
    }
  } finally { sql.close(); }
});

test('replace and upsert cannot bypass directory identity or self-parent guards', () => {
  const { sql, node } = fixture();
  try {
    node('directory');
    sql.exec("INSERT INTO documents(id,kind,path,title) VALUES('intro','learn','directory','Original intro'),('replacement','learn','replacement','Replacement intro')");
    sql.exec("UPDATE learn_nodes SET document_id='intro',label='Original label',sort_order=17 WHERE path='directory'");
    const before = snapshot(sql);
    const changes = sql.prepare('SELECT total_changes() AS n').get().n;
    // A leaf directory and valid replacement ID isolate the identity trigger from child/FK guards.
    for (const query of [
      "INSERT OR REPLACE INTO learn_nodes(path,label,node_type,document_id) VALUES('directory','Replaced','article','replacement')",
      "INSERT INTO learn_nodes(path,label,node_type,document_id) VALUES('directory','Upserted','article','replacement') ON CONFLICT(path) DO UPDATE SET document_id=excluded.document_id",
      "INSERT INTO learn_nodes(path,label,document_id) VALUES('directory','Default article','replacement') ON CONFLICT(path) DO UPDATE SET document_id=excluded.document_id"
    ]) {
      assert.throws(() => sql.exec(query), /Learn node types cannot be changed/, query);
      assert.deepEqual(snapshot(sql), before, query);
      assert.equal(sql.prepare('SELECT total_changes() AS n').get().n, changes, query);
    }
    for (const query of [
      "INSERT INTO learn_nodes(path,parent_path,label,node_type) VALUES('self','self','Self','directory')",
      "INSERT OR REPLACE INTO learn_nodes(path,parent_path,label,node_type,document_id) VALUES('directory','directory','Self','directory','replacement')",
      "INSERT INTO learn_nodes(path,parent_path,label,node_type,document_id) VALUES('directory','directory','Self','directory','replacement') ON CONFLICT(path) DO UPDATE SET document_id=excluded.document_id"
    ]) {
      assert.throws(() => sql.exec(query), /Learn parent must be an existing directory/, query);
      assert.deepEqual(snapshot(sql), before, query);
      assert.equal(sql.prepare('SELECT total_changes() AS n').get().n, changes, query);
    }
  } finally { sql.close(); }
});

test('0003 classifies legacy index sources and parents without changing IDs, URLs or content', () => {
  const sql = new DatabaseSync(':memory:');
  try {
    migrate(sql, migrations.slice(0, 2));
    sql.exec(readFileSync(new URL('./fixtures/learn-node-types.sql', import.meta.url), 'utf8'));
    const documents = sql.prepare('SELECT * FROM documents ORDER BY id').all();
    const nodes = sql.prepare('SELECT * FROM learn_nodes ORDER BY path').all();
    const redirects = sql.prepare('SELECT * FROM redirects').all();
    migrate(sql, migrations.slice(2));
    assert.deepEqual(sql.prepare('SELECT * FROM documents ORDER BY id').all(), documents);
    assert.deepEqual(sql.prepare('SELECT * FROM redirects').all(), redirects);
    for (const old of nodes) {
      const migrated = sql.prepare('SELECT * FROM learn_nodes WHERE path=?').get(old.path);
      const { node_type, ...rest } = migrated;
      assert.deepEqual(rest, { ...old });
      assert.equal(node_type, ['notes', 'notes/index-md', 'notes/index-mdx', 'notes/windows-index', 'notes/parent', 'notes/empty'].includes(old.path) ? 'directory' : 'article', old.path);
      const document = documents.find((entry) => entry.id === old.document_id);
      if (document) assert.equal(documentHref(document), `/learn/${old.path}/`);
    }
  } finally { sql.close(); }
});
