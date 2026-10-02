package authz

import (
	"slices"
	"testing"
)

func TestMatrix(t *testing.T) {
	tests := []struct {
		role string
		perm Permission
		want bool
	}{
		{RoleAdministrator, SettingsUsersManage, true},
		{RoleStaff, SettingsUsersManage, false},
		{RoleViewer, SettingsUsersManage, false},
		{RoleViewer, NotesRead, true},
		{RoleViewer, NotesWrite, false},
		{RoleStaff, NotesWrite, true},
		{"tidak-dikenal", NotesRead, false},
	}
	for _, tt := range tests {
		if got := Can(tt.role, tt.perm); got != tt.want {
			t.Errorf("Can(%s, %s) = %v, ingin %v", tt.role, tt.perm, got, tt.want)
		}
	}
}

// Setiap role di matriks harus role yang dikenal: salah ketik di sini
// berarti izin yang tidak pernah diberikan kepada siapa pun.
func TestGrantsOnlyKnownRoles(t *testing.T) {
	for p, roles := range grants {
		for _, r := range roles {
			if !slices.Contains(Roles, r) {
				t.Errorf("%s diberikan kepada role tak dikenal %q", p, r)
			}
		}
	}
}

func TestPermissionsOfIsSorted(t *testing.T) {
	got := PermissionsOf(RoleAdministrator)
	if !slices.IsSorted(got) || len(got) != len(grants) {
		t.Errorf("PermissionsOf(administrator) = %v", got)
	}
}
