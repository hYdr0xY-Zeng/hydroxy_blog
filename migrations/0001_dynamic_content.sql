PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('learn', 'essay', 'profile')),
  path TEXT NOT NULL UNIQUE,
  source_path TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  mood TEXT,
  cover_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS documents_kind_status_published_at ON documents(kind, status, published_at DESC);

CREATE TABLE IF NOT EXISTS learn_nodes (
  path TEXT PRIMARY KEY,
  parent_path TEXT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 9999,
  document_id TEXT UNIQUE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS learn_nodes_parent_order ON learn_nodes(parent_path, sort_order, label);

CREATE TABLE IF NOT EXISTS tags (slug TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag_slug TEXT NOT NULL,
  PRIMARY KEY (document_id, tag_slug),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_slug) REFERENCES tags(slug) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS redirects (from_path TEXT PRIMARY KEY, to_path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS media_assets (key TEXT PRIMARY KEY, original_name TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS anime_entries (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, cn_title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', year INTEGER, score REAL,
  note TEXT NOT NULL DEFAULT '', cover_key TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'published' CHECK (visibility IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS anime_visibility_order ON anime_entries(visibility, sort_order DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS gallery_entries (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '', media_key TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'published' CHECK (visibility IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (media_key) REFERENCES media_assets(key)
);
CREATE INDEX IF NOT EXISTS gallery_visibility_order ON gallery_entries(visibility, sort_order DESC, created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(entity_id UNINDEXED, entity_kind UNINDEXED, path UNINDEXED, title, description, body, tags, tokenize = 'unicode61');