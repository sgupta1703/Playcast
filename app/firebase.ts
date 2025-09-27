import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5Piwh3dJBbYmBb7aePaIg84xBdF_8VP0",
  authDomain: "try1-8fb5e.firebaseapp.com",
  projectId: "try1-8fb5e",
  storageBucket: "try1-8fb5e.firebasestorage.app",
  messagingSenderId: "829704519879",
  appId: "1:829704519879:web:f5a6032163b09c11f9fee2",
  measurementId: "G-377HQ0YHF1",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
