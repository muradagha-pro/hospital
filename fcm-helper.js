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
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ─────────────────────────────────────────────────────────
// ★ ضع هنا مفتاح VAPID من Firebase Console:
//   Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
// ─────────────────────────────────────────────────────────
const VAPID_KEY = "BMDBwMIwOXtJ9XHPfs3n2IkWaioythnsSb_0VQ4EpkNHi-e5LeoOoF7oEpeHtn0s74w-28oymxsAGqy3ov9JKxg";
// ─────────────────────────────────────────────────────────

let _messaging = null;
const DEVICE_ID_KEY = "fcmDeviceId";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

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
  if (Notification.permission === "denied") return { permission: "denied", tokenSaved: false };

  if (VAPID_KEY === "PASTE_YOUR_VAPID_KEY_HERE") {
    console.warn("FCM: لم يتم تعيين مفتاح VAPID — إشعارات الخلفية معطّلة.");
    return { permission: "unsupported", tokenSaved: false };
  }

  try {
    // تسجيل الـ Service Worker
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // طلب الإذن إذا لم يُمنح بعد
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { permission, tokenSaved: false };
    }

    // الحصول على توكن FCM
    const token = await getToken(getMsg(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return { permission, tokenSaved: false };

    // حفظ/تحديث التوكن في Firestore (التوكن نفسه كمعرّف للمستند)
    const deviceId = getDeviceId();

    await setDoc(doc(db, "fcmTokens", token), {
      ...meta,
      deviceId,
      token,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // نظّف أي توكنات قديمة لنفس الجهاز/السياق لتفادي تنبيهات مكررة.
    const filters = [
      where("type", "==", meta.type),
      where("deviceId", "==", deviceId),
    ];
    if (meta.dept) filters.push(where("dept", "==", meta.dept));
    if (meta.name) filters.push(where("name", "==", meta.name));

    const sameContext = await getDocs(query(collection(db, "fcmTokens"), ...filters));
    const stale = sameContext.docs.filter((d) => d.id !== token);
    await Promise.all(stale.map((d) => deleteDoc(doc(db, "fcmTokens", d.id))));

    console.log("FCM ✓ تم تسجيل الجهاز");
    return { permission, tokenSaved: true };
  } catch (err) {
    console.warn("FCM:", err.message);
    return { permission: Notification.permission || "default", tokenSaved: false };
  }
}

/**
 * استمع للإشعارات والصفحة مفتوحة أمام المستخدم.
 * @param {(payload: object) => void} callback
 */
export function listenForeground(callback) {
  return onMessage(getMsg(), callback);
}

