-- Up
CREATE TABLE post_votes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    
    vote_value INTEGER NOT NULL CHECK(vote_value IN (1, -1, 0)),
    
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
    
    PRIMARY KEY (post_id, user_id)
);

CREATE TRIGGER trg_post_votes_updated_at
AFTER UPDATE ON post_votes
FOR EACH ROW
BEGIN
    UPDATE post_votes
    SET updated_at = (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    WHERE post_id = OLD.post_id AND user_id = OLD.user_id;
END;


CREATE TRIGGER trg_update_post_score
AFTER INSERT OR UPDATE OR DELETE ON post_votes
FOR EACH ROW
BEGIN
    UPDATE posts
    SET votes = (
        -- Recalculate the sum for the affected post
        SELECT SUM(vote_value)
        FROM post_votes
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
    )
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);
END;


CREATE INDEX idx_post_votes_post_id ON post_votes(post_id);

-- Down
DROP TRIGGER IF EXISTS trg_update_post_score;
DROP TRIGGER IF EXISTS trg_post_votes_updated_at;
DROP INDEX IF EXISTS idx_post_votes_post_id;
DROP TABLE IF EXISTS post_votes;