// =========================================================
// مساعد FCM — التسجيل وحفظ التوكن في Firestore
// =========================================================
import { app } from "./firebase-config.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";
import { db } from "./firebase-config.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ─────────────────────────────────────────────────────────
// ★ ضع هنا مفتاح VAPID من Firebase Console:
//   Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
// ─────────────────────────────────────────────────────────
const VAPID_KEY = "BMDBwMIwOXtJ9XHPfs3n2IkWaioythnsSb_0VQ4EpkNHi-e5LeoOoF7oEpeHtn0s74w-28oymxsAGqy3ov9JKxg";
// ─────────────────────────────────────────────────────────

let _messaging = null;

function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

/**
 * سجّل هذا الجهاز لاستقبال إشعارات FCM واحفظ التوكن في Firestore.
 * @param {{ type: "nurse"|"cafeteria", dept?: string, name?: string }} meta
 */
export async function registerFCM(meta) {
  if (!("serviceWorker" in navigator)) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "denied") return;

  if (VAPID_KEY === "PASTE_YOUR_VAPID_KEY_HERE") {
    console.warn("FCM: لم يتم تعيين مفتاح VAPID — إشعارات الخلفية معطّلة.");
    return;
  }

  try {
    // تسجيل الـ Service Worker
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // طلب الإذن إذا لم يُمنح بعد
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // الحصول على توكن FCM
    const token = await getToken(getMsg(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return;

    // حفظ/تحديث التوكن في Firestore (التوكن نفسه كمعرّف للمستند)
    await setDoc(doc(db, "fcmTokens", token), {
      ...meta,
      token,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log("FCM ✓ تم تسجيل الجهاز");
  } catch (err) {
    console.warn("FCM:", err.message);
  }
}

/**
 * استمع للإشعارات والصفحة مفتوحة أمام المستخدم.
 * @param {(payload: object) => void} callback
 */
export function listenForeground(callback) {
  return onMessage(getMsg(), callback);
}

