package authn

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/entitlement"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/tenant"
)

// Pemberian akses login. Pengguna lahir dari pemberian akses yang disengaja,
// tidak pernah dari login pertama: `sub` yang tidak dikenal ditolak, bukan
// dibuatkan akun.
//
// Tiga jalan, satu aturan: layar Pengguna & Akses, perintah operator
// `users grant`, dan pemilik pemasangan saat login pertama. Setiap perubahan
// dicatat di user_access_events.

// Sumber perubahan akses.
const (
	SourceScreen         = "SCREEN"
	SourceCLI            = "CLI"
	SourceOwnerBootstrap = "OWNER_BOOTSTRAP"
)

// Status pengguna.
const (
	StatusActive    = "ACTIVE"
	StatusSuspended = "SUSPENDED"
)

// Actor adalah pelaku perubahan akses. UserID kosong untuk operator dan
// bootstrap pemilik: tidak ada pengguna produk di baliknya.
type Actor struct {
	UserID *uuid.UUID
	Name   string
	Source string
}

// GrantInput adalah orang yang diberi akses.
type GrantInput struct {
	// Subject adalah klaim `sub` akun GONSU orang itu — bukan email.
	Subject string
	Email   string
	Name    string
	Role    string
	Actor   Actor
}

// ErrUserLimit berarti kuota users.max paket sudah penuh.
var ErrUserLimit = errors.New("kuota pengguna paket sudah penuh")

// ErrUserNotFound berarti `sub` tidak pernah diberi akses di pemasangan ini.
var ErrUserNotFound = errors.New("pengguna tidak ditemukan")

// Grant memberi (atau memperbarui) akses satu orang. Orang yang sudah aktif
// hanya diperbarui dan tidak dihitung ulang terhadap users.max.
func Grant(ctx context.Context, pool *pgxpool.Pool, lic entitlement.Resolver, org uuid.UUID, in GrantInput) (uuid.UUID, error) {
	in.Subject = strings.TrimSpace(in.Subject)
	in.Email = strings.TrimSpace(in.Email)
	in.Name = strings.TrimSpace(in.Name)
	switch {
	case in.Subject == "" || strings.IndexFunc(in.Subject, unicode.IsSpace) >= 0 || len(in.Subject) > 255:
		return uuid.Nil, errors.New("subject wajib diisi: klaim `sub` akun GONSU, tanpa spasi")
	case !slices.Contains(authz.Roles, in.Role):
		return uuid.Nil, fmt.Errorf("role %q tidak dikenal; pilih salah satu: %s", in.Role, strings.Join(authz.Roles, ", "))
	case in.Actor.Source == "":
		// Tidak ada nilai bawaan: riwayat akses tanpa asal-usul tidak menjawab
		// pertanyaan yang membuatnya ada.
		return uuid.Nil, errors.New("pemberian akses wajib menyebut sumbernya (layar, operator, atau pemilik)")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	if err := q.LockUserGrants(ctx, org.String()); err != nil {
		return uuid.Nil, err
	}
	prev, err := q.UserBySubject(ctx, store.UserBySubjectParams{OrganizationID: org, ExternalSubject: in.Subject})
	exists := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, err
	}
	if !exists || prev.Status != StatusActive {
		if err := checkSeats(ctx, q, lic, org); err != nil {
			return uuid.Nil, err
		}
	}
	id, err := q.UpsertUser(ctx, store.UpsertUserParams{
		OrganizationID: org, ExternalSubject: in.Subject,
		Email: nonEmpty(in.Email), Name: nonEmpty(in.Name), ApplicationRole: in.Role,
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("menyimpan pengguna: %w", err)
	}

	switch {
	case !exists:
		err = recordAccess(ctx, q, org, id, "GRANTED", "", in.Role, in.Actor)
	case prev.Status != StatusActive:
		err = recordAccess(ctx, q, org, id, "REACTIVATED", prev.ApplicationRole, in.Role, in.Actor)
	case prev.ApplicationRole != in.Role:
		err = recordAccess(ctx, q, org, id, "ROLE_CHANGED", prev.ApplicationRole, in.Role, in.Actor)
	}
	if err != nil {
		return uuid.Nil, err
	}
	return id, tx.Commit(ctx)
}

// checkSeats menolak pengguna aktif baru bila kuota users.max penuh: batas
// kuotanya ditegakkan di pemberian akses, bukan satu gerbang di awal.
func checkSeats(ctx context.Context, q *store.Queries, lic entitlement.Resolver, org uuid.UUID) error {
	max, unlimited := lic.Limit(ctx, entitlement.UsersMax)
	if unlimited {
		return nil
	}
	active, err := q.CountActiveUsers(ctx, org)
	if err != nil {
		return err
	}
	if active >= max {
		return fmt.Errorf("%w: %d dari %d pengguna aktif", ErrUserLimit, active, max)
	}
	return nil
}

func recordAccess(ctx context.Context, q *store.Queries, org, userID uuid.UUID, action, before, after string, a Actor) error {
	name := a.Name
	if name == "" {
		name = "—"
	}
	if err := q.InsertAccessEvent(ctx, store.InsertAccessEventParams{
		OrganizationID: org, ApplicationUserID: userID, Action: action,
		RoleBefore: nonEmpty(before), RoleAfter: nonEmpty(after),
		Source: a.Source, ActorUserID: a.UserID, ActorName: name,
	}); err != nil {
		return fmt.Errorf("mencatat riwayat akses: %w", err)
	}
	return nil
}

// Suspend mencabut akses satu orang beserta seluruh sesinya yang berjalan.
func Suspend(ctx context.Context, pool *pgxpool.Pool, org uuid.UUID, subject string, a Actor) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	if err := q.LockUserGrants(ctx, org.String()); err != nil {
		return err
	}
	prev, err := q.UserBySubject(ctx, store.UserBySubjectParams{OrganizationID: org, ExternalSubject: strings.TrimSpace(subject)})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUserNotFound
	}
	if err != nil {
		return err
	}
	if prev.Status == StatusSuspended {
		return tx.Commit(ctx)
	}
	if err := suspend(ctx, q, org, prev.ID, prev.ApplicationRole, a); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func suspend(ctx context.Context, q *store.Queries, org, id uuid.UUID, role string, a Actor) error {
	if err := q.SetUserStatus(ctx, store.SetUserStatusParams{OrganizationID: org, ID: id, Status: StatusSuspended}); err != nil {
		return err
	}
	if err := q.RevokeUserSessions(ctx, store.RevokeUserSessionsParams{OrganizationID: org, ApplicationUserID: id}); err != nil {
		return err
	}
	return recordAccess(ctx, q, org, id, "SUSPENDED", role, "", a)
}

// User adalah satu baris daftar pengguna pemasangan.
type User struct {
	ID          uuid.UUID
	Subject     string
	Email       string
	Name        string
	Role        string
	Status      string
	LastLoginAt *time.Time
	CreatedAt   time.Time
}

// Users mendaftar seluruh pengguna pemasangan.
func Users(ctx context.Context, db store.DBTX, org uuid.UUID) ([]User, error) {
	rows, err := store.New(db).ListUsers(ctx, org)
	if err != nil {
		return nil, err
	}
	out := make([]User, 0, len(rows))
	for _, r := range rows {
		u := User{ID: r.ID, Subject: r.ExternalSubject, Role: r.ApplicationRole, Status: r.Status,
			LastLoginAt: r.LastLoginAt, CreatedAt: r.CreatedAt}
		if r.Email != nil {
			u.Email = *r.Email
		}
		if r.Name != nil {
			u.Name = *r.Name
		}
		out = append(out, u)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Layar Pengguna & Akses
// ---------------------------------------------------------------------------

// UserAdmin melayani layar Pengguna & Akses. Seluruh tindakannya menuntut
// settings.users.manage.
type UserAdmin struct {
	pool     *pgxpool.Pool
	license  entitlement.Resolver
	identity *web.Identities
	logger   *slog.Logger
}

// NewUserAdmin: identity adalah kit.Identities(). Pemasangan yang tidak diberi
// jalan pemberian akses tetap memilikinya, dan Available menjawab false; nil
// diperlakukan sama.
func NewUserAdmin(pool *pgxpool.Pool, license entitlement.Resolver, identity *web.Identities, logger *slog.Logger) *UserAdmin {
	if identity == nil {
		identity = &web.Identities{}
	}
	return &UserAdmin{pool: pool, license: license, identity: identity, logger: logger}
}

// UserView adalah satu pengguna di API.
type UserView struct {
	ID          uuid.UUID  `json:"id"`
	Subject     string     `json:"subject"`
	Email       string     `json:"email"`
	Name        string     `json:"name"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	LastLoginAt *time.Time `json:"last_login_at"`
	CreatedAt   time.Time  `json:"created_at"`
	// IsSelf menandai pengguna yang sedang membuka layar: ia tidak dapat
	// menonaktifkan dirinya sendiri.
	IsSelf bool `json:"is_self"`
}

// UserList adalah jawaban GET /v1/users.
type UserList struct {
	Data []UserView `json:"data"`
	// Invite menjawab apakah pemasangan ini dapat menambah orang dari layar.
	Invite struct {
		Available bool   `json:"available"`
		Reason    string `json:"reason,omitempty"`
	} `json:"invite"`
	// Seats: pengguna aktif dan kuota users.max (null = tanpa batas).
	Seats struct {
		Active int64  `json:"active"`
		Max    *int64 `json:"max"`
	} `json:"seats"`
	AssignableRoles []string `json:"assignable_roles"`
}

// assignableRoles adalah role yang dapat dipilih di layar Pengguna & Akses.
func assignableRoles() []string {
	return slices.Clone(authz.Roles)
}

func (u *UserAdmin) caller(ctx context.Context) (Principal, uuid.UUID, error) {
	p, err := Check(ctx, authz.SettingsUsersManage)
	if err != nil {
		return p, uuid.Nil, err
	}
	org, err := tenant.OrganizationID(ctx)
	return p, org, err
}

func actorOf(p Principal) Actor {
	id := p.UserID
	return Actor{UserID: &id, Name: orDefault(p.Name, p.Email), Source: SourceScreen}
}

// List mendaftar pengguna beserta kuota dan kesiapan pemberian akses.
func (u *UserAdmin) List(ctx context.Context) (UserList, error) {
	p, org, err := u.caller(ctx)
	if err != nil {
		return UserList{}, err
	}
	users, err := Users(ctx, u.pool, org)
	if err != nil {
		return UserList{}, err
	}
	var res UserList
	res.Data = make([]UserView, 0, len(users))
	for _, x := range users {
		res.Data = append(res.Data, view(x, p))
		if x.Status == StatusActive {
			res.Seats.Active++
		}
	}
	if max, unlimited := u.license.Limit(ctx, entitlement.UsersMax); !unlimited {
		res.Seats.Max = &max
	}
	res.Invite.Available = u.identity.Available()
	if !res.Invite.Available {
		res.Invite.Reason = errIdentityUnavailable.Message
	}
	res.AssignableRoles = assignableRoles()
	return res, nil
}

func view(x User, p Principal) UserView {
	return UserView{ID: x.ID, Subject: x.Subject, Email: x.Email, Name: x.Name, Role: x.Role,
		Status: x.Status, LastLoginAt: x.LastLoginAt, CreatedAt: x.CreatedAt, IsSelf: x.ID == p.UserID}
}

// InviteRequest adalah body POST /v1/users.
type InviteRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

// InviteResult adalah jawaban POST /v1/users. TemporaryPassword hanya ada
// ketika GONSU baru membuat akunnya; ia tampil sekali di layar dan tidak
// disimpan produk maupun GONSU.
type InviteResult struct {
	User              UserView `json:"user"`
	Account           string   `json:"account"`
	TemporaryPassword string   `json:"temporary_password,omitempty"`
}

// Akun GONSU orang yang diberi akses.
const (
	AccountCreated  = "created"
	AccountExisting = "existing"
)

const maxEmailLength = 254

// Invite memberi akses login kepada satu orang lewat email: GONSU membuatkan
// (atau menemukan) akunnya, lalu `sub`-nya dicatat di application_users.
//
// Tanpa Idempotency-Key, dan itu disengaja: jawaban yang diputar ulang akan
// menyimpan sandi sementara di database. Permintaan yang diulang aman karena
// GONSU mengembalikan orang yang sama tanpa sandi baru.
func (u *UserAdmin) Invite(ctx context.Context, req InviteRequest) (InviteResult, error) {
	p, org, err := u.caller(ctx)
	if err != nil {
		return InviteResult{}, err
	}
	email := strings.TrimSpace(req.Email)
	name := strings.Join(strings.Fields(req.DisplayName), " ")
	var errs []apperr.FieldError
	if at := strings.IndexByte(email, '@'); at < 1 || at == len(email)-1 ||
		strings.ContainsAny(email, " \t\r\n") || len(email) > maxEmailLength {
		errs = append(errs, apperr.FieldError{Field: "email", Message: "Isi alamat email yang valid."})
	}
	switch {
	case name == "":
		errs = append(errs, apperr.FieldError{Field: "display_name", Message: "Nama wajib diisi."})
	case utf8.RuneCountInString(name) > 200:
		errs = append(errs, apperr.FieldError{Field: "display_name", Message: "Nama maksimal 200 karakter."})
	}
	if !slices.Contains(assignableRoles(), req.Role) {
		errs = append(errs, apperr.FieldError{Field: "role", Message: "Pilih role yang tersedia."})
	}
	if len(errs) > 0 {
		return InviteResult{}, apperr.Validation("Isian belum lengkap.", errs...)
	}
	if !u.identity.Available() {
		return InviteResult{}, errIdentityUnavailable
	}
	// Kuota diperiksa sebelum GONSU membuat akun: akun yang tidak dapat diberi
	// akses hanya menghabiskan kuota identitas harian pemasangan.
	if err := u.seatsAvailable(ctx, org); err != nil {
		return InviteResult{}, err
	}

	id, err := u.identity.Provision(ctx, email, name)
	if err != nil {
		return InviteResult{}, identityRejection(err)
	}
	existing, err := store.New(u.pool).UserBySubject(ctx, store.UserBySubjectParams{OrganizationID: org, ExternalSubject: id.Subject})
	if err == nil && existing.Status == StatusActive {
		msg := fmt.Sprintf("Orang ini sudah punya akses di sini sebagai %s. Ubah role-nya dari daftar pengguna.", existing.ApplicationRole)
		return InviteResult{}, apperr.Validation(msg, apperr.FieldError{Field: "email", Message: msg})
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return InviteResult{}, err
	}

	userID, err := Grant(ctx, u.pool, u.license, org, GrantInput{
		Subject: id.Subject, Email: orDefault(id.Email, email), Name: orDefault(id.DisplayName, name),
		Role: req.Role, Actor: actorOf(p),
	})
	if errors.Is(err, ErrUserLimit) {
		return InviteResult{}, seatsFull(err)
	}
	if err != nil {
		return InviteResult{}, err
	}
	u.logger.Info("akses login diberikan", slog.String("sub", id.Subject), slog.String("role", req.Role),
		slog.String("actor_id", p.UserID.String()), slog.Bool("account_created", id.TemporaryPassword != ""))

	res := InviteResult{Account: AccountExisting, TemporaryPassword: id.TemporaryPassword}
	if id.TemporaryPassword != "" {
		res.Account = AccountCreated
	}
	users, err := Users(ctx, u.pool, org)
	if err != nil {
		return InviteResult{}, err
	}
	for _, x := range users {
		if x.ID == userID {
			res.User = view(x, p)
		}
	}
	return res, nil
}

func (u *UserAdmin) seatsAvailable(ctx context.Context, org uuid.UUID) error {
	if err := checkSeats(ctx, store.New(u.pool), u.license, org); err != nil {
		if errors.Is(err, ErrUserLimit) {
			return seatsFull(err)
		}
		return err
	}
	return nil
}

func seatsFull(err error) error {
	e := apperr.EntitlementRequired(entitlement.UsersMax)
	e.Message = "Kuota pengguna paket sudah penuh (" + strings.TrimPrefix(err.Error(), ErrUserLimit.Error()+": ") +
		"). Nonaktifkan pengguna yang tidak lagi bekerja, atau naikkan paket."
	return e
}

// UpdateRequest adalah body PATCH /v1/users/{id}. Field yang kosong tidak
// diubah.
type UpdateRequest struct {
	Role   string `json:"role"`
	Status string `json:"status"`
}

// Update mengubah role atau status satu pengguna.
//
// Pengaman: tidak ada yang dapat menonaktifkan dirinya sendiri, dan
// administrator aktif terakhir tidak dapat diturunkan atau dinonaktifkan —
// pemasangan tanpa administrator tidak dapat memberi akses kepada siapa pun
// lagi selain lewat operator.
func (u *UserAdmin) Update(ctx context.Context, id uuid.UUID, req UpdateRequest) (UserView, error) {
	p, org, err := u.caller(ctx)
	if err != nil {
		return UserView{}, err
	}
	var errs []apperr.FieldError
	if req.Role == "" && req.Status == "" {
		errs = append(errs, apperr.FieldError{Field: "role", Message: "Sebutkan role atau status yang diubah."})
	}
	if req.Role != "" && !slices.Contains(assignableRoles(), req.Role) {
		errs = append(errs, apperr.FieldError{Field: "role", Message: "Pilih role yang tersedia."})
	}
	if req.Status != "" && req.Status != StatusActive && req.Status != StatusSuspended {
		errs = append(errs, apperr.FieldError{Field: "status", Message: "Status harus ACTIVE atau SUSPENDED."})
	}
	if len(errs) > 0 {
		return UserView{}, apperr.Validation("Perubahan tidak valid.", errs...)
	}

	tx, err := u.pool.Begin(ctx)
	if err != nil {
		return UserView{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	if err := q.LockUserGrants(ctx, org.String()); err != nil {
		return UserView{}, err
	}
	cur, err := q.UserByID(ctx, store.UserByIDParams{OrganizationID: org, ID: id})
	if errors.Is(err, pgx.ErrNoRows) {
		return UserView{}, apperr.NotFound("Pengguna tidak ditemukan.")
	}
	if err != nil {
		return UserView{}, err
	}

	role, status := cur.ApplicationRole, cur.Status
	if req.Role != "" {
		role = req.Role
	}
	if req.Status != "" {
		status = req.Status
	}

	if status == StatusSuspended && cur.Status == StatusActive && id == p.UserID {
		return UserView{}, apperr.Validation("Anda tidak dapat menonaktifkan akun Anda sendiri.",
			apperr.FieldError{Field: "status", Message: "Anda tidak dapat menonaktifkan akun Anda sendiri."})
	}
	losesAdmin := cur.Status == StatusActive && cur.ApplicationRole == authz.RoleAdministrator &&
		(status != StatusActive || role != authz.RoleAdministrator)
	if losesAdmin {
		others, err := q.CountOtherActiveAdmins(ctx, store.CountOtherActiveAdminsParams{OrganizationID: org, ID: id})
		if err != nil {
			return UserView{}, err
		}
		if others == 0 {
			msg := "Harus tersisa minimal satu administrator aktif."
			return UserView{}, apperr.Validation(msg, apperr.FieldError{Field: "role", Message: msg})
		}
	}

	a := actorOf(p)
	switch {
	case status == StatusSuspended && cur.Status == StatusActive:
		if role != cur.ApplicationRole {
			if err := u.changeRole(ctx, q, org, id, cur.ApplicationRole, role, a); err != nil {
				return UserView{}, err
			}
		}
		if err := suspend(ctx, q, org, id, role, a); err != nil {
			return UserView{}, err
		}
	case status == StatusActive && cur.Status == StatusSuspended:
		if err := checkSeats(ctx, q, u.license, org); err != nil {
			if errors.Is(err, ErrUserLimit) {
				return UserView{}, seatsFull(err)
			}
			return UserView{}, err
		}
		if err := q.SetUserRole(ctx, store.SetUserRoleParams{
			OrganizationID: org, ID: id, ApplicationRole: role,
		}); err != nil {
			return UserView{}, err
		}
		if err := q.SetUserStatus(ctx, store.SetUserStatusParams{OrganizationID: org, ID: id, Status: StatusActive}); err != nil {
			return UserView{}, err
		}
		if err := recordAccess(ctx, q, org, id, "REACTIVATED", cur.ApplicationRole, role, a); err != nil {
			return UserView{}, err
		}
	case role != cur.ApplicationRole:
		if err := u.changeRole(ctx, q, org, id, cur.ApplicationRole, role, a); err != nil {
			return UserView{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return UserView{}, err
	}
	u.logger.Info("akses pengguna diubah", slog.String("sub", cur.ExternalSubject),
		slog.String("role", role), slog.String("status", status), slog.String("actor_id", p.UserID.String()))

	users, err := Users(ctx, u.pool, org)
	if err != nil {
		return UserView{}, err
	}
	for _, x := range users {
		if x.ID == id {
			return view(x, p), nil
		}
	}
	return UserView{}, apperr.NotFound("Pengguna tidak ditemukan.")
}

func (u *UserAdmin) changeRole(ctx context.Context, q *store.Queries, org, id uuid.UUID,
	before, after string, a Actor) error {

	if err := q.SetUserRole(ctx, store.SetUserRoleParams{
		OrganizationID: org, ID: id, ApplicationRole: after,
	}); err != nil {
		return err
	}
	// Role baru berlaku pada request berikutnya: sesi membaca role dari
	// application_users setiap kali, jadi tidak ada sesi yang perlu dicabut.
	return recordAccess(ctx, q, org, id, "ROLE_CHANGED", before, after, a)
}
