ALTER TABLE learn_nodes ADD COLUMN node_type TEXT NOT NULL DEFAULT 'article' CHECK (node_type IN ('directory', 'article'));

UPDATE learn_nodes SET node_type = 'directory'
WHERE document_id IS NULL
   OR EXISTS (SELECT 1 FROM learn_nodes child WHERE child.parent_path = learn_nodes.path)
   OR EXISTS (SELECT 1 FROM documents d WHERE d.id = learn_nodes.document_id
     AND (lower(replace(d.source_path, char(92), '/')) LIKE '%/index.md'
       OR lower(replace(d.source_path, char(92), '/')) LIKE '%/index.mdx'));

CREATE TRIGGER learn_parent_insert BEFORE INSERT ON learn_nodes
WHEN NEW.parent_path IS NOT NULL AND (NEW.parent_path = NEW.path OR NOT EXISTS (
  SELECT 1 FROM learn_nodes parent WHERE parent.path = NEW.parent_path AND parent.node_type = 'directory'
))
BEGIN SELECT RAISE(ABORT, 'Learn parent must be an existing directory.'); END;

CREATE TRIGGER learn_parent_update BEFORE UPDATE OF parent_path ON learn_nodes
WHEN NEW.parent_path IS NOT NULL AND (NEW.parent_path = NEW.path OR NOT EXISTS (
  SELECT 1 FROM learn_nodes parent WHERE parent.path = NEW.parent_path AND parent.node_type = 'directory'
))
BEGIN SELECT RAISE(ABORT, 'Learn parent must be an existing directory.'); END;

CREATE TRIGGER learn_directory_type_update BEFORE UPDATE OF node_type ON learn_nodes
WHEN OLD.node_type <> NEW.node_type
BEGIN SELECT RAISE(ABORT, 'Learn node types cannot be changed.'); END;

CREATE TRIGGER learn_node_identity_insert BEFORE INSERT ON learn_nodes
WHEN EXISTS (SELECT 1 FROM learn_nodes old WHERE old.path = NEW.path AND old.node_type <> NEW.node_type)
BEGIN SELECT RAISE(ABORT, 'Learn node types cannot be changed.'); END;

CREATE TRIGGER learn_directory_delete BEFORE DELETE ON learn_nodes
WHEN EXISTS (SELECT 1 FROM learn_nodes child WHERE child.parent_path = OLD.path)
BEGIN SELECT RAISE(ABORT, 'A directory with children cannot be deleted.'); END;

DELETE FROM search_index WHERE entity_id IN (
  SELECT d.id FROM documents d JOIN learn_nodes n ON n.document_id = d.id
  WHERE n.node_type = 'directory' AND trim(d.body_markdown, char(9) || char(10) || char(13) || ' ') = ''
);
