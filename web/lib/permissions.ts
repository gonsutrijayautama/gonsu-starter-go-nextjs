// Nama izin, sama persis dengan internal/authz. Layar memakainya untuk
// menyembunyikan yang tidak boleh dipakai; server tetap yang menegakkan.
export const Permission = {
  SettingsUsersManage: "settings.users.manage",
  SettingsSubscriptionView: "settings.subscription.view",
  SettingsBusinessManage: "settings.business.manage",
  NotesRead: "notes.read",
  NotesWrite: "notes.write",
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]
