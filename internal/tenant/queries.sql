-- Replica yang start bersamaan masing-masing membawa kandidat; yang pertama
-- menang dan semuanya membaca nilai yang sama.
-- name: ClaimInstallation :exec
INSERT INTO installation (organization_id, gonsu_organization_id)
VALUES (@organization_id, sqlc.narg('gonsu_organization_id'))
ON CONFLICT (singleton) DO NOTHING;

-- ID kanonik GONSU dicatat sekali; pemasangan tidak berpindah organization.
-- name: RecordGonsuOrganization :exec
UPDATE installation SET gonsu_organization_id = @gonsu_organization_id
WHERE gonsu_organization_id IS NULL;

-- name: Installation :one
SELECT organization_id, gonsu_organization_id FROM installation;
