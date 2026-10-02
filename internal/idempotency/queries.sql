-- name: GetKey :one
SELECT request_fingerprint, response_status, response_body
FROM idempotency_keys
WHERE organization_id = @organization_id
  AND endpoint = @endpoint
  AND idempotency_key = @idempotency_key
  AND expires_at > now();

-- Mengembalikan baris hanya bila key baru diklaim — atau diklaim ulang karena
-- yang lama sudah kedaluwarsa. Tanpa baris berarti key yang sama masih hidup.
-- name: ClaimKey :one
INSERT INTO idempotency_keys (organization_id, endpoint, idempotency_key, request_fingerprint, expires_at)
VALUES (@organization_id, @endpoint, @idempotency_key, @request_fingerprint, @expires_at)
ON CONFLICT (organization_id, endpoint, idempotency_key) DO UPDATE
    SET request_fingerprint = EXCLUDED.request_fingerprint,
        response_status     = NULL,
        response_body       = NULL,
        created_at          = now(),
        expires_at          = EXCLUDED.expires_at
    WHERE idempotency_keys.expires_at <= now()
RETURNING idempotency_key;

-- name: CompleteKey :exec
UPDATE idempotency_keys
SET response_status = @response_status, response_body = @response_body
WHERE organization_id = @organization_id
  AND endpoint = @endpoint
  AND idempotency_key = @idempotency_key;
