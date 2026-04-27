import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function hasFirebaseConfig() {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId
  );
}

let app = null;
let db = null;

function getDb() {
  if (db) return db;
  if (typeof window === "undefined") return null;
  if (!hasFirebaseConfig()) return null;

  const config = getFirebaseConfig();
  app = getApps().length ? getApp() : initializeApp(config);
  db = getFirestore(app);
  return db;
}

export { app, hasFirebaseConfig, getDb };
