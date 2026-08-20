// =========================================================
// إعدادات Firebase
// عبّي القيم اللي بتاخدها من Firebase Console هون تحت
// (اشرحلك بالتفصيل بملف README.md وين تلاقي هاي القيم)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDbgQyBOdGD2a49rvqaqaJH8INEckJUVN8",
  authDomain: "hospital-4bf1c.firebaseapp.com",
  projectId: "hospital-4bf1c",
  storageBucket: "hospital-4bf1c.firebasestorage.app",
  messagingSenderId: "414275679868",
  appId: "1:414275679868:web:f08ceb71b29ce2eb9efbf9",
  measurementId: "G-FZT78HSN77"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
