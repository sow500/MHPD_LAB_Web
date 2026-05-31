import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REPLACE the values below with YOUR Firebase project config.
//  Firebase Console → Project Settings → General → Your apps
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const firebaseConfig = {
  apiKey:            "AIzaSyC-scw-LkRMTKbMQdrjW69InqSrmCXBOkQ",
  authDomain:        "mhpd-lab.firebaseapp.com",
  projectId:         "mhpd-lab",
  storageBucket:     "mhpd-lab.firebasestorage.app",
  messagingSenderId: "264473299139",
  appId:             "1:264473299139:web:055c0dbd05b9b0a9483a76",
  measurementId:     "G-JQ8QCRDL83"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
