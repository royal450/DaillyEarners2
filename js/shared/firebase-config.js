// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBuioOF7DCq-qIoa1D6ZyZbrAVeGjbfv3Y",
  authDomain: "daily-campaign-king.firebaseapp.com",
  databaseURL: "https://daily-campaign-king-default-rtdb.firebaseio.com",
  projectId: "daily-campaign-king",
  storageBucket: "daily-campaign-king.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with 1-year persistence
const auth = getAuth(app);

// Set persistence to local (persists even when browser is closed)
// This ensures user stays logged in for 1 year unless they manually logout
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Persistence error:', error);
});

// Initialize Firebase Realtime Database
const database = getDatabase(app);

// Database root path
const DB_ROOT = 'CASHBYKING_ALL_DATA';

// Export instances
export { app, auth, database, DB_ROOT };
