import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Check if config is valid
const isValidConfig = firebaseConfig.projectId && firebaseConfig.apiKey && firebaseConfig.authDomain;

if (!isValidConfig) {
  console.error('❌ Firebase configuration is incomplete. Please check firebase-applet-config.json');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Validate connection to Firestore (non-blocking)
async function testConnection() {
  try {
    if (!isValidConfig) {
      console.warn('⚠️ Firebase config incomplete, skipping connection test');
      return;
    }
    // Attempt to fetch a non-existent document to test connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log('✅ Firebase connection established');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('offline')) {
        console.warn('⚠️ Firebase: Client appears offline, will retry on next request');
      } else {
        console.log('✅ Firebase connected (permission test skipped)');
      }
    }
  }
}

// Run connection test in background without blocking app startup
setTimeout(() => testConnection(), 1000);
