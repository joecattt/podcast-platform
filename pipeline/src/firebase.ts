// Firebase Admin init — runs in Cloud Run with ADC (Application Default Credentials).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';

export const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.firebaseProjectId,
  storageBucket: config.storageBucket,
});

export const db = getFirestore(app);
export const bucket = getStorage(app).bucket();
export const auth = getAuth(app);
