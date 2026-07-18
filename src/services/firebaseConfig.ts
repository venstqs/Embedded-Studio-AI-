import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// Only initialize Firebase if real (non-placeholder) env keys are provided.
// This prevents console errors when Firebase is not configured.
const isFirebaseConfigured =
  import.meta.env.VITE_FIREBASE_API_KEY &&
  typeof import.meta.env.VITE_FIREBASE_API_KEY === 'string' &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith('your_');

let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseApp: FirebaseApp | null = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
}

export { db, auth, firebaseApp };
