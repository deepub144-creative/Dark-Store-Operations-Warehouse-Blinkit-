import { createRequire } from "module";

let adminDbInstance = null;
let adminAuthInstance = null;

try {
  const require = createRequire(import.meta.url);
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const { getAuth } = require("firebase-admin/auth");

  const apps = getApps();
  let adminApp = apps && apps.length > 0 ? apps[0] : null;

  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");

    if (projectId && clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
  }

  if (adminApp) {
    adminDbInstance = getFirestore(adminApp);
    adminAuthInstance = getAuth(adminApp);
  }
} catch (err) {
  console.warn("[FirebaseAdmin] Optional admin initialization fallback:", err?.message);
  adminDbInstance = null;
  adminAuthInstance = null;
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;

