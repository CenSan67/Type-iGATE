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

// Roles that can be requested at signup or assigned in Account Management. Super Admin is
// never one of them: the system keeps a fixed set of two Super Admin accounts, created and
// changed only in the Firebase console (database.rules.json refuses any client write that
// makes, unmakes, deactivates or removes a Super Admin).
export const ASSIGNABLE_ROLES = ['Administrator', 'Security Guard']

// Interim role stored on a brand-new signup while it is still Pending. The role the user
// actually asked for lives in `requestedRole` and only replaces this on admin approval.
export const DEFAULT_SIGNUP_ROLE = 'Security Guard'

// Who may approve which signup request (mirrored server-side in database.rules.json):
// a Super Admin can approve any requested role; an Administrator only Security Guard requests.
export const canApproveRole = (approverRole, requestedRole) => {
  if (!ASSIGNABLE_ROLES.includes(requestedRole)) return false
  if (approverRole === 'Super Admin') return true
  if (approverRole === 'Administrator') return requestedRole === 'Security Guard'
  return false
}
