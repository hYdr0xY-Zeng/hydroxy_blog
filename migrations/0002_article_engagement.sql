CREATE TABLE IF NOT EXISTS document_daily_views (
  document_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  viewed_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, visitor_hash, viewed_on),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_likes (
  document_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, visitor_hash),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
