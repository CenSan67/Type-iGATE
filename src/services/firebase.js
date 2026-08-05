// Firebase v9 modular SDK setup
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, set, push, get, onValue } from 'firebase/database'

// TODO: replace with your Firebase project values
const firebaseConfig = {
  apiKey: "AIzaSyCiUx-CAXk45UrgEGW99fbIO2rOJ84-B7o",
  authDomain: "igate-bulsu.firebaseapp.com",
  databaseURL: "https://igate-bulsu-default-rtdb.firebaseio.com",
  projectId: "igate-bulsu",
  storageBucket: "igate-bulsu.firebasestorage.app",
  messagingSenderId: "508714511794",
  appId: "1:508714511794:web:a49e0321bbd560e2db08ab",
  measurementId: "G-LK68HMZQPW"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const rtdb = getDatabase(app)

export async function initializeFirebaseCollections() {
  try {
    await Promise.all([
      set(ref(rtdb, 'settings/app'), {
        appName: 'iGATE',
        campus: 'Bustos Campus',
        status: 'active',
        createdAt: Date.now()
      }),
      set(ref(rtdb, 'users/system'), {
        role: 'system',
        displayName: 'System',
        status: 'active',
        createdAt: Date.now()
      })
    ])
  } catch (error) {
    console.error('Failed to initialize Firebase collections', error)
  }
}

export async function logGateEntry({ cardId, cardHex, source = 'unknown', notes = '' }) {
  const entryRef = push(ref(rtdb, 'gateLogs'))
  await set(entryRef, {
    cardId,
    cardHex,
    source,
    notes,
    timestamp: Date.now()
  })

  return entryRef.key
}

export async function registerRfidUser({ name, rfidId, plateNumber, vehicleType, department, role }) {
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existingUsers = snapshot.exists() ? Object.values(snapshot.val() || {}) : []

  if (existingUsers.some((user) => user.rfidId === rfidId)) {
    throw new Error('This RFID ID is already registered.')
  }

  const newUserRef = push(usersRef)
  await set(newUserRef, {
    name,
    rfidId,
    plateNumber,
    vehicleType,
    department,
    role,
    createdAt: Date.now()
  })

  return newUserRef.key
}

// Used by the Payment flow: a successful payment registers the card if it's new,
// or refreshes its details if it's a renewal — unlike registerRfidUser, it never
// throws on an existing RFID since renewals are expected to already be registered.
export async function upsertRfidUser({ rfidId, name, department, plateNumber, vehicleType, role }) {
  const usersRef = ref(rtdb, 'rfidUsers')
  const snapshot = await get(usersRef)
  const existing = snapshot.exists() ? Object.entries(snapshot.val() || {}) : []
  const match = existing.find(([, value]) => (value.rfidId || '').toString().toLowerCase() === (rfidId || '').toString().toLowerCase())

  if (match) {
    const [id, value] = match
    await set(ref(rtdb, `rfidUsers/${id}`), {
      ...value,
      name: name || value.name,
      department: department || value.department,
      plateNumber: plateNumber || value.plateNumber,
      vehicleType: vehicleType || value.vehicleType,
      role: role || value.role,
    })
    return id
  }

  const newUserRef = push(usersRef)
  await set(newUserRef, {
    name,
    rfidId,
    plateNumber,
    vehicleType,
    department,
    role,
    createdAt: Date.now()
  })

  return newUserRef.key
}

export async function getRfidUsers() {
  const snapshot = await get(ref(rtdb, 'rfidUsers'))
  if (!snapshot.exists()) return []
  return Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
}

export function listenToGateLogs(callback) {
  return onValue(ref(rtdb, 'gateLogs'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const entries = Object.entries(snapshot.val() || {}).map(([id, value]) => ({
      id,
      ...value,
      timestamp: value.timestamp || Date.now()
    }))

    callback(entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  })
}

export function listenToRfidUsers(callback) {
  return onValue(ref(rtdb, 'rfidUsers'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const users = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
    callback(users)
  })
}

export async function recordPayment({ rfidId, name, department, plateNumber, paymentType, amount, status = 'Paid', date, time, validUntil }) {
  const paymentRef = push(ref(rtdb, 'payments'))
  await set(paymentRef, {
    rfidId,
    name,
    department,
    plateNumber,
    paymentType,
    amount,
    status,
    date,
    time,
    validUntil,
    timestamp: Date.now()
  })

  return paymentRef.key
}

export function listenToPayments(callback) {
  return onValue(ref(rtdb, 'payments'), (snapshot) => {
    if (!snapshot.exists()) {
      callback([])
      return
    }

    const payments = Object.entries(snapshot.val() || {}).map(([id, value]) => ({ id, ...value }))
    callback(payments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
  })
}

export async function saveAdminProfile(uid, profile) {
  await set(ref(rtdb, `adminProfiles/${uid}`), profile)
}

export function listenToAdminProfile(uid, callback) {
  return onValue(ref(rtdb, `adminProfiles/${uid}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null)
  })
}

export default app
