import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

export const hasValidFirebaseClientConfig = Boolean(
  apiKey &&
    projectId &&
    !apiKey.includes("demo") &&
    !projectId.includes("demo")
);

let dbInstance = null;
let appInstance = null;

if (typeof window !== "undefined" && hasValidFirebaseClientConfig) {
  try {
    const firebaseConfig = {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    };
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance);
  } catch (e) {
    console.warn("Firebase client init skipped:", e?.message);
    dbInstance = null;
  }
}

export const db = dbInstance;
export default appInstance;
