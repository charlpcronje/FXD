-- @agent: agent-persistence
-- @timestamp: 2025-10-02
-- @version: 1.0.0
-- @description: SQLite schema for FXD persistence layer
-- Comprehensive database schema for FX Node storage, relationships, and metadata

-- =============================================================================
-- SCHEMA VERSION MANAGEMENT
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- Insert initial version
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (1, 'Initial FXD persistence schema');

-- =============================================================================
-- PROJECT METADATA
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- NODES TABLE - Core FX Node Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  key_name TEXT,
  node_type TEXT NOT NULL DEFAULT 'raw',
  value_json TEXT,
  prototypes_json TEXT,
  meta_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT,
  is_dirty BOOLEAN DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- =============================================================================
-- EDGES TABLE - Node Relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS edges (
  parent_id TEXT NOT NULL,
  child_key TEXT NOT NULL,
  child_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_id, child_key),
  FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- =============================================================================
-- SNIPPETS TABLE - Code Snippet Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  snippet_id TEXT NOT NULL,
  body TEXT NOT NULL,
  lang TEXT DEFAULT 'js',
  file_path TEXT,
  order_index INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  checksum TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_dirty BOOLEAN DEFAULT 0,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(snippet_id)
);

-- =============================================================================
-- VIEWS TABLE - View Definitions and Group Configurations
-- =============================================================================

CREATE TABLE IF NOT EXISTS views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  anchor_node_id TEXT,
  selectors_json TEXT,
  render_options_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_dirty BOOLEAN DEFAULT 0,
  FOREIGN KEY (anchor_node_id) REFERENCES nodes(id) ON DELETE SET NULL
);

-- =============================================================================
-- VIEW COMPONENTS - Links between views and snippets
-- =============================================================================

CREATE TABLE IF NOT EXISTS view_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  view_id TEXT NOT NULL,
  snippet_id TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE CASCADE,
  FOREIGN KEY (snippet_id) REFERENCES snippets(snippet_id) ON DELETE CASCADE
);

-- =============================================================================
-- TRANSACTION LOG - Append-only mutation log for replay
-- =============================================================================

CREATE TABLE IF NOT EXISTS transaction_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  node_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  field TEXT,
  old_value_json TEXT,
  new_value_json TEXT,
  checksum TEXT
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Node indexes
CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_checksum ON nodes(checksum);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_dirty ON nodes(is_dirty);

-- Edge indexes
CREATE INDEX IF NOT EXISTS idx_edges_parent ON edges(parent_id);
CREATE INDEX IF NOT EXISTS idx_edges_child ON edges(child_id);

-- Snippet indexes
CREATE INDEX IF NOT EXISTS idx_snippets_node_id ON snippets(node_id);
CREATE INDEX IF NOT EXISTS idx_snippets_checksum ON snippets(checksum);
CREATE INDEX IF NOT EXISTS idx_snippets_modified ON snippets(modified_at);
CREATE INDEX IF NOT EXISTS idx_snippets_dirty ON snippets(is_dirty);

-- View indexes
CREATE INDEX IF NOT EXISTS idx_views_anchor ON views(anchor_node_id);
CREATE INDEX IF NOT EXISTS idx_views_modified ON views(modified_at);
CREATE INDEX IF NOT EXISTS idx_views_dirty ON views(is_dirty);

-- View component indexes
CREATE INDEX IF NOT EXISTS idx_view_components_view ON view_components(view_id);
CREATE INDEX IF NOT EXISTS idx_view_components_snippet ON view_components(snippet_id);

-- Transaction log indexes
CREATE INDEX IF NOT EXISTS idx_transaction_log_node ON transaction_log(node_id);
CREATE INDEX IF NOT EXISTS idx_transaction_log_timestamp ON transaction_log(timestamp);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS update_nodes_modified_at
  AFTER UPDATE ON nodes
  BEGIN
    UPDATE nodes SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_snippets_modified_at
  AFTER UPDATE ON snippets
  BEGIN
    UPDATE snippets SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_views_modified_at
  AFTER UPDATE ON views
  BEGIN
    UPDATE views SET modified_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_project_metadata_modified_at
  AFTER UPDATE ON project_metadata
  BEGIN
    UPDATE project_metadata SET modified_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
  END;

-- =============================================================================
-- TRIGGERS FOR TRANSACTION LOGGING
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS log_node_insert
  AFTER INSERT ON nodes
  BEGIN
    INSERT INTO transaction_log (node_id, operation, new_value_json, checksum)
    VALUES (NEW.id, 'create', json_object(
      'id', NEW.id,
      'parent_id', NEW.parent_id,
      'key_name', NEW.key_name,
      'node_type', NEW.node_type,
      'value_json', NEW.value_json,
      'prototypes_json', NEW.prototypes_json,
      'meta_json', NEW.meta_json
    ), NEW.checksum);
  END;

CREATE TRIGGER IF NOT EXISTS log_node_update
  AFTER UPDATE ON nodes
  WHEN OLD.value_json != NEW.value_json OR OLD.prototypes_json != NEW.prototypes_json OR OLD.meta_json != NEW.meta_json
  BEGIN
    INSERT INTO transaction_log (node_id, operation, old_value_json, new_value_json, checksum)
    VALUES (NEW.id, 'update', json_object(
      'value_json', OLD.value_json,
      'prototypes_json', OLD.prototypes_json,
      'meta_json', OLD.meta_json
    ), json_object(
      'value_json', NEW.value_json,
      'prototypes_json', NEW.prototypes_json,
      'meta_json', NEW.meta_json
    ), NEW.checksum);
  END;

CREATE TRIGGER IF NOT EXISTS log_node_delete
  BEFORE DELETE ON nodes
  BEGIN
    INSERT INTO transaction_log (node_id, operation, old_value_json)
    VALUES (OLD.id, 'delete', json_object(
      'id', OLD.id,
      'parent_id', OLD.parent_id,
      'key_name', OLD.key_name,
      'node_type', OLD.node_type,
      'value_json', OLD.value_json,
      'prototypes_json', OLD.prototypes_json,
      'meta_json', OLD.meta_json
    ));
  END;

-- =============================================================================
-- INITIAL PROJECT METADATA
-- =============================================================================

INSERT OR IGNORE INTO project_metadata (key, value) VALUES
  ('fxd_version', '1.0.0'),
  ('schema_version', '1'),
  ('created_at', datetime('now')),
  ('default_language', 'js');
