-- Up
CREATE TABLE posts (
    
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- The Telegram user ID of the creator. This is now just an identifier with no foreign key constraint.
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    unique_file_id TEXT NOT NULL,
    download_url TEXT NOT NULL,
    tags TEXT,
    -- The total vote score. Can be positive or negative.
    votes INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),

    UNIQUE(name),
    UNIQUE(unique_file_id)
);

CREATE TRIGGER trg_posts_updated_at
AFTER UPDATE ON posts
FOR EACH ROW
BEGIN
    UPDATE posts
    SET updated_at = (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    WHERE id = OLD.id;
END;

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_votes ON posts(votes DESC);
CREATE INDEX idx_posts_download_count ON posts(download_count DESC);

-- Down
DROP TRIGGER IF EXISTS trg_posts_updated_at;

DROP INDEX IF EXISTS idx_posts_user_id;
DROP INDEX IF EXISTS idx_posts_votes;
DROP INDEX IF EXISTS idx_posts_download_count;

DROP TABLE IF EXISTS posts;