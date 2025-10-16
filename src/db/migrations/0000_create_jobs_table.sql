-- Up

CREATE TABLE queue_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE TRIGGER trg_queue_jobs_updated_at
AFTER UPDATE ON queue_jobs
FOR EACH ROW
BEGIN
    UPDATE queue_jobs
    SET updated_at = (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    WHERE id = OLD.id;
END;

CREATE INDEX idx_queue_jobs_status ON queue_jobs(status);

-- Down
DROP TRIGGER IF EXISTS trg_queue_jobs_updated_at;
DROP INDEX IF EXISTS idx_queue_jobs_status;
DROP TABLE IF EXISTS queue_jobs;

