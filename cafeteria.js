import { db } from "./firebase-config.js";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { registerFCM } from "./fcm-helper.js";

// ── DOM ──
const tabCurrent      = document.getElementById("tabCurrent");
const tabDone         = document.getElementById("tabDone");
const ordersList      = document.getElementById("ordersList");
const ordersEmpty     = document.getElementById("ordersEmpty");
const soundHint       = document.getElementById("soundHint");
const notifyBtn       = document.getElementById("notifyBtn");
const notifyBanner    = document.getElementById("notifyBanner");
const alertModeSelect = document.getElementById("alertModeSelect");

// ── state ──
const ALERT_MODE_KEY = "cafeAlertMode";
let alertMode  = localStorage.getItem(ALERT_MODE_KEY) || "full";
let activeTab  = "current";
let allOrders  = [];
let knownOrderIds = new Set();
let audioCtx   = null;
let audioUnlocked = false;
let alarmTimer = null;
let wakeLock   = null;

alertModeSelect.value = alertMode;
alertModeSelect.addEventListener("change", () => {
  alertMode = alertModeSelect.value;
  localStorage.setItem(ALERT_MODE_KEY, alertMode);
});

// ─────────────────────────────────────────────
// Wake Lock — يمنع الشاشة من النوم
// ─────────────────────────────────────────────
async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (e) {
    console.warn("Wake Lock:", e);
  }
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (!wakeLock) await requestWakeLock();
  }
});

requestWakeLock();

// ─────────────────────────────────────────────
// Audio — يُفعَّل بأول لمسة
// ─────────────────────────────────────────────
// تسجيل FCM عند أول تفاعل (لضمان فتح AudioContext + FCM معاً)
function unlockAudio() {
  if (audioUnlocked) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioUnlocked = true;
    soundHint.style.display = "none";
  } catch (e) {
    console.warn("Audio:", e);
  }
  // نسجّل FCM بعد أول لمسة لأن الإذن يحتاج تفاعل المستخدم
  registerFCM({ type: "cafeteria" });
}

["click", "touchstart", "keydown"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});

soundHint.style.display = "block";

function playBeep() {
  if (alertMode !== "full" || !audioCtx) return;
  [880, 1046].forEach((freq, i) => {
    setTimeout(() => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }, i * 220);
  });
}

function vibrateAlert() {
  if (alertMode === "off") return;
  if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]);
}

function startAlarm() {
  if (alarmTimer) return;
  playBeep();
  vibrateAlert();
  alarmTimer = setInterval(() => { playBeep(); vibrateAlert(); }, 4000);
}

function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = null;
  if ("vibrate" in navigator) navigator.vibrate(0);
}

// ─────────────────────────────────────────────
// إشعارات المتصفح
// ─────────────────────────────────────────────
notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("هذا المتصفح لا يدعم الإشعارات");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    notifyBanner.style.display = "block";
    notifyBtn.textContent = "الإشعارات مفعّلة ✓";
    notifyBtn.disabled = true;
    new Notification("تم تفعيل إشعارات لوحة الكافتيريا ✓");
  } else {
    alert("لم يتم منح إذن الإشعارات. فعّلها من إعدادات المتصفح.");
  }
});

if (typeof Notification !== "undefined" && Notification.permission === "granted") {
  notifyBtn.textContent = "الإشعارات مفعّلة ✓";
  notifyBtn.disabled = true;
}

function maybeSendNotification(room) {
  if (alertMode === "off") return;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("طلب كافتيريا جديد 🍽️", {
      body: `غرفة ${room} أرسلت طلباً`,
      tag: `cafe-${room}-${Date.now()}`,
    });
  }
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────
tabCurrent.addEventListener("click", () => {
  activeTab = "current";
  tabCurrent.classList.add("active");
  tabDone.classList.remove("active");
  renderOrders();
});

tabDone.addEventListener("click", () => {
  activeTab = "done";
  tabDone.classList.add("active");
  tabCurrent.classList.remove("active");
  renderOrders();
});

// ─────────────────────────────────────────────
// Firestore listener
// ─────────────────────────────────────────────
listenForOrders();

function listenForOrders() {
  const q = query(
    collection(db, "cafeteriaOrders"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    allOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // detect new "new" orders not seen before
    allOrders.forEach((o) => {
      if (o.status === "new" && !knownOrderIds.has(o.id)) {
        maybeSendNotification(o.room);
      }
      knownOrderIds.add(o.id);
    });

    // alarm if any "new" orders still pending
    const pendingCount = allOrders.filter((o) => o.status === "new").length;
    if (pendingCount > 0) startAlarm();
    else stopAlarm();

    renderOrders();
  }, (err) => {
    console.error(err);
    ordersList.innerHTML = "";
    ordersEmpty.style.display = "block";
    ordersEmpty.textContent = "تعذر تحميل الطلبات حالياً";
  });
}

// ─────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────
function renderOrders() {
  ordersList.innerHTML = "";

  const items = allOrders.filter((o) => {
    if (activeTab === "current") return o.status === "new" || o.status === "preparing";
    if (o.status !== "done") return false;
    if (!o.doneAt || typeof o.doneAt.toDate !== "function") return false;
    const d = o.doneAt.toDate();
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  });

  if (items.length === 0) {
    ordersEmpty.style.display = "block";
    ordersEmpty.textContent = activeTab === "current"
      ? "لا توجد طلبات حالية"
      : "لا توجد طلبات منتهية اليوم";
    return;
  }

  ordersEmpty.style.display = "none";
  items.forEach((order) => ordersList.appendChild(buildOrderCard(order)));
}

function buildOrderCard(order) {
  const card = document.createElement("div");
  card.className = "request-card";
  card.style.marginBottom = "10px";

  const createdAt    = formatTime(order.createdAt);
  const itemSummary  = Array.isArray(order.items)
    ? order.items.map((i) => `${i.name} x${i.qty}`).join("، ")
    : "--";

  const badgeClass = order.status === "new" ? "sent"
    : order.status === "preparing" ? "received" : "done";
  const badgeText  = order.status === "done" ? "تم التسليم"
    : order.status === "preparing" ? "قيد التحضير" : "طلب جديد";

  card.innerHTML = `
    <div>
      <div class="request-room">غرفة ${escapeHtml(String(order.room || ""))}</div>
      <div class="request-meta">
        <span class="badge ${badgeClass}">${badgeText}</span>
        &nbsp;·&nbsp;${createdAt}
      </div>
      <div class="request-meta" style="margin-top:6px;">${escapeHtml(itemSummary)}</div>
      <div class="request-meta" style="margin-top:4px; font-weight:700; color:var(--teal-dark);">
        الإجمالي: ${Number(order.total || 0).toFixed(2)} ل.س
      </div>
      ${order.note ? `<div class="detail-note" style="margin-top:8px;">${escapeHtml(order.note)}</div>` : ""}
    </div>
  `;

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;";

  if (activeTab === "current") {
    if (order.status === "new") {
      const btn = document.createElement("button");
      btn.className = "action-btn";
      btn.textContent = "بدء التحضير";
      btn.onclick = () => markPreparing(order.id);
      actions.appendChild(btn);
    }
    if (order.status === "preparing") {
      const btn = document.createElement("button");
      btn.className = "action-btn done-btn";
      btn.textContent = "تم التسليم";
      btn.onclick = () => markDone(order.id);
      actions.appendChild(btn);
    }
  }

  card.appendChild(actions);
  return card;
}

async function markPreparing(id) {
  try {
    await updateDoc(doc(db, "cafeteriaOrders", id), {
      status: "preparing", receivedAt: serverTimestamp()
    });
  } catch (err) { console.error(err); alert("تعذر تحديث الطلب"); }
}

async function markDone(id) {
  try {
    await updateDoc(doc(db, "cafeteriaOrders", id), {
      status: "done", doneAt: serverTimestamp()
    });
  } catch (err) { console.error(err); alert("تعذر تحديث الطلب"); }
}

function formatTime(ts) {
  if (!ts || typeof ts.toDate !== "function") return "--";
  return ts.toDate().toLocaleString("ar", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
