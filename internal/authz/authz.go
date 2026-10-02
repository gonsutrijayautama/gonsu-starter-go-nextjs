// Package authz memutuskan boleh-tidaknya sebuah role melakukan sesuatu.
//
// Service memeriksa PERMISSION, bukan nama role: `authn.Check(ctx,
// authz.NotesWrite)`. Menambah kemampuan berarti menambah permission di sini
// bersama modul yang memakainya — tidak ditebak sendiri di modul itu.
//
// Role milik produk ini, bukan milik GONSU: GONSU menjawab "siapa orang ini",
// produk menjawab "boleh apa dia di sini".
package authz

import "slices"

// Permission adalah nama sebuah kemampuan.
type Permission string

const (
	// SettingsUsersManage: memberi akses login, mengubah role, dan
	// menonaktifkan pengguna (layar Pengguna & Akses).
	SettingsUsersManage Permission = "settings.users.manage"
	// SettingsSubscriptionView: tautan ke langganan, tagihan, dan paket bisnis
	// di Portal GONSU. Portal sendiri yang memeriksa orangnya; izin ini
	// menjaga supaya staf yang tidak mengurus langganan tidak diantar ke
	// halaman yang akan menolaknya.
	SettingsSubscriptionView Permission = "settings.subscription.view"
	// SettingsBusinessManage: mengubah profil bisnis dan logonya (layar Profil
	// bisnis). Membacanya tidak butuh izin: nama dan logo bisnis tampil untuk
	// setiap pengguna.
	SettingsBusinessManage Permission = "settings.business.manage"

	// Modul contoh Catatan. Hapus bersama modulnya.
	NotesRead  Permission = "notes.read"
	NotesWrite Permission = "notes.write"
)

// Role bawaan. Menambah role berarti juga migrasi baru yang mengganti
// constraint application_users.application_role.
const (
	RoleAdministrator = "administrator"
	RoleStaff         = "staff"
	RoleViewer        = "viewer"
)

// Roles adalah seluruh role, urut seperti ditampilkan di layar.
var Roles = []string{RoleAdministrator, RoleStaff, RoleViewer}

// grants adalah matriks role → permission.
var grants = map[Permission][]string{
	SettingsUsersManage:      {RoleAdministrator},
	SettingsSubscriptionView: {RoleAdministrator},
	SettingsBusinessManage:   {RoleAdministrator},
	NotesRead:                {RoleAdministrator, RoleStaff, RoleViewer},
	NotesWrite:               {RoleAdministrator, RoleStaff},
}

// PermissionsOf mengembalikan seluruh permission sebuah role, terurut. Dipakai
// /v1/me supaya UI tidak menyalin matriks ini.
func PermissionsOf(role string) []Permission {
	out := []Permission{}
	for p := range grants {
		if Can(role, p) {
			out = append(out, p)
		}
	}
	slices.Sort(out)
	return out
}

// Can melaporkan apakah role memegang permission. Permission yang tidak ada
// di matriks tidak pernah diberikan.
func Can(role string, p Permission) bool {
	return slices.Contains(grants[p], role)
}
