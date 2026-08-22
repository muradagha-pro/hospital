// =========================================================
// Service Worker لاستقبال الإشعارات في الخلفية (FCM)
// يجب أن يبقى هذا الملف في المجلد الجذر للموقع
// =========================================================

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDV1L928RdA2ZPkV_qj-cHH6RGwu8zAJSQ",
  authDomain: "al-hourani.firebaseapp.com",
  projectId: "al-hourani",
  storageBucket: "al-hourani.firebasestorage.app",
  messagingSenderId: "24757167329",
  appId: "1:24757167329:web:af1f328be01a588024c3a0",
});

const messaging = firebase.messaging();

// الإشعارات التي تصل والصفحة مغلقة أو في الخلفية
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "تنبيه جديد";
  const body  = payload.notification?.body  || "";
  const tag   = payload.data?.tag || "alert";

  self.registration.showNotification(title, {
    body,
    tag,
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true, // يبقى التنبيه حتى يُغلق يدوياً
  });
});

