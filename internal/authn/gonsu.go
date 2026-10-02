package authn

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/auth"
	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
)

// Login GONSU dikerjakan kit web SDK GONSU: memulai login,
// memverifikasi seluruh bukti yang kembali — state, tanda tangan, penerbit,
// penerima, waktu, nonce, PKCE — dan membuka halaman akun GONSU. produk tidak
// menulis ulang satu pun. Yang tersisa di sini hanya pertanyaan yang hanya
// dapat dijawab produk: siapa yang diberi akses di pemasangan ini, siapa
// admin pertamanya, dan sesi produk seperti apa yang diterbitkan.

// gonsuSession adalah umur sesi produk dari login GONSU. Pencabutan tidak
// menunggunya: sesi diperiksa ulang ke GONSU secara berkala (Sessions).
const gonsuSession = 7 * 24 * time.Hour

// GonsuLogin adalah bagian login GONSU milik produk, dipasang ke kit lewat
// Hooks.
type GonsuLogin struct {
	pool   *pgxpool.Pool
	logger *slog.Logger

	// Diisi Bind. Kit dibuat lebih dulu karena organization pemasangan
	// self-host baru diketahui dari agent lewat kit; hook baru dipanggil
	// sesudah server melayani, jauh setelah Bind.
	kit      *web.Kit
	sessions *Sessions
	org      uuid.UUID
}

// NewGonsuLogin menyiapkan hook yang belum terikat pemasangan mana pun.
func NewGonsuLogin(pool *pgxpool.Pool, logger *slog.Logger) *GonsuLogin {
	return &GonsuLogin{pool: pool, logger: logger}
}

// Bind mengikat hook ke kit, organization pemasangan, dan sesi produk. Wajib
// dipanggil sebelum server melayani.
func (g *GonsuLogin) Bind(kit *web.Kit, org uuid.UUID, sessions *Sessions) {
	g.kit, g.org, g.sessions = kit, org, sessions
}

// Hooks adalah jawaban produk untuk kit.
func (g *GonsuLogin) Hooks() web.Hooks {
	return web.Hooks{
		Granted: func(ctx context.Context, subject string) (bool, error) {
			return SubjectLookup(g.pool, g.org)(ctx, subject)
		},
		BootstrapOwner: g.bootstrapOwner,
		StartSession:   g.startSession,
		LoginFailed: func(w http.ResponseWriter, r *http.Request, reason web.Reason) {
			code, ok := failCodes[reason]
			if !ok {
				code = failRejected
			}
			fail(w, r, code)
		},
	}
}

// SubjectLookup menjawab apakah `sub` diberi akses ke pemasangan org: ada
// baris ACTIVE di application_users. Tidak pernah membuat pengguna baru — JIT
// dari `sub` yang tidak dikenal menghapus seluruh pemeriksaan ini.
func SubjectLookup(db store.DBTX, org uuid.UUID) auth.SubjectLookup {
	return func(ctx context.Context, subject string) (bool, error) {
		return store.New(db).SubjectGranted(ctx, store.SubjectGrantedParams{
			OrganizationID: org, ExternalSubject: subject,
		})
	}
}

// startSession mencatat login orang yang sudah lolos pemeriksaan akses, lalu
// menerbitkan sesi produk beserta bahan pemeriksaan ulangnya.
func (g *GonsuLogin) startSession(w http.ResponseWriter, r *http.Request, login auth.Login, next string) error {
	ctx := r.Context()
	userID, err := store.New(g.pool).RecordLogin(ctx, store.RecordLoginParams{
		OrganizationID: g.org, ExternalSubject: login.Claims.Subject,
		Email: nonEmpty(login.Claims.Email), Name: nonEmpty(login.Claims.Name),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Dicabut di antara pemeriksaan dan pencatatan.
		g.kit.FailLogin(w, r, web.ReasonNotGranted)
		return nil
	}
	if err != nil {
		return err
	}
	if err := g.sessions.Issue(ctx, w, NewSession{
		UserID: userID, OrganizationID: g.org, Kind: KindGonsu, TTL: gonsuSession,
		RefreshToken: login.Session.RefreshToken, IDToken: login.IDToken, CheckedAt: login.Session.LastChecked,
	}); err != nil {
		return err
	}
	http.Redirect(w, r, returnTo(next), http.StatusSeeOther)
	return nil
}

// bootstrapOwner membuat admin pertama pemasangan.
//
// Kit hanya memanggilnya untuk pemilik pemasangan menurut GONSU — `sub` yang
// cocok persis. Bagian produk: jalan ini hanya terbuka selama pemasangan
// belum pernah memberi akses kepada siapa pun. Begitu satu baris ada, jalan
// ini tertutup untuk selamanya; pemilik baru tidak dapat menyuntikkan diri ke
// pemasangan yang sudah berjalan.
func (g *GonsuLogin) bootstrapOwner(ctx context.Context, claims auth.Claims) (bool, error) {
	tx, err := g.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	// Kunci yang sama dengan pemberian akses: dua login pemilik bersamaan
	// tidak dapat sama-sama melihat tabel kosong.
	if err := q.LockUserGrants(ctx, g.org.String()); err != nil {
		return false, err
	}
	// Login pemilik lain yang berjalan bersamaan mungkin baru saja membuatnya.
	granted, err := q.SubjectGranted(ctx, store.SubjectGrantedParams{
		OrganizationID: g.org, ExternalSubject: claims.Subject,
	})
	if err != nil || granted {
		return granted, err
	}
	n, err := q.CountUsers(ctx, g.org)
	if err != nil {
		return false, err
	}
	if n > 0 {
		return false, nil
	}
	id, err := q.UpsertUser(ctx, store.UpsertUserParams{
		OrganizationID: g.org, ExternalSubject: claims.Subject,
		Email: nonEmpty(claims.Email), Name: nonEmpty(claims.Name), ApplicationRole: authz.RoleAdministrator,
	})
	if err != nil {
		return false, fmt.Errorf("membuat admin pertama: %w", err)
	}
	if err := recordAccess(ctx, q, g.org, id, "GRANTED", "", authz.RoleAdministrator,
		Actor{Name: "pemilik pemasangan (GONSU)", Source: SourceOwnerBootstrap}); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// LoginAttempts menyimpan login GONSU yang sedang berjalan di tabel
// login_attempts (web.PendingStore), supaya login bertahan melewati restart
// dan berlaku di replica mana pun. Baris dihapus saat dipakai: balikan yang
// sama tidak dapat diputar ulang.
type LoginAttempts struct{ pool *pgxpool.Pool }

// NewLoginAttempts mengembalikan penyimpanan percobaan login.
func NewLoginAttempts(pool *pgxpool.Pool) LoginAttempts { return LoginAttempts{pool: pool} }

// Put menyimpan percobaan login. key sudah berupa hash dari kit; nilai
// mentahnya hanya ada di cookie pengunjung.
func (a LoginAttempts) Put(ctx context.Context, key string, login web.PendingLogin) error {
	q := store.New(a.pool)
	if err := q.DeleteExpiredLoginAttempts(ctx); err != nil {
		return fmt.Errorf("membersihkan percobaan login lama: %w", err)
	}
	var next *string
	if login.Next != "" {
		next = &login.Next
	}
	return q.CreateLoginAttempt(ctx, store.CreateLoginAttemptParams{
		TokenHash: []byte(key), State: login.Auth.State, Nonce: login.Auth.Nonce,
		Verifier: login.Auth.Verifier, ReturnTo: next, ExpiresAt: login.ExpiresAt,
	})
}

// Take mengambil sekaligus menghapus percobaan login.
func (a LoginAttempts) Take(ctx context.Context, key string) (web.PendingLogin, bool, error) {
	row, err := store.New(a.pool).TakeLoginAttempt(ctx, []byte(key))
	if errors.Is(err, pgx.ErrNoRows) {
		return web.PendingLogin{}, false, nil
	}
	if err != nil {
		return web.PendingLogin{}, false, err
	}
	login := web.PendingLogin{Auth: auth.Pending{State: row.State, Nonce: row.Nonce, Verifier: row.Verifier}}
	if row.ReturnTo != nil {
		login.Next = *row.ReturnTo
	}
	return login, true, nil
}
