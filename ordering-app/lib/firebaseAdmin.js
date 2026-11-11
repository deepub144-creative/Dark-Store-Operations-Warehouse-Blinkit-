import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp() {
  try {
    if (getApps().length) return getApps()[0];

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } catch (err) {
    console.warn("[FirebaseAdmin] Initialization warning:", err?.message);
    return null;
  }
}

let adminDbInstance = null;
let adminAuthInstance = null;

try {
  const adminApp = getAdminApp();
  if (adminApp) {
    adminDbInstance = getFirestore(adminApp);
    adminAuthInstance = getAuth(adminApp);
  }
} catch (e) {
  console.warn("[FirebaseAdmin] Service binding warning:", e?.message);
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;
