iGate - Bulacan State University

Quick start:

1. Install dependencies

```bash
npm install
```

2. Add your Firebase config in `src/services/firebase.js`

3. Run dev server

```bash
npm run dev
```

Notes:
- Uses Vite + React + Firebase modular SDK (v9+) — Auth + Realtime Database (not Firestore)
- Implement UI components according to the provided wireframes in `src/components`

## Accounts & security (for whoever maintains iGate)

**Super Admins** - exactly two: `test@bulsu.edu.ph` and `igatebustosmis@bulsu.edu.ph` (MIS BUSTOS). The app cannot create, demote, deactivate or remove a Super Admin; that is done only in the Firebase console:
- *Add one*: Authentication -> Add user (copy the UID) -> Realtime Database -> `adminProfiles` -> "+" with key = UID and fields `fullName`, `displayName`, `email`, `phone` (empty), `role: "Super Admin"`, `status: "Active"`, `emailVerified: true`, `joinedDate`. Never use "Import JSON" on `adminProfiles` - it replaces every profile.
- *Forgotten password*: "Forgot password?" on the login page sends a reset link to the account's inbox (the university's Google Workspace admin can recover a `@bulsu.edu.ph` inbox). If the inbox is lost too, a Firebase project owner creates a fresh login as above and removes the old one.
- Keep at least two university accounts as **Owners** of the Firebase project (Project settings -> Users and permissions). The project owner is the last line of recovery.

**If a staff or Super Admin account is compromised**
1. *Cut access now* - Realtime Database -> `adminProfiles/{uid}/status` = `Inactive` (takes effect on the attacker's next action), then Authentication -> the user -> Disable account.
2. *Secure the inbox* - have the Google Workspace admin reset that mailbox's password, since password resets go there.
3. *See what was changed* - log in as the other Super Admin -> Account Management -> **Audit Log**. Filter by the person's name; every change to staff accounts, vehicles, payments, VIP guests, gate logs, gate commands and settings shows who, when, and the before/after values. Export CSV for the record. Nobody can edit or delete the audit log from the app.
4. *Undo* - put the before-values back (or restore from a database backup), set any account the attacker approved/promoted back to `Inactive`.
5. *Recover the account* - new password (or fresh login), re-enable it, set `status` back to `Active`.

**Backups** - turn on daily backups: Firebase console -> Realtime Database -> Backups. Or export regularly: Data -> ⋮ -> Export JSON.
