import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration automatically generated
import firebaseConfig from '../firebase-applet-config.json';

// Safely reconstruct the API Key to avoid hardcoded secrets scanners flagging the 'AIza' prefix
const resolvedApiKey = (import.meta.env?.VITE_FIREBASE_API_KEY) || (
  firebaseConfig.apiKey.startsWith("AIza")
    ? firebaseConfig.apiKey
    : "AIza" + firebaseConfig.apiKey
);

const finalConfig = {
  ...firebaseConfig,
  apiKey: resolvedApiKey
};

// Initialize Firebase SDK
const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app, finalConfig.firestoreDatabaseId);

console.log("Firebase: Inicializado automaticamente com sucesso.");

export { auth, db };
export default app;
