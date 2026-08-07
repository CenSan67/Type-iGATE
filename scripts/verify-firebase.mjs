// Connectivity + seed-data + security-rule probe for the iGate Firebase RTDB + Storage
// project. Assumes database.rules.json AND storage.rules are both deployed (two
// separate tabs/products in the Firebase console - RTDB rules deploying doesn't imply
// Storage rules did too). RTDB: every path requires auth != null, adminProfiles/{uid}
// is scoped to its owner, writes are structurally validated. Storage: uploads under
// vehicle-snapshots/ require auth, an image/* content type, and a 5MB size cap.
//
// Unauthenticated checks only:
//   node scripts/verify-firebase.mjs
//
// Also probe authenticated + role-scoped + schema-validation behavior, using a real
// Firebase Auth account (NOT the old LoginForm bypass, which never touched Firebase Auth
// and has been removed). Prefer env vars over CLI args so the password doesn't end up in
// shell history:
//   IGATE_TEST_EMAIL=you@bulsu.edu.ph IGATE_TEST_PASSWORD=****** node scripts/verify-firebase.mjs
// CLI flags also work if you prefer:
//   node scripts/verify-firebase.mjs --email you@bulsu.edu.ph --password ******
//
// Phase 9: the authenticated section below reads the account's OWN role back from
// adminProfiles/{uid} first, then picks expectAllowed vs expectDenied per-check based
// on whether that role is Super Admin/Administrator or Security Guard - so the exact
// same script correctly validates EITHER direction depending on which account you run
// it with. To fully cover the RBAC audit, run this TWICE: once with a Security Guard
// account, once with an Administrator or Super Admin account.

import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getDatabase, ref, set, get, remove, push } from 'firebase/database'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

const ADMIN_ROLES = ['Super Admin', 'Administrator']

const firebaseConfig = {
  apiKey: 'AIzaSyCiUx-CAXk45UrgEGW99fbIO2rOJ84-B7o',
  authDomain: 'igate-bulsu.firebaseapp.com',
  databaseURL: 'https://igate-bulsu-default-rtdb.firebaseio.com',
  projectId: 'igate-bulsu',
  storageBucket: 'igate-bulsu.firebasestorage.app',
  messagingSenderId: '508714511794',
  appId: '1:508714511794:web:a49e0321bbd560e2db08ab',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)
const storage = getStorage(app)
const testBytes = () => new TextEncoder().encode('not-real-image-bytes')

const args = {}
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) args[arg.slice(2)] = arr[i + 1]
})
const email = process.env.IGATE_TEST_EMAIL || args.email
const password = process.env.IGATE_TEST_PASSWORD || args.password

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FLAG'}  ${name}${detail ? ' - ' + detail : ''}`)
}

function isPermissionDenied(err) {
  return err.code === 'PERMISSION_DENIED'
    || err.code === 'storage/unauthorized'
    || /permission[_ ]denied|unauthorized/i.test(err.message || '')
}

async function expectDenied(name, op) {
  try {
    await op()
    record(name, false, 'operation SUCCEEDED - expected it to be denied')
  } catch (err) {
    record(name, isPermissionDenied(err), err.code || err.message)
  }
}

async function expectAllowed(name, op) {
  try {
    const detail = await op()
    record(name, true, detail)
  } catch (err) {
    record(name, false, err.code || err.message)
  }
}

// Picks expectAllowed vs expectDenied based on the CURRENT account's role, so the
// same admin-gated check works correctly whichever role's credentials this script is
// run with (see the Phase 9 note at the top of this file).
async function expectAllowedIfAdmin(isAdmin, name, op) {
  const label = `${name} (as ${isAdmin ? 'admin' : 'non-admin'})`
  return isAdmin ? expectAllowed(label, op) : expectDenied(label, op)
}

async function main() {
  console.log('--- iGate Firebase RTDB verification ---\n')
  console.log('Unauthenticated checks (rules should deny all of these):')

  await expectDenied('Unauthenticated read of settings/app', () => get(ref(db, 'settings/app')))
  await expectDenied('Unauthenticated write to _verifyProbe', () => set(ref(db, `_verifyProbe/${Date.now()}`), { at: Date.now() }))
  await expectDenied('Unauthenticated write to rfidUsers', () => set(push(ref(db, 'rfidUsers')), { name: 'x', rfidId: `TEST-${Date.now()}` }))
  await expectDenied('Unauthenticated upload to Storage', () => uploadBytes(storageRef(storage, `vehicle-snapshots/_verify/${Date.now()}.png`), testBytes(), { contentType: 'image/png' }))

  if (!email || !password) {
    console.log('\n(Skipping authenticated checks - set IGATE_TEST_EMAIL/IGATE_TEST_PASSWORD, or pass --email/--password, for a real Firebase Auth account.)')
  } else {
    console.log('\nAuthenticated checks:')
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid
      record('Sign in with provided Firebase Auth account', true, uid)

      const profileSnap = await get(ref(db, `adminProfiles/${uid}`))
      const role = profileSnap.exists() ? profileSnap.val().role : null
      const isAdmin = ADMIN_ROLES.includes(role)
      console.log(`  -> signed-in role: ${role || '(no adminProfiles record found)'} (isAdmin=${isAdmin})\n`)

      await expectAllowed('Read own adminProfiles/{uid}', async () => `role: ${role}`)

      await expectDenied('Read entire adminProfiles tree (should be scoped to owner only)', () => get(ref(db, 'adminProfiles')))

      let gateLogKey = null
      await expectAllowed('Create a NEW gateLogs entry (any authenticated role)', async () => {
        const newRef = push(ref(db, 'gateLogs'))
        await set(newRef, { cardId: 'TEST-CARD', cardHex: 'DEADBEEF', direction: 'IN', source: 'verify-script', timestamp: Date.now() })
        gateLogKey = newRef.key
        return gateLogKey
      })

      if (gateLogKey) {
        await expectAllowed('Attach imageUrl to an EXISTING gateLogs entry (any authenticated role)', () =>
          set(ref(db, `gateLogs/${gateLogKey}/imageUrl`), 'https://example.com/test.png')
        )
        // Phase 9: core fields (direction/cardId/cardHex/timestamp/source) of an EXISTING
        // gateLogs entry are now admin-only - see database.rules.json.
        await expectAllowedIfAdmin(isAdmin, 'Change direction on an EXISTING gateLogs entry', () =>
          set(ref(db, `gateLogs/${gateLogKey}/direction`), 'OUT')
        )
        // Deleting an existing entry is admin-only; a non-admin run will correctly fail
        // to clean this up (rules working as intended) - delete TEST-CARD entries
        // manually via an admin account/the console afterward if that happens.
        await expectAllowedIfAdmin(isAdmin, 'Delete an EXISTING gateLogs entry', () => remove(ref(db, `gateLogs/${gateLogKey}`)))
      }

      let rfidKey = null
      const originalRfidId = `TEST-${Date.now()}`
      await expectAllowed('Create a NEW rfidUser (any authenticated role)', async () => {
        const newRef = push(ref(db, 'rfidUsers'))
        await set(newRef, { name: 'Test Seed User', rfidId: originalRfidId, plateNumber: 'TEST-0000', vehicleType: 'Car', department: 'BSIT', role: 'Student', status: 'Active', email: '', phone: '', createdAt: Date.now() })
        rfidKey = newRef.key
        return rfidKey
      })

      if (rfidKey) {
        await expectAllowed('Any authenticated role can update a non-identity field (department) on an EXISTING rfidUser', () =>
          set(ref(db, `rfidUsers/${rfidKey}/department`), 'BSCS')
        )
        // Phase 9: reassigning an EXISTING rfidUser's rfidId (which physical card it's
        // bound to) is now admin-only - see database.rules.json.
        await expectAllowedIfAdmin(isAdmin, 'Reassign rfidId on an EXISTING rfidUser', () =>
          set(ref(db, `rfidUsers/${rfidKey}/rfidId`), `${originalRfidId}-REASSIGNED`)
        )
        await expectAllowedIfAdmin(isAdmin, 'Change rfidUser status (deactivate)', () => set(ref(db, `rfidUsers/${rfidKey}/status`), 'Inactive'))
        await expectDenied('Schema validation: malformed email on rfidUser is rejected', () => set(ref(db, `rfidUsers/${rfidKey}/email`), 'not-an-email'))
        await expectDenied('Schema validation: malformed phone on rfidUser is rejected', () => set(ref(db, `rfidUsers/${rfidKey}/phone`), '12345'))
        await expectAllowedIfAdmin(isAdmin, 'Delete an rfidUser', () => remove(ref(db, `rfidUsers/${rfidKey}`)))
      }

      await expectDenied('Schema validation: rfidUser missing required "name" is rejected', () =>
        set(push(ref(db, 'rfidUsers')), { rfidId: `TEST-${Date.now()}` })
      )

      await expectDenied('Schema validation: adminProfiles role outside the enum ("Staff") is rejected', () =>
        set(ref(db, `adminProfiles/${uid}/role`), 'Staff')
      )

      // Phase 9: settings/app (appName/campus/status/createdAt) is now admin-only,
      // but gateStatus is deliberately carved out - Security Guards must retain the
      // ability to trigger the manual barrier-gate override from the Dashboard
      // (Phase 6, existing/working functionality this phase must not break).
      await expectAllowedIfAdmin(isAdmin, 'Write settings/app/campus (general app settings)', () =>
        set(ref(db, 'settings/app/campus'), 'Bustos Campus')
      )
      await expectAllowed('Write settings/app/gateStatus (any authenticated role - Phase 6 guard override)', () =>
        set(ref(db, 'settings/app/gateStatus'), { state: 'CLOSED', updatedAt: Date.now(), updatedBy: uid, updatedByName: email })
      )

      // Phase 9: payments are append-only for non-admins - create is fine, modifying/
      // deleting an EXISTING payment record is admin-only.
      let paymentKey = null
      await expectAllowed('Create a NEW payment record (any authenticated role)', async () => {
        const newRef = push(ref(db, 'payments'))
        await set(newRef, { rfidId: originalRfidId, amount: 1, name: 'verify-script', status: 'Paid', timestamp: Date.now() })
        paymentKey = newRef.key
        return paymentKey
      })
      if (paymentKey) {
        await expectAllowedIfAdmin(isAdmin, 'Modify an EXISTING payment record', () => set(ref(db, `payments/${paymentKey}/amount`), 2))
        await expectAllowedIfAdmin(isAdmin, 'Delete an EXISTING payment record', () => remove(ref(db, `payments/${paymentKey}`)))
      }

      const imgPath = `vehicle-snapshots/_verify/${Date.now()}.png`
      await expectAllowed('Authenticated upload of a valid image to Storage', async () => {
        await uploadBytes(storageRef(storage, imgPath), testBytes(), { contentType: 'image/png' })
        const url = await getDownloadURL(storageRef(storage, imgPath))
        return url.slice(0, 60) + '...'
      })
      await deleteObject(storageRef(storage, imgPath)).catch(() => {})

      await expectDenied('Storage rule rejects a non-image content type', () =>
        uploadBytes(storageRef(storage, `vehicle-snapshots/_verify/${Date.now()}.txt`), new TextEncoder().encode('hi'), { contentType: 'text/plain' })
      )

      await signOut(auth)
    } catch (err) {
      record('Sign in with provided Firebase Auth account', false, err.code || err.message)
    }
  }

  console.log('\n--- Summary ---')
  const flagged = results.filter((r) => !r.pass)
  console.log(`${results.length - flagged.length}/${results.length} checks passed`)
  if (flagged.length) {
    console.log('Flagged (review these):')
    flagged.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`))
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('Unexpected error', err)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode || 0))
