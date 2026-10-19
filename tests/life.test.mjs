import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

async function bundle(entryPoint, options = {}) {
  const result = await build({ entryPoints: [entryPoint], bundle: true, platform: 'node', format: 'esm', write: false, ...options });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
const cms = await bundle('src/lib/cms.ts');
const kinds = { anime: { table: 'anime_entries', list: cms.listAnime }, gallery: { table: 'gallery_entries', list: cms.listGallery } };

function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    sql.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  const calls = { r2: [], batches: 0, failBatchAt: -1 };
  const database = {
    prepare(query) {
      const statement = sql.prepare(query);
      let values = [];
      const result = {
        bind(...input) { values = input; return result; },
        async first(column) { const row = statement.get(...values); return column ? row?.[column] ?? null : row ?? null; },
        async all() { return { success: true, results: statement.all(...values) }; },
        async run() { const info = statement.run(...values); return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } }; }
      };
      return result;
    },
    async batch(statements) {
      calls.batches++;
      calls.beforeBatch?.();
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const [index, statement] of statements.entries()) {
          if (index === calls.failBatchAt) throw new Error('Injected D1 batch failure');
          results.push(await statement.all());
        }
        sql.exec('COMMIT');
        return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  const media = new Proxy({}, { get(_, method) { return (...args) => { calls.r2.push([method, args]); throw new Error('Life deletion must not call R2'); }; } });
  const locals = { runtime: { env: { HYDROXY_DB: database, HYDROXY_MEDIA: media } } };
  sql.prepare('INSERT INTO media_assets(key,original_name,content_type,byte_size,sha256) VALUES(?,?,?,?,?)').run('shared.png', 'shared.png', 'image/png', 10, 'shared-hash');
  function insert(kind, id, fields = {}) {
    const entry = kind === 'anime'
      ? { id, title: `Title ${id}`, cn_title: '', status: 'watching', year: 2026, score: 8, note: '', cover_key: 'shared.png', sort_order: 0, visibility: 'published', ...fields }
      : { id, title: `Title ${id}`, alt: '', media_key: 'shared.png', sort_order: 0, visibility: 'published', ...fields };
    const columns = Object.keys(entry);
    sql.prepare(`INSERT INTO ${kinds[kind].table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(entry));
    return entry;
  }
  function index(kind, id) {
    sql.prepare('INSERT INTO search_index(entity_kind,entity_id,path,title,description,body,tags) VALUES(?,?,?,?,?,?,?)').run(kind, id, `/life/${kind}/`, 'Deletionneedle', '', 'Deletionneedle', '');
  }
  const snapshot = () => Object.fromEntries(['anime_entries', 'gallery_entries', 'media_assets', 'search_index'].map((table) => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  return { sql, locals, database, calls, insert, index, snapshot };
}

for (const [kind, { table, list }] of Object.entries(kinds)) {
  test(`${kind}: admin pagination reaches every record beyond the old first-100 cutoff`, async (t) => {
    const { locals, insert } = fixture(t);
    for (let i = 0; i < 137; i++) insert(kind, `entry-${i}`, { sort_order: i, visibility: ['draft', 'published', 'archived'][i % 3] });
    const first = await list(locals, 1, 100, true);
    const second = await list(locals, 2, 100, true);
    assert.deepEqual([first.totalItems, first.totalPages, first.currentPage, first.items.length], [137, 2, 1, 100]);
    assert.deepEqual([second.totalItems, second.totalPages, second.currentPage, second.items.length], [137, 2, 2, 37]);
    assert.equal(first.items[0].id, 'entry-136');
    assert.equal(second.items.at(-1).id, 'entry-0');
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 137);
    assert.deepEqual(new Set([...first.items, ...second.items].map((item) => item.visibility)), new Set(['draft', 'published', 'archived']));
    for (const page of [-10, 0, 1.9, NaN, Infinity]) assert.deepEqual(await list(locals, page, 100, true), first);
    assert.deepEqual(await list(locals, 9999, 100, true), second);
    const publicPage = await list(locals, 1, 100);
    assert.equal(publicPage.totalItems, 46);
    assert.ok(publicPage.items.every((item) => item.visibility === 'published'));
    assert.equal((await list(locals, 1, 100, true, '   ')).totalItems, 137);
    assert.equal((await list(locals, 1, 1000, true)).items.length, 100);
  });

  test(`${kind}: empty and filtered-empty pages stay clamped to page one`, async (t) => {
    const { locals, insert } = fixture(t);
    assert.deepEqual(await list(locals, 99, 10, true), { items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
    insert(kind, 'hidden', { visibility: 'draft' });
    assert.deepEqual(await list(locals, 99, 10), { items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
    assert.deepEqual(await list(locals, 99, 10, true, 'absent'), { items: [], totalItems: 0, totalPages: 1, currentPage: 1 });
  });

  test(`${kind}: search covers each supported field and keeps admin/public visibility separate`, async (t) => {
    const { locals, insert } = fixture(t);
    const fields = kind === 'anime' ? ['title', 'cn_title', 'note'] : ['title', 'alt'];
    for (const [i, field] of fields.entries()) insert(kind, `match-${field}`, { [field]: `prefix Needle suffix`, visibility: ['draft', 'archived', 'published'][i] });
    insert(kind, 'published', { title: 'Needle public', visibility: 'published' });
    insert(kind, 'unrelated');
    const all = await list(locals, 1, 100, true, 'Needle');
    assert.deepEqual(new Set(all.items.map((item) => item.id)), new Set([...fields.map((field) => `match-${field}`), 'published']));
    assert.equal(all.totalItems, fields.length + 1);
    const visible = await list(locals, 1, 100, false, 'Needle');
    assert.ok(visible.items.every((item) => item.visibility === 'published'));
    assert.equal(visible.totalItems, kind === 'anime' ? 2 : 1);
    const last = await list(locals, 999, 1, true, 'Needle');
    assert.equal(last.currentPage, fields.length + 1);
    assert.equal(last.totalPages, fields.length + 1);
    assert.equal(last.items.length, 1);
    assert.equal((await list(locals, 1, 100, true, '')).totalItems, fields.length + 2);
  });

  for (const literal of ['%', '_', '\\', "' OR 1=1 --", '%_\\']) {
    test(`${kind}: LIKE query ${JSON.stringify(literal)} is literal, not SQL or a wildcard`, async (t) => {
      const { locals, insert } = fixture(t);
      const fields = kind === 'anime' ? ['title', 'cn_title', 'note'] : ['title', 'alt'];
      for (const field of fields) insert(kind, `literal-${field}`, { [field]: `before${literal}after` });
      insert(kind, 'decoy', { title: 'beforeXYZafter', ...(kind === 'anime' ? { cn_title: 'beforeXafter', note: 'beforeafter' } : { alt: 'beforeafter' }) });
      const result = await list(locals, 1, 100, true, literal);
      assert.equal(result.totalItems, fields.length);
      assert.deepEqual(new Set(result.items.map((item) => item.id)), new Set(fields.map((field) => `literal-${field}`)));
    });
  }

  test(`${kind}: wrong or missing confirmation and missing row reject without any changes`, async (t) => {
    const f = fixture(t);
    const entry = f.insert(kind, 'protected', kind === 'anime' ? { cn_title: '\u4e2d\u6587\u6807\u9898' } : {});
    f.index(kind, entry.id);
    const before = f.snapshot();
    for (const confirmation of [undefined, null, '', 123, 'wrong', ` ${kind === 'anime' ? entry.cn_title : entry.title} `, ...(kind === 'anime' ? [entry.title] : [])]) {
      await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, entry.id, confirmation), (error) => error.status === 400);
      assert.deepEqual(f.snapshot(), before);
    }
    await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, 'missing', 'wrong'), (error) => error.status === 404);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.calls.batches, 0);
    assert.deepEqual(f.calls.r2, []);
  });

  for (const visibility of ['published', 'draft', 'archived']) {
    test(`${kind}: ${visibility} delete removes exactly its row and kind/id FTS entries, never media`, async (t) => {
      const f = fixture(t);
      const other = kind === 'anime' ? 'gallery' : 'anime';
      const entry = f.insert(kind, 'shared-id', { visibility, ...(kind === 'anime' ? { cn_title: '\u786e\u8ba4\u6807\u9898' } : {}) });
      f.insert(kind, 'keep');
      f.insert(other, 'shared-id');
      f.index(kind, 'shared-id');
      f.index(kind, 'shared-id');
      f.index(other, 'shared-id');
      f.index('essay', 'shared-id');
      f.index(kind, 'keep');
      const before = f.snapshot();
      await cms.deleteLifeEntry(f.locals, kind, entry.id, kind === 'anime' ? entry.cn_title : entry.title);
      const after = f.snapshot();
      assert.deepEqual(after[table], before[table].filter((row) => row.id !== entry.id));
      assert.deepEqual(after[kinds[other].table], before[kinds[other].table]);
      assert.deepEqual(after.search_index, before.search_index.filter((row) => !(row.entity_kind === kind && row.entity_id === entry.id)));
      assert.deepEqual(after.media_assets, before.media_assets);
      assert.equal(f.calls.batches, 1, 'row and FTS removal must share a D1 batch');
      assert.deepEqual(f.calls.r2, []);
      const search = await cms.searchContent(f.locals, 'Deletionneedle');
      assert.ok(!search.some((row) => row.entity_kind === kind && row.entity_id === entry.id));
      assert.equal(search.length, 3);
      await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, entry.id, kind === 'anime' ? entry.cn_title : entry.title), (error) => error.status === 404);
      assert.deepEqual(f.snapshot(), after);
    });
  }

  test(`${kind}: a failed second batch statement rolls back both row and FTS deletion`, async (t) => {
    const f = fixture(t);
    const entry = f.insert(kind, 'rollback');
    f.index(kind, entry.id);
    const before = f.snapshot();
    f.calls.failBatchAt = 1;
    await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, entry.id, entry.title), /Injected D1 batch failure/);
    assert.equal(f.calls.batches, 1);
    assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(f.calls.r2, []);
  });

  test(`${kind}: concurrent display-title rename rejects with 409 and preserves the row and FTS`, async (t) => {
    const f = fixture(t);
    const entry = f.insert(kind, 'renamed', kind === 'anime' ? { cn_title: 'Chinese display title' } : {});
    f.index(kind, entry.id);
    const before = f.snapshot();
    const column = kind === 'anime' ? 'cn_title' : 'title';
    f.calls.beforeBatch = () => f.sql.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run('Concurrent title', entry.id);
    await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, entry.id, kind === 'anime' ? entry.cn_title : entry.title), (error) => error.status === 409);
    assert.equal(f.sql.prepare(`SELECT ${column} label FROM ${table} WHERE id = ?`).get(entry.id).label, 'Concurrent title');
    const after = f.snapshot();
    assert.deepEqual(after.search_index, before.search_index);
    assert.deepEqual(after.media_assets, before.media_assets);
    assert.equal(after[table].length, 1);
    assert.deepEqual(f.calls.r2, []);
  });
}

test('anime: empty Chinese title falls back to the original title for confirmation', async (t) => {
  const f = fixture(t);
  const entry = f.insert('anime', 'fallback', { cn_title: '' });
  await cms.deleteLifeEntry(f.locals, 'anime', entry.id, entry.title);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM anime_entries').get().n, 0);
  assert.deepEqual(f.calls.r2, []);
});

// Only JWKS transport is local: production requireAdmin, JWT signature/audience/expiry,
// the allowlist, origin validation and CMS remain real code in the bundled handlers.
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'life-tests', alg: 'RS256', use: 'sig' };
const localJwks = {
  name: 'local-access-jwks',
  setup(builder) {
    builder.onResolve({ filter: /^jose$/ }, () => ({ path: 'local-jwks', namespace: 'life-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'life-test' }, () => ({
      contents: `import { createLocalJWKSet, jwtVerify } from ${JSON.stringify(fileURLToPath(import.meta.resolve('jose')))};
        export { jwtVerify };
        export const createRemoteJWKSet = () => createLocalJWKSet(${JSON.stringify({ keys: [jwk] })});`,
      resolveDir: process.cwd()
    }));
  }
};
const handlers = {};
for (const kind of Object.keys(kinds)) handlers[kind] = await bundle(`src/pages/api/admin/${kind}/[id].ts`, { plugins: [localJwks] });
async function token({ email = 'admin@example.test', aud = 'life-test-audience', expired = false, key = privateKey } = {}) {
  return new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setAudience(aud).setIssuedAt().setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 60 : '5m').sign(key);
}

for (const kind of Object.keys(kinds)) {
  test(`${kind} DELETE endpoint enforces real Access JWT validation and same origin before writes`, async (t) => {
    const f = fixture(t);
    const entry = f.insert(kind, 'endpoint');
    f.index(kind, entry.id);
    Object.assign(f.locals.runtime.env, { CF_ACCESS_TEAM_DOMAIN: 'life-tests.cloudflareaccess.com', CF_ACCESS_AUD: 'life-test-audience', ADMIN_EMAILS: 'admin@example.test' });
    const before = f.snapshot();
    const valid = await token();
    const wrongKey = (await generateKeyPair('RS256')).privateKey;
    const invoke = ({ jwt = valid, origin = 'https://wiki.example.test', body = JSON.stringify({ confirmation: entry.title }), id = entry.id } = {}) => {
      const headers = { 'Content-Type': 'application/json' };
      if (jwt !== null) headers['Cf-Access-Jwt-Assertion'] = jwt;
      if (origin !== null) headers.Origin = origin;
      return handlers[kind].DELETE({ locals: f.locals, params: { id }, request: new Request(`https://wiki.example.test/api/admin/${kind}/${id}`, { method: 'DELETE', headers, body }) });
    };
    for (const [jwt, expected] of [[null, 401], ['not-a-jwt', 401], [await token({ key: wrongKey }), 401], [await token({ aud: 'wrong' }), 401], [await token({ expired: true }), 401], [await token({ email: 'outsider@example.test' }), 403]]) {
      assert.equal((await invoke({ jwt })).status, expected);
      assert.deepEqual(f.snapshot(), before);
    }
    for (const origin of [null, 'https://evil.example.test', 'http://wiki.example.test']) {
      assert.equal((await invoke({ origin })).status, 403);
      assert.deepEqual(f.snapshot(), before);
    }
    const allowlist = f.locals.runtime.env.ADMIN_EMAILS;
    delete f.locals.runtime.env.ADMIN_EMAILS;
    assert.equal((await invoke()).status, 503);
    assert.deepEqual(f.snapshot(), before);
    f.locals.runtime.env.ADMIN_EMAILS = allowlist;
    for (const body of ['{', 'null', '{}', '{"confirmation":123}', '{"confirmation":"wrong"}']) {
      assert.equal((await invoke({ body })).status, 400);
      assert.deepEqual(f.snapshot(), before);
    }
    assert.equal((await invoke({ id: 'absent' })).status, 404);
    assert.deepEqual(f.snapshot(), before);
    const response = await invoke();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal((await invoke()).status, 404);
    assert.equal(f.calls.batches, 1);
    assert.deepEqual(f.calls.r2, []);
  });
}

test('deleteLifeEntry rejects unknown kinds at runtime without touching either collection', async (t) => {
  const f = fixture(t);
  f.insert('anime', 'same');
  f.insert('gallery', 'same');
  const before = f.snapshot();
  for (const kind of ['essay', 'ANIME', '', 'anime_entries', "gallery'; DROP TABLE anime_entries;--", undefined, null]) {
    await assert.rejects(() => cms.deleteLifeEntry(f.locals, kind, 'same', 'Title same'), (error) => error.status === 400);
    assert.deepEqual(f.snapshot(), before);
  }
  assert.equal(f.calls.batches, 0);
  assert.deepEqual(f.calls.r2, []);
});
