-- Everything Steady's reminder server keeps. No names, meds, moods or reminder text: just an
-- opaque install, its push address, and when each opaque reminder is due.

CREATE TABLE installs (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  touched_at INTEGER NOT NULL
);

CREATE TABLE reminders (
  install_id TEXT NOT NULL,
  rid TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (install_id, rid)
);

CREATE INDEX reminders_due ON reminders (due_at);

CREATE TABLE hits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
