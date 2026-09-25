// Admin/staff login roles. NOT the same thing as the vehicle-owner "role" field
// on rfidUsers (Student/Faculty/Staff/Visitor) used in RegistrationModal/RegisterRfidModal.
export const ROLES = ['Super Admin', 'Administrator', 'Security Guard']

// Roles allowed into Account Management and System Settings.
export const ADMIN_ROLES = ['Super Admin', 'Administrator']

// ROLES is ordered highest -> lowest privilege. An account may only ever "view as" its
// own real role or one below it - never above (a Security Guard can't climb the ladder).
export const getViewableRoles = (realRole) => {
  const idx = ROLES.indexOf(realRole)
  return idx === -1 ? [] : ROLES.slice(idx)
}
