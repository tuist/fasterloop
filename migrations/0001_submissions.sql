CREATE TABLE talk_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL, -- 'web' or 'mcp'
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  city TEXT
);

CREATE TABLE venue_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL, -- 'web' or 'mcp'
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  city TEXT NOT NULL,
  capacity INTEGER,
  notes TEXT
);
