// =========================================================
// إعدادات Firebase
// عبّي القيم اللي بتاخدها من Firebase Console هون تحت
// (اشرحلك بالتفصيل بملف README.md وين تلاقي هاي القيم)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDV1L928RdA2ZPkV_qj-cHH6RGwu8zAJSQ",
  authDomain: "al-hourani.firebaseapp.com",
  projectId: "al-hourani",
  storageBucket: "al-hourani.firebasestorage.app",
  messagingSenderId: "24757167329",
  appId: "1:24757167329:web:af1f328be01a588024c3a0"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
