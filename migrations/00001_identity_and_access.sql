-- Pemasangan, pengguna, sesi, percobaan login, riwayat akses, dan idempotency
-- key: fondasi yang sama di setiap produk GONSU.
--
-- Produk tidak menyimpan sandi siapa pun. Yang dicatat di sini hanya siapa yang
-- BERHAK masuk ke pemasangan ini, dan sesi yang diterbitkan produk sesudah
-- orangnya terbukti lewat GONSU.
--
-- JANGAN mengubah berkas migrasi yang sudah pernah diterapkan di database mana
-- pun. Perubahan skema selalu berkas baru dengan nomor berikutnya.

-- +goose Up
-- +goose StatementBegin

-- Satu baris: organization pemasangan ini, dibuat sekali saat start pertama dan
-- tidak pernah berubah. Seluruh baris tenant-scoped merujuknya.
CREATE TABLE installation (
    singleton             boolean     PRIMARY KEY DEFAULT true CHECK (singleton),
    organization_id       uuid        NOT NULL,
    -- ID organization GONSU (GONSU_ORGANIZATION_ID, atau jawaban agent).
    -- Disimpan sebagai atribut, tidak menggantikan organization_id di atas.
    gonsu_organization_id text,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- Kuncinya external_subject (klaim `sub` GONSU), bukan email: email berubah,
-- `sub` tidak. Login pengembangan menulis ke kolom yang sama.
--
-- TIDAK ADA kolom password hash, dan tidak boleh ditambahkan.
CREATE TABLE application_users (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    organization_id   uuid        NOT NULL,
    external_subject  text        NOT NULL,
    email             text,
    name              text,
    -- Daftar yang sama dengan authz.Roles. Menambah role berarti migrasi baru
    -- yang mengganti constraint ini, bersama barisnya di authz.
    application_role  text        NOT NULL CHECK (application_role IN ('administrator', 'staff', 'viewer')),
    status            text        NOT NULL DEFAULT 'ACTIVE'
                                  CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    last_login_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, external_subject),
    -- Target foreign key komposit: tabel lain merujuk (organization_id, id)
    -- sehingga rujukan lintas tenant ditolak database, bukan hanya kode.
    UNIQUE (organization_id, id)
);

-- Sesi milik produk. Token GONSU tidak divalidasi pada setiap request; yang
-- diperiksa sesi ini, sehingga produk tetap berjalan saat GONSU sesaat tidak
-- terjangkau. Sesi GONSU membawa bahan pemeriksaan ulang pencabutan: refresh
-- token dan kapan GONSU terakhir mengonfirmasi orangnya.
--
-- Token mentah hanya ada di cookie; yang disimpan hash-nya.
CREATE TABLE sessions (
    id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
    organization_id     uuid        NOT NULL,
    application_user_id uuid        NOT NULL,
    token_hash          bytea       NOT NULL UNIQUE,
    auth_kind           text        NOT NULL CHECK (auth_kind IN ('DEV', 'GONSU')),
    refresh_token       text,
    id_token            text,
    last_checked_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    CONSTRAINT sessions_gonsu_checked CHECK (auth_kind <> 'GONSU' OR last_checked_at IS NOT NULL),
    FOREIGN KEY (organization_id, application_user_id)
        REFERENCES application_users (organization_id, id)
);

CREATE INDEX sessions_user_idx ON sessions (organization_id, application_user_id);

-- Login yang sedang berjalan: state, nonce, dan verifier PKCE disimpan di
-- server (PendingStore kit web). Cookie hanya membawa kunci acaknya; baris
-- dihapus saat dipakai, sehingga balikan yang sama tidak dapat diputar ulang.
CREATE TABLE login_attempts (
    token_hash bytea       PRIMARY KEY,
    state      text        NOT NULL,
    nonce      text        NOT NULL,
    verifier   text        NOT NULL,
    return_to  text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX login_attempts_expires_idx ON login_attempts (expires_at);

-- Riwayat pemberian akses login. Append-only: siapa diberi akses, role-nya
-- diubah, dinonaktifkan, atau diaktifkan kembali — oleh siapa, lewat jalan
-- apa, dan kapan.
CREATE TABLE user_access_events (
    id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
    organization_id     uuid        NOT NULL,
    application_user_id uuid        NOT NULL,
    action              text        NOT NULL CHECK (action IN (
                            'GRANTED', 'ROLE_CHANGED', 'SUSPENDED', 'REACTIVATED')),
    role_before         text,
    role_after          text,
    -- Jalan pemberian akses: layar Pengguna & Akses, perintah operator, atau
    -- pemilik pemasangan saat login pertama.
    source              text        NOT NULL CHECK (source IN ('SCREEN', 'CLI', 'OWNER_BOOTSTRAP')),
    -- Kosong untuk perintah operator dan bootstrap pemilik. Nama disimpan saat
    -- tindakan dilakukan.
    actor_user_id       uuid,
    actor_name          text        NOT NULL,
    occurred_at         timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, application_user_id) REFERENCES application_users (organization_id, id),
    FOREIGN KEY (organization_id, actor_user_id) REFERENCES application_users (organization_id, id)
);

CREATE INDEX user_access_events_user_idx
    ON user_access_events (organization_id, application_user_id, occurred_at);

-- Idempotency key untuk mutasi HTTP: scope per organization dan endpoint,
-- sidik jari request, dan response yang diputar ulang byte per byte.
CREATE TABLE idempotency_keys (
    organization_id     uuid        NOT NULL,
    endpoint            text        NOT NULL,
    idempotency_key     text        NOT NULL,
    -- Key sama dengan body berbeda adalah kesalahan client, bukan pengulangan.
    request_fingerprint text        NOT NULL,
    response_status     integer,
    -- bytea, bukan jsonb: jsonb menormalisasi JSON, sehingga response yang
    -- diputar ulang tidak lagi identik dengan yang pertama.
    response_body       bytea,
    created_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    PRIMARY KEY (organization_id, endpoint, idempotency_key)
);

CREATE INDEX idempotency_keys_expires_idx ON idempotency_keys (expires_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE idempotency_keys;
DROP TABLE user_access_events;
DROP TABLE login_attempts;
DROP TABLE sessions;
DROP TABLE application_users;
DROP TABLE installation;
-- +goose StatementEnd
