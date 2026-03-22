import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configurações do Firebase via variáveis de ambiente (VITE_)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Só inicializa se a API Key estiver presente e parecer válida
let app;
let auth: any = null;
let db: any = null;

const isValidKey = (key: string | undefined) => {
  return key && key.trim() !== "" && key.length > 20 && !key.includes('TODO');
};

if (isValidKey(firebaseConfig.apiKey)) {
  console.log("Firebase: Tentando inicializar com a chave fornecida...");
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase: Inicializado com sucesso.");
  } catch (error) {
    console.error("Firebase: Erro ao inicializar:", error);
  }
} else {
  console.log("Firebase: Chave API não encontrada ou inválida. Usando modo offline (fallback).");
}

export { auth, db };
export default app;
