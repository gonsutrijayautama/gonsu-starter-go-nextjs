package authn

import (
	"errors"

	"github.com/gonsutrijayautama/gonsu-one-sdk-go/web"

	"github.com/gonsutrijayautama/gonsu-starter-go-nextjs/internal/apperr"
)

// Pemberian akses login meminta GONSU membuatkan (atau menemukan) akun GONSU
// seseorang lewat kit (`web.Identities`):
//
//	self-host  POST $GONSU_AGENT_URL/v1/identities — agent yang menandatangani
//	cloud      POST $GONSU_BASE_URL/license/v1/identities, Bearer GONSU_IDENTITY_TOKEN
//
// produk tidak pernah memegang kunci pemasangan, dan tidak pernah tahu sandi
// siapa pun selain sandi sementara yang dikembalikan sekali di sana.

// identityRejection menerjemahkan penolakan pemberian akses ke kode katalog
// produk. Kalimat kit dipakai apa adanya: kalimat GONSU di dalamnya sudah
// disanitasi untuk ditampilkan.
func identityRejection(err error) error {
	var rejected *web.IdentityError
	if !errors.As(err, &rejected) {
		return err
	}
	switch rejected.Kind {
	case web.IdentityUnavailable:
		return errIdentityUnavailable
	case web.IdentityRateLimited:
		return apperr.ControlPlane(apperr.CodeRateLimited, rejected.Message)
	case web.IdentityInvalidEmail:
		return apperr.Validation(rejected.Message, apperr.FieldError{Field: "email", Message: rejected.Message})
	case web.IdentityDown:
		return apperr.ControlPlane(apperr.CodeControlPlaneDown, rejected.Message)
	default:
		return apperr.ControlPlane(apperr.CodeControlPlaneRejected, rejected.Message)
	}
}

// errIdentityUnavailable: pemasangan tanpa agent dan tanpa token pemberian
// akses. Dikatakan terus terang di layar; GONSU tidak dipanggil.
var errIdentityUnavailable = apperr.ControlPlane(apperr.CodeIdentityUnavailable,
	"Pemasangan ini belum menerima jalan pemberian akses dari GONSU, jadi orang baru belum dapat ditambahkan dari layar ini.")

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
