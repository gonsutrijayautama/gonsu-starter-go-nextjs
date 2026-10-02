package storage

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// IsUniqueViolation melaporkan apakah err adalah pelanggaran constraint UNIQUE
// bernama constraint. Service memakainya untuk menjawab nilai yang sudah
// dipakai — nomor faktur, kode barang — dengan apperr.Conflict beserta
// field-nya, bukan 500.
//
// Constraint-nya diberi nama sendiri di migrasi
// (`CONSTRAINT invoices_number_unique UNIQUE (organization_id, number)`),
// supaya nama yang dicocokkan di sini tidak bergantung pada penamaan otomatis
// PostgreSQL.
func IsUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}
