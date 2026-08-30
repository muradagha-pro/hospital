import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, runTransaction, updateDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { departmentName, refreshDepartments } from "./departments.js";
import { registerFCM } from "./fcm-helper.js";

const loginCard = document.getElementById("loginCard");
const loginTitle = document.getElementById("loginTitle");
const loginSubtitle = document.getElementById("loginSubtitle");
const nameInput = document.getElementById("nameInput");
const nurseHeader = document.getElementById("nurseHeader");
const nurseNameEl = document.getElementById("nurseName");
const nurseDeptEl = document.getElementById("nurseDept");
const changeNameBtn = document.getElementById("changeNameBtn");
const requestList = document.getElementById("requestList");
const emptyState = document.getElementById("emptyState");
const alertModeSelect = document.getElementById("alertModeSelect");
const blinkModeSelect = document.getElementById("blinkModeSelect");
const notifyBtn = document.getElementById("notifyBtn");
const notifyBanner = document.getElementById("notifyBanner");
const soundHint = document.getElementById("soundHint");
const tabs = document.getElementById("tabs");
const tabCurrent = document.getElementById("tabCurrent");
const tabLog = document.getElementById("tabLog");
const logList = document.getElementById("logList");
const logEmptyState = document.getElementById("logEmptyState");
 
const NAME_KEY = "nurseName";
const DEPT_KEY = "nurseDept";
const ALERT_MODE_KEY = "nurseAlertMode"; // "full" | "vibrate" | "off"
const BLINK_MODE_KEY = "nurseBlinkMode"; // "soft" | "strong"
const DEFAULT_NURSE_NAME = "الممرضة المناوبة";

let myName = localStorage.getItem(NAME_KEY) || DEFAULT_NURSE_NAME;

// ── Wake Lock — يمنع الشاشة من النوم ──
let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch (e) {
    console.warn("Wake Lock:", e);
  }
}

requestWakeLock();

// -------- تحديد القسم: من رابط QR الخاص بمحطة القسم فقط --------
const urlParams = new URLSearchParams(window.location.search);
const deptFromUrl = urlParams.get("dept");
let myDept = deptFromUrl || localStorage.getItem(DEPT_KEY) || "";
 
let alertMode = localStorage.getItem(ALERT_MODE_KEY) || "full";
let blinkMode = localStorage.getItem(BLINK_MODE_KEY) || "strong";
let knownRequestIds = new Set();
let logUnsubscribe = null;
let currentUnsubscribe = null;
let audioUnlocked = false;
 
if (deptFromUrl) localStorage.setItem(DEPT_KEY, deptFromUrl);
if (!localStorage.getItem(NAME_KEY)) localStorage.setItem(NAME_KEY, myName);

if (myDept) {
  loginTitle.textContent = `تسجيل الدخول — قسم ${departmentName(myDept)}`;
  loginSubtitle.textContent = "جار فتح لوحة القسم...";
  if (nameInput) nameInput.style.display = "none";
  loginBtnVisible(false);
} else {
  loginTitle.textContent = "لم يتم التعرف على القسم";
  loginSubtitle.textContent = "الرجاء مسح رمز QR الخاص بمحطة قسمك لتسجيل الدخول.";
  if (nameInput) nameInput.style.display = "none";
  loginBtnVisible(false);
}
 
function loginBtnVisible(visible) {
  const btn = document.getElementById("loginBtn");
  if (btn) btn.style.display = visible ? "block" : "none";
}
 
// =====================================================================
// الصوت والاهتزاز
// =====================================================================
// ملاحظة مهمة: المتصفحات تمنع تشغيل الصوت تلقائياً قبل أي "لمسة" فعلية
// من المستخدم على الصفحة. لذلك نستمع لأول لمسة/ضغطة بأي مكان بالصفحة
// (مو بس زر الدخول) ونفتح مجرى الصوت فيها. هيك حتى لو الاسم محفوظ من
// قبل ودخلت الممرضة مباشرة على لوحتها، أول لمسة إلها بتفعّل الصوت.
let audioCtx = null;
 
function unlockAudio() {
  if (audioUnlocked) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    audioUnlocked = true;
    soundHint.style.display = "none";
  } catch (e) {
    console.warn("تعذر تفعيل الصوت", e);
  }
}
 
["click", "touchstart", "keydown"].forEach((evt) => {
  document.addEventListener(evt, unlockAudio, { once: true, passive: true });
});
 
// بعض المتصفحات بتوقف مجرى الصوت لما تختفي الصفحة عن الشاشة، نعيد تفعيله لما ترجع
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (!wakeLock) requestWakeLock();
  }
});
 
function playBeep() {
  if (alertMode !== "full" || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
 
  setTimeout(() => {
    if (alertMode !== "full" || !audioCtx) return;
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1046;
    gain2.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.35, audioCtx.currentTime + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start();
    osc2.stop(audioCtx.currentTime + 0.4);
  }, 220);
}
 
function vibrateAlert() {
  if (alertMode === "off") return;
  if ("vibrate" in navigator) {
    navigator.vibrate([300, 100, 300]);
  }
}
 
let alarmTimer = null;
 
function startAlarm() {
  if (alarmTimer) return;
  playBeep();
  vibrateAlert();
  alarmTimer = setInterval(() => {
    playBeep();
    vibrateAlert();
  }, 4000);
}
 
function stopAlarm() {
  clearInterval(alarmTimer);
  alarmTimer = null;
  if ("vibrate" in navigator) navigator.vibrate(0);
}
 
alertModeSelect.value = alertMode;
alertModeSelect.addEventListener("change", () => {
  alertMode = alertModeSelect.value;
  localStorage.setItem(ALERT_MODE_KEY, alertMode);
});

if (blinkModeSelect) {
  blinkModeSelect.value = blinkMode;
  blinkModeSelect.addEventListener("change", () => {
    blinkMode = blinkModeSelect.value === "soft" ? "soft" : "strong";
    localStorage.setItem(BLINK_MODE_KEY, blinkMode);
    if (document.body.classList.contains("incoming-blink-soft") || document.body.classList.contains("incoming-blink-strong")) {
      setBlinking(true);
    }
  });
}

// -------- إشعارات المتصفح (اختياري، لتوصيل التنبيه حتى لو التبويب مو أمامها) --------
notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("هذا المتصفح لا يدعم إشعارات النظام");
    return;
  }
  const result = await registerFCM({ type: "nurse", dept: myDept, name: myName });
  if (result?.permission === "granted") {
    notifyBanner.style.display = "block";
    notifyBtn.textContent = "الإشعارات مفعّلة ✓";
    notifyBtn.disabled = true;
    new Notification("تم تفعيل إشعارات نظام استدعاء الممرضة ✓");
  } else {
    alert("لم يتم منح إذن الإشعارات. يمكنك تفعيلها لاحقاً من إعدادات المتصفح.");
  }
});
 
if (Notification && Notification.permission === "granted") {
  notifyBtn.textContent = "الإشعارات مفعّلة ✓";
  notifyBtn.disabled = true;
}

refreshDepartments().then(() => {
  if (myDept) {
    loginTitle.textContent = `تسجيل الدخول — قسم ${departmentName(myDept)}`;
    if (nurseNameEl) nurseNameEl.textContent = `قسم ${departmentName(myDept)}`;
    if (nurseDeptEl) nurseDeptEl.textContent = "";
  }
});

// -------- تسجيل الدخول --------
if (myDept) {
  showDashboard();
} else {
  showLogin();
}
 
changeNameBtn.addEventListener("click", () => {
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(DEPT_KEY);
  location.reload();
});
 
function showLogin() {
  loginCard.style.display = "block";
  setBlinking(false);
  nurseHeader.style.display = "none";
  tabs.style.display = "none";
  requestList.style.display = "none";
  emptyState.style.display = "none";
  logList.style.display = "none";
  logEmptyState.style.display = "none";
}
 
function showDashboard() {
  loginCard.style.display = "none";
  nurseHeader.style.display = "flex";
  tabs.style.display = "flex";
  nurseNameEl.textContent = `قسم ${departmentName(myDept)}`;
  nurseDeptEl.textContent = "";
  nurseDeptEl.style.display = "none";
  if (changeNameBtn) changeNameBtn.style.display = "none";
  if (!audioUnlocked) soundHint.style.display = "block";

  // تسجيل صامت فقط إذا كان الإذن ممنوحاً مسبقاً
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    registerFCM({ type: "nurse", dept: myDept, name: myName });
    notifyBanner.style.display = "block";
  }

  listenForRequests();
  switchTab("current");
}
 
// -------- التبديل بين "الطلبات الحالية" و "سجل اليوم" --------
tabCurrent.addEventListener("click", () => switchTab("current"));
tabLog.addEventListener("click", () => switchTab("log"));
 
function switchTab(which) {
  tabCurrent.classList.toggle("active", which === "current");
  tabLog.classList.toggle("active", which === "log");
 
  if (which === "current") {
    requestList.style.display = "flex";
    logList.style.display = "none";
    logEmptyState.style.display = "none";
    if (logUnsubscribe) { logUnsubscribe(); logUnsubscribe = null; }
  } else {
    requestList.style.display = "none";
    emptyState.style.display = "none";
    logList.style.display = "flex";
    listenForTodayLog();
  }
}
 
// -------- الطلبات الحالية لقسم الممرضة فقط --------
function listenForRequests() {
  const q = query(
    collection(db, "callRequests"),
    where("department", "==", myDept),
    where("status", "in", ["sent", "received"]),
    orderBy("createdAt", "asc")
  );
 
  currentUnsubscribe = onSnapshot(q, (snapshot) => {
    requestList.innerHTML = "";
 
    if (snapshot.empty) {
      emptyState.style.display = tabCurrent.classList.contains("active") ? "block" : "none";
      setBlinking(false);
      stopAlarm();
      return;
    }
    emptyState.style.display = "none";
 
    let pendingCount = 0;
 
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      requestList.appendChild(buildCard(docSnap.id, data));
 
      if (data.status === "sent") {
        pendingCount++;
      }
      knownRequestIds.add(docSnap.id);
    });
 
    if (pendingCount > 0) {
      setBlinking(true);
      startAlarm();
    } else {
      setBlinking(false);
      stopAlarm();
    }
  });
}

function setBlinking(isActive) {
  document.body.classList.remove("incoming-blink", "incoming-blink-soft", "incoming-blink-strong");
  if (!isActive) return;
  document.body.classList.add(blinkMode === "soft" ? "incoming-blink-soft" : "incoming-blink-strong");
}

function buildCard(id, data) {
  const card = document.createElement("div");
  card.className = "request-card" + (data.receivedBy === myName ? " mine" : "");
 
  const isMine = data.receivedBy === myName;
  const timeText = data.createdAt ? timeAgo(data.createdAt.toDate()) : "الآن";
 
  card.innerHTML = `
    <div>
      <div class="request-room">غرفة ${data.room}</div>
      <div class="request-meta">
        <span class="badge ${data.status}">${data.status === "sent" ? "طلب جديد" : "قيد التنفيذ"}</span>
        &nbsp;${timeText}
        ${data.receivedBy ? `&nbsp;· بواسطة ${data.receivedBy}` : ""}
      </div>
    </div>
  `;
 
  const actionSlot = document.createElement("div");
  actionSlot.style.display = "flex";
  actionSlot.style.gap = "8px";
  actionSlot.style.flexWrap = "wrap";
  actionSlot.style.justifyContent = "flex-end";
 
  if (data.status === "sent") {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.textContent = "استلام الطلب";
    btn.onclick = () => acceptRequest(id);
    actionSlot.appendChild(btn);
  } else if (data.status === "received" && isMine) {
    const finishBtn = document.createElement("button");
    finishBtn.className = "action-btn done-btn";
    finishBtn.textContent = "إنهاء الطلب";
    finishBtn.onclick = () => completeRequest(id, "");
    actionSlot.appendChild(finishBtn);
 
    const noteBtn = document.createElement("button");
    noteBtn.className = "action-btn note-finish-btn";
    noteBtn.textContent = "إنهاء مع ملاحظة";
    noteBtn.onclick = () => {
      const note = prompt("اكتب الملاحظة:", "");
      if (note === null) return; // إلغاء
      completeRequest(id, note.trim());
    };
    actionSlot.appendChild(noteBtn);
  }
 
  card.appendChild(actionSlot);
  return card;
}
 
// معاملة (transaction) تمنع استلام نفس الطلب من أكثر من ممرضة بنفس اللحظة
async function acceptRequest(id) {
  const ref = doc(db, "callRequests", id);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("الطلب لم يعد موجوداً");
      if (snap.data().status !== "sent") {
        throw new Error("تم استلام هذا الطلب من ممرضة أخرى بالفعل");
      }
      tx.update(ref, {
        status: "received",
        receivedBy: myName,
        receivedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    alert(err.message || "تعذر استلام الطلب");
  }
}
 
async function completeRequest(id, note) {
  const ref = doc(db, "callRequests", id);
  try {
    await updateDoc(ref, {
      status: "done",
      doneAt: serverTimestamp(),
      note: note || "",
    });
  } catch (err) {
    alert("تعذر تحديث حالة الطلب");
  }
}
 
// -------- سجل اليوم (طلبات استلمتها هذه الممرضة اليوم) --------
function listenForTodayLog() {
  if (logUnsubscribe) { logUnsubscribe(); logUnsubscribe = null; }
 
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startTimestamp = Timestamp.fromDate(startOfToday);
 
  const q = query(
    collection(db, "callRequests"),
    where("receivedBy", "==", myName),
    where("createdAt", ">=", startTimestamp),
    orderBy("createdAt", "desc")
  );
 
  logUnsubscribe = onSnapshot(q, (snapshot) => {
    logList.innerHTML = "";
 
    if (snapshot.empty) {
      logEmptyState.style.display = "block";
      return;
    }
    logEmptyState.style.display = "none";
 
    snapshot.forEach((docSnap) => {
      logList.appendChild(buildLogCard(docSnap.id, docSnap.data()));
    });
  });
}
 
function buildLogCard(id, data) {
  const card = document.createElement("div");
  card.className = "request-card mine";
  card.style.flexDirection = "column";
  card.style.alignItems = "stretch";
 
  const timeLabel = data.createdAt
    ? data.createdAt.toDate().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
    : "";
 
  const statusLabel = data.status === "done" ? "تم التنفيذ" : data.status === "received" ? "قيد التنفيذ" : "طلب جديد";
 
  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.justifyContent = "space-between";
  top.style.alignItems = "center";
  top.innerHTML = `
    <div>
      <div class="request-room">غرفة ${data.room}</div>
      <div class="request-meta">
        <span class="badge ${data.status}">${statusLabel}</span>
        &nbsp;الساعة ${timeLabel}
      </div>
    </div>
  `;
 
  const noteBtn = document.createElement("button");
  noteBtn.className = "note-btn";
  noteBtn.textContent = data.note ? "تعديل الملاحظة" : "إضافة ملاحظة";
  noteBtn.onclick = () => editNote(id, data.note || "");
  top.appendChild(noteBtn);
 
  card.appendChild(top);
 
  if (data.note) {
    const noteBox = document.createElement("div");
    noteBox.className = "request-note";
    noteBox.innerHTML = `<span class="note-label">ملاحظة:</span>${escapeHtml(data.note)}`;
    card.appendChild(noteBox);
  }
 
  return card;
}
 
async function editNote(id, currentNote) {
  const note = prompt("تعديل ملاحظة الطلب:", currentNote);
  if (note === null) return;
 
  const ref = doc(db, "callRequests", id);
  try {
    await updateDoc(ref, { note: note.trim() });
  } catch (err) {
    alert("تعذر حفظ الملاحظة");
  }
}
 
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
 
function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  return `منذ ${minutes} ${minutes === 1 ? "دقيقة" : "دقائق"}`;
}
 


