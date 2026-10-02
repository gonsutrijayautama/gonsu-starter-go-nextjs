//go:build dev

package authn

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authn/store"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/authz"
	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/httpx"
)

// Login pengembangan. File ini hanya ter-compile
// pada build `dev`; binary rilis secara fisik tidak membawanya. Jangan
// menggantinya dengan pemeriksaan environment.

const devLoginEnabled = true

const devSessionTTL = 7 * 24 * time.Hour

// MountLogin memasang GET /auth/login.
//
//	?as=<role>   pengguna pengembangan untuk role itu (dibuat bila belum ada),
//	             supaya izin setiap role dapat dicoba
//	?sub=<sub>   masuk sebagai pengguna yang SUDAH diberi akses; `sub` yang
//	             tidak dikenal ditolak persis seperti jalur GONSU
//	tanpa keduanya: ke GONSU bila pemasangan ini diberi login GONSU, selain
//	             itu pengguna pengembangan administrator
//
// Pengguna ditulis ke kolom yang sama dengan jalur GONSU — external_subject —
// tanpa sandi apa pun.
func MountLogin(r chi.Router, d LoginDeps) {
	r.Get("/auth/login", func(w http.ResponseWriter, req *http.Request) {
		query := req.URL.Query()
		role, sub := query.Get("as"), query.Get("sub")
		if role == "" && sub == "" && d.GonsuLogin {
			startGonsu(w, req)
			return
		}
		var userID uuid.UUID
		var err error
		if sub != "" {
			userID, err = store.New(d.Pool).FindActiveUser(req.Context(), store.FindActiveUserParams{
				OrganizationID: d.Organization, ExternalSubject: sub,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				fail(w, req, failNotGranted)
				return
			}
		} else {
			if role == "" {
				role = authz.RoleAdministrator
			}
			if !slices.Contains(authz.Roles, role) {
				httpx.WriteError(w, req, d.Logger, apperr.Validation(fmt.Sprintf("Role %q tidak dikenal.", role)))
				return
			}
			userID, err = store.New(d.Pool).UpsertUser(req.Context(), store.UpsertUserParams{
				OrganizationID: d.Organization, ExternalSubject: "dev:" + role,
				Name: nonEmpty("Pengembang (" + role + ")"), ApplicationRole: role,
			})
		}
		if err != nil {
			httpx.WriteError(w, req, d.Logger, fmt.Errorf("menyiapkan pengguna pengembangan: %w", err))
			return
		}
		if err := d.Sessions.Issue(req.Context(), w, NewSession{
			UserID: userID, OrganizationID: d.Organization, Kind: KindDev, TTL: devSessionTTL,
		}); err != nil {
			httpx.WriteError(w, req, d.Logger, err)
			return
		}
		http.Redirect(w, req, returnTo(localPath(query.Get("next"))), http.StatusSeeOther)
	})
	d.mountCommon(r)
}
