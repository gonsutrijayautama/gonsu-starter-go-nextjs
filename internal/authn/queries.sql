-- name: CreateSession :exec
INSERT INTO sessions (
    organization_id, application_user_id, token_hash, expires_at,
    auth_kind, refresh_token, id_token, last_checked_at
) VALUES (
    @organization_id, @application_user_id, @token_hash, @expires_at,
    @auth_kind, sqlc.narg('refresh_token'), sqlc.narg('id_token'), sqlc.narg('last_checked_at')
);

-- Sesi hanya berlaku bila belum dicabut, belum kedaluwarsa, dan penggunanya
-- masih ACTIVE di application_users — pengguna yang di-suspend kehilangan
-- aksesnya pada permintaan berikutnya, bukan saat sesinya habis.
-- name: SessionPrincipal :one
SELECT s.id AS session_id, s.auth_kind, s.last_checked_at,
       u.id AS user_id, u.organization_id, u.name, u.email, u.application_role
FROM sessions s
JOIN application_users u
  ON u.organization_id = s.organization_id AND u.id = s.application_user_id
WHERE s.token_hash = @token_hash
  AND s.revoked_at IS NULL
  AND s.expires_at > now()
  AND u.status = 'ACTIVE';

-- Pemeriksaan ulang pencabutan dikunci per sesi: refresh token dapat dirotasi
-- pada setiap penukaran, dan dua request yang menukar token yang sama akan
-- membuat yang kedua ditolak walau orangnya masih berhak.
-- name: LockSessionForRecheck :one
SELECT refresh_token, last_checked_at
FROM sessions
WHERE id = @id AND revoked_at IS NULL
FOR UPDATE;

-- name: RecordRecheck :exec
UPDATE sessions
SET refresh_token = @refresh_token, last_checked_at = @last_checked_at
WHERE id = @id;

-- name: RevokeSession :exec
UPDATE sessions SET revoked_at = now() WHERE id = @id AND revoked_at IS NULL;

-- name: RevokeSessionByToken :one
UPDATE sessions SET revoked_at = now()
WHERE token_hash = @token_hash AND revoked_at IS NULL
RETURNING auth_kind, id_token;

-- name: RevokeUserSessions :exec
UPDATE sessions SET revoked_at = now()
WHERE organization_id = @organization_id AND application_user_id = @application_user_id
  AND revoked_at IS NULL;

-- name: CreateLoginAttempt :exec
INSERT INTO login_attempts (token_hash, state, nonce, verifier, return_to, expires_at)
VALUES (@token_hash, @state, @nonce, @verifier, sqlc.narg('return_to'), @expires_at);

-- Dihapus saat dipakai: balikan yang sama tidak dapat diputar ulang.
-- name: TakeLoginAttempt :one
DELETE FROM login_attempts
WHERE token_hash = @token_hash AND expires_at > now()
RETURNING state, nonce, verifier, return_to;

-- name: DeleteExpiredLoginAttempts :exec
DELETE FROM login_attempts WHERE expires_at <= now();

-- Diberi akses = ada baris ACTIVE dengan `sub` ini di pemasangan ini.
-- Kuncinya external_subject, tidak pernah email.
-- name: SubjectGranted :one
SELECT EXISTS (
    SELECT 1 FROM application_users
    WHERE organization_id = @organization_id AND external_subject = @external_subject
      AND status = 'ACTIVE'
);

-- Nama dan email mengikuti GONSU pada setiap login; yang kosong di token
-- tidak menghapus yang tersimpan.
-- name: RecordLogin :one
UPDATE application_users
SET last_login_at = now(), updated_at = now(),
    email = COALESCE(sqlc.narg('email'), email),
    name = COALESCE(sqlc.narg('name'), name)
WHERE organization_id = @organization_id AND external_subject = @external_subject
  AND status = 'ACTIVE'
RETURNING id;

-- name: FindActiveUser :one
SELECT id FROM application_users
WHERE organization_id = @organization_id AND external_subject = @external_subject
  AND status = 'ACTIVE';

-- Pemberian akses dari satu pemasangan tidak berjalan bersamaan: kuota
-- users.max dihitung lalu ditulis dalam transaksi yang sama.
-- name: LockUserGrants :exec
SELECT pg_advisory_xact_lock(hashtext('users.grant.' || @organization_id::text));

-- name: UserBySubject :one
SELECT id, status, application_role FROM application_users
WHERE organization_id = @organization_id AND external_subject = @external_subject;

-- name: UserByID :one
SELECT id, external_subject, status, application_role
FROM application_users
WHERE organization_id = @organization_id AND id = @id;

-- Administrator aktif selain satu pengguna: pemasangan tidak boleh
-- kehilangan administrator terakhirnya lewat layar.
-- name: CountOtherActiveAdmins :one
SELECT count(*) FROM application_users
WHERE organization_id = @organization_id AND id <> @id
  AND status = 'ACTIVE' AND application_role = 'administrator';

-- name: SetUserRole :exec
UPDATE application_users
SET application_role = @application_role, updated_at = now()
WHERE organization_id = @organization_id AND id = @id;

-- name: SetUserStatus :exec
UPDATE application_users SET status = @status, updated_at = now()
WHERE organization_id = @organization_id AND id = @id;

-- name: InsertAccessEvent :exec
INSERT INTO user_access_events (
    organization_id, application_user_id, action, role_before, role_after,
    source, actor_user_id, actor_name
) VALUES (
    @organization_id, @application_user_id, @action, sqlc.narg('role_before'), sqlc.narg('role_after'),
    @source, sqlc.narg('actor_user_id'), @actor_name
);

-- name: ListAccessEvents :many
SELECT action, role_before, role_after, source, actor_name, occurred_at
FROM user_access_events
WHERE organization_id = @organization_id AND application_user_id = @application_user_id
ORDER BY occurred_at, id;

-- name: CountActiveUsers :one
SELECT count(*) FROM application_users
WHERE organization_id = @organization_id AND status = 'ACTIVE';

-- name: UpsertUser :one
INSERT INTO application_users (organization_id, external_subject, email, name, application_role)
VALUES (@organization_id, @external_subject, sqlc.narg('email'), sqlc.narg('name'), @application_role)
ON CONFLICT (organization_id, external_subject) DO UPDATE
SET email = COALESCE(EXCLUDED.email, application_users.email),
    name = COALESCE(EXCLUDED.name, application_users.name),
    application_role = EXCLUDED.application_role,
    status = 'ACTIVE',
    updated_at = now()
RETURNING id;

-- name: SuspendUser :one
UPDATE application_users SET status = 'SUSPENDED', updated_at = now()
WHERE organization_id = @organization_id AND external_subject = @external_subject
RETURNING id;

-- name: ListUsers :many
SELECT id, external_subject, email, name, application_role, status,
       last_login_at, created_at
FROM application_users
WHERE organization_id = @organization_id
ORDER BY created_at, id;

-- Termasuk yang di-suspend: pemasangan yang pernah memberi akses kepada
-- siapa pun bukan lagi pemasangan kosong.
-- name: CountUsers :one
SELECT count(*) FROM application_users WHERE organization_id = @organization_id;
