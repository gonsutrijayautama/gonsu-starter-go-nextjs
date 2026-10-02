-- Setiap query menyaring organization_id: tidak ada jalan membaca atau
-- mengubah catatan milik pemasangan lain, walau id-nya ditebak.

-- name: ListNotes :many
SELECT n.id, n.title, n.body, n.created_at, n.updated_at, u.name AS created_by_name
FROM notes n
JOIN application_users u ON u.organization_id = n.organization_id AND u.id = n.created_by
WHERE n.organization_id = @organization_id
ORDER BY n.created_at DESC, n.id DESC
LIMIT @max_rows;

-- name: GetNote :one
SELECT n.id, n.title, n.body, n.created_at, n.updated_at, u.name AS created_by_name
FROM notes n
JOIN application_users u ON u.organization_id = n.organization_id AND u.id = n.created_by
WHERE n.organization_id = @organization_id AND n.id = @id;

-- name: CreateNote :one
INSERT INTO notes (organization_id, title, body, created_by)
VALUES (@organization_id, @title, @body, @created_by)
RETURNING id;

-- name: UpdateNote :execrows
UPDATE notes SET title = @title, body = @body, updated_at = now()
WHERE organization_id = @organization_id AND id = @id;

-- name: DeleteNote :execrows
DELETE FROM notes WHERE organization_id = @organization_id AND id = @id;
