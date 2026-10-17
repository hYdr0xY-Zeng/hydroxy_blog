import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createRequire } from 'node:module';
import { createContentArchive } from '../src/lib/content-export.ts';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('astro/package.json'))('js-yaml');

function matter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(markdown);
  assert.ok(match, 'Exported Markdown must have a complete frontmatter block');
  return { data: load(match[1]), content: match[2] };
}

function fixture() {
  const document = {
    kind: 'learn', description: 'Description: "quoted"\n---\nUnicode: \u7fa9',
    published_at: '2026-10-18T00:00:00.000Z', status: 'published',
    mood: null, cover_key: null,
    body_markdown: '# \u7b14\u8bb0\n\n```cpp\nint n = 42;\n```\n\n$$x^2$$\n\n![cover](/media/covers/intro.png)'
  };
  return {
    documents: [
      { ...document, id: 'intro', path: 'computer-science/notes', title: '\u76ee\u5f55: "Intro"\nstatus: forged', mood: '\u5e73\u9759', cover_key: 'covers/intro.png' },
      { ...document, id: 'article', path: 'computer-science/notes/article', title: 'Article', status: 'archived' },
      { ...document, id: 'legacy', path: 'computer-science/Old_Name', title: 'Legacy article', status: 'draft', published_at: null },
      { ...document, id: 'essay', kind: 'essay', path: '\u65e5\u8bb0', title: '\u65e5\u8bb0', status: 'archived' },
      { ...document, id: 'profile', kind: 'profile', path: 'home', title: 'Profile', body_markdown: '' }
    ],
    tags: [
      { document_id: 'intro', label: '\u9ad8\u6027\u80fd\u8ba1\u7b97' },
      { document_id: 'intro', label: 'true: "quoted"\n- not YAML' },
      { document_id: 'article', label: 'article-only' }
    ],
    learnTree: [
      { path: 'computer-science', parent_path: null, label: 'Computer Science', sort_order: 1, node_type: 'directory' },
      { path: 'computer-science/notes', parent_path: 'computer-science', label: '\u76ee\u5f55', sort_order: 7, node_type: 'directory', document_id: 'intro' },
      { path: 'computer-science/notes/article', parent_path: 'computer-science/notes', label: 'Article', sort_order: 3, node_type: 'article', document_id: 'article' },
      { path: 'computer-science/Old_Name', parent_path: 'computer-science', label: 'Legacy', sort_order: 9, node_type: 'article', document_id: 'legacy' },
      { path: 'empty', parent_path: null, label: 'Empty directory', sort_order: 99, node_type: 'directory' }
    ],
    anime: [{ id: 'anime', title: '\u52a8\u753b', cover_key: 'covers/intro.png', visibility: 'archived', sort_order: 2 }],
    gallery: [{ id: 'gallery', title: '\u56fe\u5e93', media_key: 'gallery/photo.webp', visibility: 'draft', sort_order: 4 }],
    media: [
      { key: 'covers/intro.png', original_name: '\u5c01\u9762.png', content_type: 'image/png', byte_size: 1024, sha256: 'a'.repeat(64), created_at: '2026-10-17 01:02:03' },
      { key: 'gallery/photo.webp', original_name: 'photo.webp', content_type: 'image/webp', byte_size: 2048, sha256: 'b'.repeat(64), created_at: '2026-10-17 01:02:04' }
    ]
  };
}

function unpack(snapshot) {
  const archive = createContentArchive(snapshot);
  assert.ok(archive instanceof Uint8Array);
  assert.deepEqual([...archive.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  return Object.fromEntries(Object.entries(unzipSync(archive)).map(([path, bytes]) => [path, strFromU8(bytes)]));
}

test('ZIP manifest preserves explicit node types, hierarchy, labels and order including empty directories', () => {
  const snapshot = fixture();
  const before = structuredClone(snapshot);
  const files = unpack(snapshot);
  assert.deepEqual(JSON.parse(files['data/learn-tree.json']), snapshot.learnTree.map((node) => ({
    path: node.path, parentPath: node.parent_path, label: node.label,
    sortOrder: node.sort_order, nodeType: node.node_type
  })));
  assert.deepEqual(snapshot, before, 'Export must not mutate its source snapshot');
});

test('directory introductions use path/index.md while articles retain path.md and legacy URLs', () => {
  const files = unpack(fixture());
  assert.deepEqual(Object.keys(files).sort(), [
    'learn/computer-science/notes/index.md',
    'learn/computer-science/notes/article.md',
    'learn/computer-science/Old_Name.md',
    'life/essays/\u65e5\u8bb0.md',
    'profile/home.md',
    'data/anime.json', 'data/gallery.json', 'data/learn-tree.json', 'media-manifest.json'
  ].sort());
  assert.equal(files['learn/computer-science/notes.md'], undefined);
  assert.equal(files['learn/computer-science/notes/article/index.md'], undefined);
  assert.equal(files['learn/empty/index.md'], undefined, 'Empty directories live in the manifest, not synthetic documents');
});

test('Markdown round-trips Unicode, frontmatter escaping, tags, body and archived status', () => {
  const snapshot = fixture();
  const files = unpack(snapshot);
  const paths = [
    'learn/computer-science/notes/index.md', 'learn/computer-science/notes/article.md',
    'learn/computer-science/Old_Name.md', 'life/essays/\u65e5\u8bb0.md', 'profile/home.md'
  ];
  snapshot.documents.forEach((document, index) => {
    const parsed = matter(files[paths[index]]);
    assert.deepEqual(parsed.data, {
      title: document.title, path: document.path, description: document.description,
      ...(document.published_at ? { date: document.published_at } : {}),
      status: document.status,
      tags: snapshot.tags.filter((tag) => tag.document_id === document.id).map((tag) => tag.label),
      draft: document.status !== 'published',
      ...(document.mood ? { mood: document.mood } : {}),
      ...(document.cover_key ? { cover: `/media/${document.cover_key}` } : {})
    });
    assert.equal(parsed.content, `\n${document.body_markdown}\n`);
  });
});

test('directory intro and index leaf both export without overwriting either document', () => {
  const snapshot = fixture();
  const intro = { ...snapshot.documents[0], path: 'notes', title: 'Directory intro', body_markdown: 'Introduction body' };
  const article = { ...snapshot.documents[1], path: 'notes/index', title: 'Index article', body_markdown: 'Distinct leaf body' };
  snapshot.documents = [intro, article];
  snapshot.learnTree = [
    { path: 'notes', parent_path: null, label: 'Notes', sort_order: 1, node_type: 'directory' },
    { path: 'notes/index', parent_path: 'notes', label: 'Index', sort_order: 2, node_type: 'article' }
  ];
  for (const documents of [[intro, article], [article, intro]]) {
    const files = unpack({ ...snapshot, documents });
    assert.deepEqual(Object.keys(files).filter((path) => path.endsWith('.md')).sort(), [
      'learn/notes/index.md', 'learn/notes/index/article.md'
    ]);
    for (const [path, document] of [['learn/notes/index.md', intro], ['learn/notes/index/article.md', article]]) {
      const parsed = matter(files[path]);
      assert.equal(parsed.data.path, document.path);
      assert.equal(parsed.data.title, document.title);
      assert.equal(parsed.data.status, document.status);
      assert.equal(parsed.content, `\n${document.body_markdown}\n`);
    }
    assert.deepEqual(JSON.parse(files['data/learn-tree.json']).map(({ path, nodeType }) => ({ path, nodeType })), [
      { path: 'notes', nodeType: 'directory' }, { path: 'notes/index', nodeType: 'article' }
    ]);
  }
});

test('duplicate output paths throw instead of silently discarding content', () => {
  const snapshot = fixture();
  snapshot.documents.push({ ...snapshot.documents[1], id: 'duplicate', body_markdown: 'Must not overwrite the first article' });
  const before = structuredClone(snapshot);
  assert.throws(() => createContentArchive(snapshot), /Duplicate content export path: learn\/computer-science\/notes\/article\.md/);
  assert.deepEqual(snapshot, before);
});

test('ZIP includes Life and media metadata but no analytics, visitor identifiers or image binaries', () => {
  const snapshot = fixture();
  const privateMarker = 'PRIVATE_VISITOR_HASH_DO_NOT_EXPORT';
  snapshot.document_daily_views = [{ document_id: 'intro', visitor_hash: privateMarker, viewed_on: '2026-10-18' }];
  snapshot.document_likes = [{ document_id: 'article', visitor_hash: privateMarker }];
  snapshot.documents[0].views = 123456789;
  snapshot.documents[0].likes = 987654321;
  snapshot.documents[0].visitor_hash = privateMarker;
  snapshot.image_binaries = { 'covers/intro.png': new Uint8Array([137, 80, 78, 71]) };
  const files = unpack(snapshot);
  assert.deepEqual(JSON.parse(files['data/anime.json']), snapshot.anime);
  assert.deepEqual(JSON.parse(files['data/gallery.json']), snapshot.gallery);
  assert.deepEqual(JSON.parse(files['media-manifest.json']), snapshot.media);
  assert.equal(Object.keys(files).length, 9, 'Archive must contain only content and metadata');
  for (const [path, content] of Object.entries(files)) {
    assert.ok(/\.(md|json)$/.test(path), path);
    assert.doesNotMatch(path, /analytics|document_daily_views|document_likes|\.(png|webp)$/);
    assert.ok(!content.includes(privateMarker), path);
  }
  const { data } = matter(files['learn/computer-science/notes/index.md']);
  for (const key of ['views', 'likes', 'visitor_hash']) assert.ok(!Object.hasOwn(data, key));
});

test('empty snapshots still export recoverable empty JSON manifests', () => {
  const files = unpack({ documents: [], tags: [], anime: [], gallery: [], media: [], learnTree: [] });
  assert.deepEqual(Object.keys(files).sort(), ['data/anime.json', 'data/gallery.json', 'data/learn-tree.json', 'media-manifest.json']);
  for (const content of Object.values(files)) assert.deepEqual(JSON.parse(content), []);
});
