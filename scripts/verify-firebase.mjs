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

import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getDatabase, ref, set, get, remove, push } from 'firebase/database'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

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

      await expectAllowed('Read own adminProfiles/{uid}', async () => {
        const snap = await get(ref(db, `adminProfiles/${uid}`))
        return snap.exists() ? `role: ${snap.val().role}` : 'no profile found for this uid'
      })

      await expectDenied('Read entire adminProfiles tree (should be scoped to owner only)', () => get(ref(db, 'adminProfiles')))

      let gateLogKey = null
      await expectAllowed('Authenticated write to gateLogs', async () => {
        const newRef = push(ref(db, 'gateLogs'))
        await set(newRef, { cardId: 'TEST-CARD', cardHex: 'DEADBEEF', source: 'verify-script', timestamp: Date.now() })
        gateLogKey = newRef.key
        return gateLogKey
      })
      if (gateLogKey) await remove(ref(db, `gateLogs/${gateLogKey}`)).catch(() => {})

      let rfidKey = null
      await expectAllowed('Authenticated write of a VALID rfidUser (create)', async () => {
        const newRef = push(ref(db, 'rfidUsers'))
        await set(newRef, { name: 'Test Seed User', rfidId: `TEST-${Date.now()}`, plateNumber: 'TEST-0000', vehicleType: 'Car', department: 'BSIT', role: 'Student', status: 'Active', email: '', createdAt: Date.now() })
        rfidKey = newRef.key
        return rfidKey
      })

      if (rfidKey) {
        await expectAllowed('Admin can change rfidUser status (deactivate)', () => set(ref(db, `rfidUsers/${rfidKey}/status`), 'Inactive'))
        await expectDenied('Schema validation: malformed email on rfidUser is rejected', () => set(ref(db, `rfidUsers/${rfidKey}/email`), 'not-an-email'))
        await expectAllowed('Admin can delete an rfidUser', () => remove(ref(db, `rfidUsers/${rfidKey}`)))
      }

      await expectDenied('Schema validation: rfidUser missing required "name" is rejected', () =>
        set(push(ref(db, 'rfidUsers')), { rfidId: `TEST-${Date.now()}` })
      )

      await expectDenied('Schema validation: adminProfiles role outside the enum ("Staff") is rejected', () =>
        set(ref(db, `adminProfiles/${uid}/role`), 'Staff')
      )

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
