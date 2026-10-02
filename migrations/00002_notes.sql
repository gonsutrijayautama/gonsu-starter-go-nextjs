-- Modul contoh Catatan: tabel tenant-scoped paling sederhana. Pola yang
-- ditunjukkannya berlaku untuk setiap tabel bisnis baru:
--
--   - organization_id wajib, dan setiap query menyaringnya;
--   - rujukan ke tabel lain lewat foreign key KOMPOSIT (organization_id, id),
--     sehingga rujukan lintas tenant ditolak database, bukan hanya kode.
--
-- Hapus modul contoh: buat migrasi baru yang DROP TABLE notes, bukan
-- menghapus berkas ini.

-- +goose Up
-- +goose StatementBegin
CREATE TABLE notes (
    id              uuid        PRIMARY KEY DEFAULT uuidv7(),
    organization_id uuid        NOT NULL,
    title           text        NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    body            text        NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
    created_by      uuid        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, created_by) REFERENCES application_users (organization_id, id)
);

CREATE INDEX notes_list_idx ON notes (organization_id, created_at DESC, id DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE notes;
-- +goose StatementEnd
