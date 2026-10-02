// Package authn memegang sesi milik produk dan siapa yang sedang memakainya.
//
// Produk tidak punya login sendiri. Orang dibuktikan GONSU lewat kit web SDK
// GONSU (gonsu.go), atau login pengembangan pada build `dev`, lalu produk
// menerbitkan sesinya sendiri. Token GONSU tidak diperiksa pada setiap
// request — produk tetap berjalan saat GONSU sesaat tidak terjangkau; yang
// diperiksa adalah sesi ini, ditambah pemeriksaan ulang pencabutan secara
// berkala lewat kit.
package authn

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/auth"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
)

// CookieName adalah cookie sesi produk.
const CookieName = "app_session"

// Kind adalah asal sebuah sesi.
type Kind string

const (
	// KindGonsu: orangnya dibuktikan GONSU. Sesinya diperiksa ulang secara
	// berkala supaya pencabutan di GONSU menjangkaunya.
	KindGonsu Kind = "GONSU"
	// KindDev: login pengembangan. Binary rilis menolak sesi ini walau
	// barisnya ada di database.
	KindDev Kind = "DEV"
)

// Principal adalah pengguna yang sesinya dipakai request ini.
type Principal struct {
	UserID         uuid.UUID
	OrganizationID uuid.UUID
	Name           string
	Email          string
	Role           string
	Kind           Kind
}

type principalKey struct{}

// PrincipalFrom mengembalikan pengguna request ini. ok=false hanya terjadi
// pada route yang tidak melewati Middleware — kesalahan pemrograman.
func PrincipalFrom(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok
}

// WithPrincipal memasang pengguna dan organization-nya ke context. Dipakai
// Middleware, dan test yang menyusun request tanpa sesi sungguhan.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return tenant.WithOrganizationID(context.WithValue(ctx, principalKey{}, p), p.OrganizationID)
}

// SessionVerifier memutuskan apakah sesi GONSU seseorang boleh dilanjutkan.
// *web.Kit memenuhinya; ia yang menangani GONSU tak terjangkau dan masa
// tenggangnya.
type SessionVerifier interface {
	VerifySession(ctx context.Context, state auth.SessionState) (auth.SessionState, error)
}

// Sessions menerbitkan dan memeriksa sesi.
type Sessions struct {
	pool    *pgxpool.Pool
	q       *store.Queries
	verify  SessionVerifier
	recheck time.Duration
	logger  *slog.Logger
}

// NewSessions: recheck adalah GONSU_OIDC_RECHECK_SECONDS, nol berarti bawaan
// SDK. verify nil hanya untuk test yang sekadar menerbitkan sesi — Middleware
// membutuhkannya begitu sesi GONSU sudah waktunya diperiksa ulang.
func NewSessions(pool *pgxpool.Pool, verify SessionVerifier, recheck time.Duration, logger *slog.Logger) *Sessions {
	if recheck <= 0 {
		recheck = auth.DefaultRecheckInterval
	}
	return &Sessions{pool: pool, q: store.New(pool), verify: verify, recheck: recheck, logger: logger}
}

// NewSession adalah sesi yang akan diterbitkan.
type NewSession struct {
	UserID         uuid.UUID
	OrganizationID uuid.UUID
	Kind           Kind
	TTL            time.Duration
	// Tiga field berikut hanya untuk KindGonsu (auth.Login).
	RefreshToken string
	IDToken      string
	CheckedAt    time.Time
}

// Issue membuat sesi baru dan memasang cookie-nya. Token mentah hanya ada di
// cookie; database menyimpan hash-nya.
func (s *Sessions) Issue(ctx context.Context, w http.ResponseWriter, n NewSession) error {
	token := rand.Text()
	expires := time.Now().Add(n.TTL)
	p := store.CreateSessionParams{
		OrganizationID:    n.OrganizationID,
		ApplicationUserID: n.UserID,
		TokenHash:         hashToken(token),
		ExpiresAt:         expires,
		AuthKind:          string(n.Kind),
	}
	if n.Kind == KindGonsu {
		checked := n.CheckedAt
		if checked.IsZero() {
			checked = time.Now()
		}
		p.RefreshToken, p.IDToken, p.LastCheckedAt = &n.RefreshToken, &n.IDToken, &checked
	}
	if err := s.q.CreateSession(ctx, p); err != nil {
		return fmt.Errorf("menyimpan sesi: %w", err)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// SessionOption mengubah cara middleware menolak permintaan tanpa sesi.
type SessionOption func(*sessionGate)

type sessionGate struct {
	deny func(http.ResponseWriter, *http.Request, *slog.Logger, error)
}

// PageLogin membuat permintaan tanpa sesi diarahkan ke login alih-alih
// menerima envelope JSON. Dipakai route yang dibuka langsung di tab browser
// (halaman cetak), bukan yang dipanggil fetch: envelope JSON yang ditampilkan
// sebagai teks mentah di tab baru tidak memberi tahu apa pun kepada pengguna.
func PageLogin() SessionOption {
	return func(g *sessionGate) {
		g.deny = func(w http.ResponseWriter, r *http.Request, _ *slog.Logger, _ error) {
			http.Redirect(w, r, "/auth/login?next="+url.QueryEscape(r.URL.RequestURI()), http.StatusSeeOther)
		}
	}
}

// Middleware mewajibkan sesi yang sah, lalu memasang Principal dan
// organization_id ke context. Tanpa sesi: 401 UNAUTHENTICATED, atau
// pengalihan ke login bila diberi PageLogin.
func (s *Sessions) Middleware(opts ...SessionOption) func(http.Handler) http.Handler {
	g := sessionGate{deny: httpx.WriteError}
	for _, opt := range opts {
		opt(&g)
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(CookieName)
			if err != nil || c.Value == "" {
				g.deny(w, r, s.logger, errNoSession)
				return
			}
			row, err := s.q.SessionPrincipal(r.Context(), hashToken(c.Value))
			if errors.Is(err, pgx.ErrNoRows) {
				g.deny(w, r, s.logger, errNoSession)
				return
			}
			if err != nil {
				httpx.WriteError(w, r, s.logger, fmt.Errorf("membaca sesi: %w", err))
				return
			}
			switch Kind(row.AuthKind) {
			case KindDev:
				if !devLoginEnabled {
					g.deny(w, r, s.logger, errNoSession)
					return
				}
			case KindGonsu:
				if err := s.recheckSession(r.Context(), row.SessionID, row.LastCheckedAt); err != nil {
					g.deny(w, r, s.logger, err)
					return
				}
			default:
				g.deny(w, r, s.logger, errNoSession)
				return
			}
			p := Principal{
				UserID:         row.UserID,
				OrganizationID: row.OrganizationID,
				Role:           row.ApplicationRole,
				Kind:           Kind(row.AuthKind),
			}
			if row.Name != nil {
				p.Name = *row.Name
			}
			if row.Email != nil {
				p.Email = *row.Email
			}
			next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), p)))
		})
	}
}

var (
	errNoSession    = apperr.Unauthenticated("Sesi tidak ada atau sudah berakhir. Silakan masuk lagi.")
	errSessionEnded = apperr.Unauthenticated("Sesi Anda diakhiri: akses Anda di GONSU tidak dapat dipastikan lagi. Silakan masuk lagi.")
)

// recheckSession memastikan orang di balik sesi GONSU masih berhak (kit
// VerifySession). Murah pada hampir setiap request: baris sesi baru dikunci,
// dan jaringan baru disentuh, bila sudah waktunya.
func (s *Sessions) recheckSession(ctx context.Context, sessionID uuid.UUID, lastChecked *time.Time) error {
	if lastChecked != nil && time.Since(*lastChecked) < s.recheck {
		return nil
	}
	// Penukaran refresh token tidak boleh terputus di tengah karena client
	// menutup koneksi: token yang sudah dirotasi GONSU tetapi tidak tersimpan
	// membuat pemeriksaan berikutnya ditolak.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
	defer cancel()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := s.q.WithTx(tx)
	locked, err := q.LockSessionForRecheck(ctx, sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNoSession
	}
	if err != nil {
		return fmt.Errorf("mengunci sesi: %w", err)
	}
	if locked.LastCheckedAt != nil && time.Since(*locked.LastCheckedAt) < s.recheck {
		// Request lain baru saja memeriksanya.
		return tx.Commit(ctx)
	}

	state := auth.SessionState{}
	if locked.RefreshToken != nil {
		state.RefreshToken = *locked.RefreshToken
	}
	if locked.LastCheckedAt != nil {
		state.LastChecked = *locked.LastCheckedAt
	}
	next, err := s.verify.VerifySession(ctx, state)
	if errors.Is(err, auth.ErrSessionExpired) {
		s.logger.Info("sesi GONSU diakhiri", slog.String("session_id", sessionID.String()),
			slog.String("reason", err.Error()))
		if err := q.RevokeSession(ctx, sessionID); err != nil {
			return fmt.Errorf("mencabut sesi: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return errSessionEnded
	}
	if err != nil {
		return err
	}
	if err := q.RecordRecheck(ctx, store.RecordRecheckParams{
		ID: sessionID, RefreshToken: &next.RefreshToken, LastCheckedAt: &next.LastChecked,
	}); err != nil {
		return fmt.Errorf("menyimpan pemeriksaan sesi: %w", err)
	}
	return tx.Commit(ctx)
}

// Me menjawab siapa pengguna sesi ini, beserta permission-nya supaya UI tidak
// menyalin matriks izin. portal: GONSU menyerahkan alamat Portal, sehingga
// tautan langganan, tagihan, dan paket boleh ditampilkan.
func Me(portal bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me(w, r, portal)
	}
}

func me(w http.ResponseWriter, r *http.Request, portal bool) {
	p, ok := PrincipalFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, nil, errNoSession)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"id":              p.UserID,
		"organization_id": p.OrganizationID,
		"name":            p.Name,
		"email":           p.Email,
		"role":            p.Role,
		"auth_kind":       p.Kind,
		"permissions":     authz.PermissionsOf(p.Role),
		"portal":          portal,
	})
}

// hashToken: token acak 128 bit (rand.Text) tidak butuh salt atau KDF — tidak
// ada yang dapat ditebak dari hash-nya.
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// ByUser adalah kunci rate limit per PENGGUNA, untuk jalur yang sudah punya
// sesi.
//
// Satu kantor berbagi satu alamat publik, jadi mengunci pada IP di sana
// berarti satu orang yang sibuk memblokir seluruh kantor. Permintaan tanpa
// sesi jatuh ke IP — ia tidak seharusnya sampai ke sini, dan kunci kosong
// akan menyatukan seluruhnya ke satu bucket.
func ByUser(r *http.Request) string {
	if p, ok := PrincipalFrom(r.Context()); ok {
		return p.UserID.String()
	}
	return httpx.ByIP(r)
}
