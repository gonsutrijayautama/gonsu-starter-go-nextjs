// Package notes adalah MODUL CONTOH: catatan sederhana milik satu pemasangan.
//
// Ia ada untuk menunjukkan pola yang dipakai setiap modul bisnis, lalu dihapus
// ketika modul pertama produk ditulis:
//
//   - service memeriksa IZIN lebih dulu (`authn.Check`), bukan menyembunyikan
//     tombol di UI;
//   - organization_id hanya datang dari `tenant.OrganizationID(ctx)`, tidak
//     pernah dari request;
//   - setiap query menyaring organization_id, dan catatan milik pemasangan
//     lain dijawab "tidak ditemukan" — bukan "ditolak", yang membocorkan
//     bahwa ia ada;
//   - pembuatan data idempotent: klien yang mengulang permintaan (timeout,
//     tombol ditekan dua kali) tidak membuat catatan ganda;
//   - validasi bentuk di sini, dengan pesan per field yang dapat ditampilkan.
//
// Route-nya dipasang di balik `entitlement.Guard(Core)` (cmd/api/routes.go):
// lisensi yang tidak aktif menolak mutasi, dan paket tanpa hak pakai utama
// menolak seluruhnya.
package notes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/idempotency"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/notes/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
)

// Service mengelola catatan.
type Service struct {
	pool *pgxpool.Pool
}

// NewService mengembalikan service catatan.
func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

// Note adalah satu catatan di API.
type Note struct {
	ID            uuid.UUID `json:"id"`
	Title         string    `json:"title"`
	Body          string    `json:"body"`
	CreatedByName string    `json:"created_by_name"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Request adalah body POST /v1/notes dan PUT /v1/notes/{id}.
type Request struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// Batas isi, sama dengan constraint kolomnya.
const (
	maxTitle = 200
	maxBody  = 10000
)

func (r *Request) normalize() []apperr.FieldError {
	r.Title = strings.TrimSpace(r.Title)
	var errs []apperr.FieldError
	switch n := utf8.RuneCountInString(r.Title); {
	case n == 0:
		errs = append(errs, apperr.FieldError{Field: "title", Message: "Judul wajib diisi."})
	case n > maxTitle:
		errs = append(errs, apperr.FieldError{Field: "title", Message: fmt.Sprintf("Judul maksimal %d karakter.", maxTitle)})
	}
	if len(r.Body) > maxBody {
		errs = append(errs, apperr.FieldError{Field: "body", Message: fmt.Sprintf("Isi maksimal %d karakter.", maxBody)})
	}
	return errs
}

var errNotFound = apperr.NotFound("Catatan tidak ditemukan.")

// createEndpoint adalah scope idempotency key pembuatan catatan.
const createEndpoint = "POST /v1/notes"

// List mendaftar catatan terbaru.
func (s *Service) List(ctx context.Context, limit int) ([]Note, error) {
	if _, err := authn.Check(ctx, authz.NotesRead); err != nil {
		return nil, err
	}
	org, err := tenant.OrganizationID(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := store.New(s.pool).ListNotes(ctx, store.ListNotesParams{OrganizationID: org, MaxRows: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]Note, 0, len(rows))
	for _, r := range rows {
		out = append(out, Note{ID: r.ID, Title: r.Title, Body: r.Body, CreatedByName: deref(r.CreatedByName),
			CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt})
	}
	return out, nil
}

// Get membaca satu catatan.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (Note, error) {
	if _, err := authn.Check(ctx, authz.NotesRead); err != nil {
		return Note{}, err
	}
	org, err := tenant.OrganizationID(ctx)
	if err != nil {
		return Note{}, err
	}
	return get(ctx, store.New(s.pool), org, id)
}

func get(ctx context.Context, q *store.Queries, org, id uuid.UUID) (Note, error) {
	r, err := q.GetNote(ctx, store.GetNoteParams{OrganizationID: org, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return Note{}, errNotFound
	}
	if err != nil {
		return Note{}, err
	}
	return Note{ID: r.ID, Title: r.Title, Body: r.Body, CreatedByName: deref(r.CreatedByName),
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt}, nil
}

// Create membuat catatan. Permintaan dengan Idempotency-Key yang sama diputar
// ulang: jawabannya identik, dan catatan tidak dibuat dua kali.
func (s *Service) Create(ctx context.Context, req Request, key, fingerprint string) (idempotency.Response, error) {
	p, err := authn.Check(ctx, authz.NotesWrite)
	if err != nil {
		return idempotency.Response{}, err
	}
	org, err := tenant.OrganizationID(ctx)
	if err != nil {
		return idempotency.Response{}, err
	}
	if errs := req.normalize(); len(errs) > 0 {
		return idempotency.Response{}, apperr.Validation("Isian belum lengkap.", errs...)
	}

	scope := idempotency.Scope{OrganizationID: org, Endpoint: createEndpoint, Key: key, Fingerprint: fingerprint}
	if resp, err := idempotency.Replay(ctx, s.pool, scope); err != nil || resp != nil {
		if resp != nil {
			return *resp, nil
		}
		return idempotency.Response{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return idempotency.Response{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	// Key diklaim di transaksi yang sama dengan catatannya: tidak ada keadaan
	// "catatan sudah ada tetapi key belum tercatat" yang membuat retry
	// menggandakannya.
	claimed, err := idempotency.Claim(ctx, tx, scope)
	if err != nil {
		return idempotency.Response{}, fmt.Errorf("mengklaim idempotency key: %w", err)
	}
	if !claimed {
		if resp, err := idempotency.Replay(ctx, s.pool, scope); err == nil && resp != nil {
			return *resp, nil
		}
		return idempotency.Response{}, apperr.IdempotencyKeyConflict("Permintaan dengan kunci yang sama sedang diproses.")
	}

	q := store.New(tx)
	id, err := q.CreateNote(ctx, store.CreateNoteParams{
		OrganizationID: org, Title: req.Title, Body: req.Body, CreatedBy: p.UserID,
	})
	if err != nil {
		return idempotency.Response{}, fmt.Errorf("menyimpan catatan: %w", err)
	}
	note, err := get(ctx, q, org, id)
	if err != nil {
		return idempotency.Response{}, err
	}
	body, err := json.Marshal(note)
	if err != nil {
		return idempotency.Response{}, err
	}
	resp := idempotency.Response{Status: http.StatusCreated, Body: body}
	if err := idempotency.Complete(ctx, tx, scope, resp); err != nil {
		return idempotency.Response{}, err
	}
	return resp, tx.Commit(ctx)
}

// Update mengganti judul dan isi catatan.
func (s *Service) Update(ctx context.Context, id uuid.UUID, req Request) (Note, error) {
	if _, err := authn.Check(ctx, authz.NotesWrite); err != nil {
		return Note{}, err
	}
	org, err := tenant.OrganizationID(ctx)
	if err != nil {
		return Note{}, err
	}
	if errs := req.normalize(); len(errs) > 0 {
		return Note{}, apperr.Validation("Isian belum lengkap.", errs...)
	}
	q := store.New(s.pool)
	n, err := q.UpdateNote(ctx, store.UpdateNoteParams{OrganizationID: org, ID: id, Title: req.Title, Body: req.Body})
	if err != nil {
		return Note{}, err
	}
	if n == 0 {
		return Note{}, errNotFound
	}
	return get(ctx, q, org, id)
}

// Delete menghapus catatan.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	if _, err := authn.Check(ctx, authz.NotesWrite); err != nil {
		return err
	}
	org, err := tenant.OrganizationID(ctx)
	if err != nil {
		return err
	}
	n, err := store.New(s.pool).DeleteNote(ctx, store.DeleteNoteParams{OrganizationID: org, ID: id})
	if err != nil {
		return err
	}
	if n == 0 {
		return errNotFound
	}
	return nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
