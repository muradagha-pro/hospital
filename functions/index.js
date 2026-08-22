// =========================================================
// Firebase Cloud Functions — إشعارات FCM عند الطلبات الجديدة
// =========================================================
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

// ─────────────────────────────────────────────
// مساعد: جلب توكنات FCM حسب النوع والقسم
// ─────────────────────────────────────────────
async function getTokens(type, dept) {
  let q = db.collection("fcmTokens").where("type", "==", type);
  if (dept) q = q.where("dept", "==", dept);

  const snap = await q.get();
  return snap.docs.map((d) => d.data().token).filter(Boolean);
}

// ─────────────────────────────────────────────
// مساعد: إرسال إشعار FCM
// ─────────────────────────────────────────────
async function sendPush(tokens, title, body, data = {}) {
  if (tokens.length === 0) {
    console.log("FCM: لا توجد توكنات مسجّلة");
    return;
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: "high" },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", badge: 1 } },
    },
  });

  console.log(`FCM: ${response.successCount}/${tokens.length} نجح`);

  // احذف التوكنات المنتهية الصلاحية تلقائياً
  const stale = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      stale.push(tokens[i]);
    }
  });

  if (stale.length > 0) {
    const batch = db.batch();
    stale.forEach((t) => batch.delete(db.collection("fcmTokens").doc(t)));
    await batch.commit();
    console.log(`FCM: حُذفت ${stale.length} توكن منتهية`);
  }
}

// ─────────────────────────────────────────────
// عند إنشاء طلب استدعاء ممرضة جديد
// ─────────────────────────────────────────────
exports.onNewCallRequest = onDocumentCreated(
  "callRequests/{requestId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "sent") return;

    const { department, room, departmentName } = data;
    const tokens = await getTokens("nurse", department);

    await sendPush(
      tokens,
      "استدعاء ممرضة جديد 🔔",
      `غرفة ${room} — ${departmentName || department}`,
      { tag: `nurse-${department}-${room}`, type: "callRequest", dept: department }
    );
  }
);

// ─────────────────────────────────────────────
// عند إنشاء طلب كافتيريا جديد
// ─────────────────────────────────────────────
exports.onNewCafeteriaOrder = onDocumentCreated(
  "cafeteriaOrders/{orderId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== "new") return;

    const { room, total, items } = data;
    const tokens = await getTokens("cafeteria");

    const itemSummary = Array.isArray(items)
      ? items.slice(0, 2).map((i) => `${i.name} x${i.qty}`).join("، ")
      : "";

    const totalFormatted = Number(total || 0).toFixed(2);

    await sendPush(
      tokens,
      "طلب كافتيريا جديد 🍽️",
      `غرفة ${room} — ${totalFormatted} ل.س${itemSummary ? `\n${itemSummary}` : ""}`,
      { tag: `cafe-${room}`, type: "cafeteriaOrder", room: String(room) }
    );
  }
);

