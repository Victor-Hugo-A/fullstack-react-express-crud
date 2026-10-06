ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';

UPDATE users
SET role = CASE WHEN is_admin = 1 THEN 'admin' ELSE 'editor' END;
