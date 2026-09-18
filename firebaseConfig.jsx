import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBZu4k2AhVfowjQWPbHuG36jx6e_mT8Bhk",
  authDomain: "remoteswitch-4d853.firebaseapp.com",
  projectId: "remoteswitch-4d853",
  storageBucket: "remoteswitch-4d853.firebasestorage.app",
  messagingSenderId: "448900416802",
  appId: "1:448900416802:web:47378f7a103a5430cd517b",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

export {
  app,
  auth,
  db,
};

export default app;
