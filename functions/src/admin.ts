import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const storage = getStorage();
export const FieldValueRef = FieldValue;
export const TimestampRef = Timestamp;

export const collections = {
  users: 'users',
  sessions: 'sessions',
  lessons: 'lessons',
  scenarios: 'scenarios',
  aiProviders: 'aiProviders',
  usage: 'usage'
} as const;
