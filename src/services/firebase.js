// Firebase v9 modular SDK setup
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// TODO: replace with your Firebase project values
const firebaseConfig = {
  apiKey: "AIzaSyCiUx-CAXk45UrgEGW99fbIO2rOJ84-B7o",
  authDomain: "igate-bulsu.firebaseapp.com",
  projectId: "igate-bulsu",
  storageBucket: "igate-bulsu.firebasestorage.app",
  messagingSenderId: "508714511794",
  appId: "1:508714511794:web:a49e0321bbd560e2db08ab",
  measurementId: "G-LK68HMZQPW"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
