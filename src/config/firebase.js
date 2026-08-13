import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCW6LOksNZml7rPKuJXFfo7BEhMn4goA7g",
  authDomain: "editor-4348c.firebaseapp.com",
  databaseURL: "https://editor-4348c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "editor-4348c",
  storageBucket: "editor-4348c.firebasestorage.app",
  messagingSenderId: "815734080150",
  appId: "1:815734080150:web:d089cc5e4caaccfc1038b7",
  measurementId: "G-PWW2CZC8Z2"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
