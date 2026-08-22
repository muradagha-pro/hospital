import { db } from "./firebase-config.js";
import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const room = (params.get("room") || "").trim();
const orderId = (params.get("order") || "").trim();
const hasValidRoom = /^\d+$/.test(room);
const hasValidOrder = orderId.length > 0;
const ORDER_STORAGE_KEY = `activeCafeteriaOrder_room_${room}`;
const ESTIMATED_DURATION_MS = 5 * 60 * 1000;

const roomBadge = document.getElementById("roomBadge");
const orderStatusBadge = document.getElementById("orderStatusBadge");
const orderStatusText = document.getElementById("orderStatusText");
const orderStatusTime = document.getElementById("orderStatusTime");
const stepNodes = [
  document.getElementById("stepNode1"),
  document.getElementById("stepNode2"),
  document.getElementById("stepNode3")
];
const stepLabels = [
  document.getElementById("stepLabel1"),
  document.getElementById("stepLabel2"),
  document.getElementById("stepLabel3")
];
const progressRemaining = document.getElementById("progressRemaining");
const progressBar = document.getElementById("progressBar");
const etaText = document.getElementById("etaText");
const orderItemsList = document.getElementById("orderItemsList");
const orderTotal = document.getElementById("orderTotal");
const backToOrderLink = document.getElementById("backToOrderLink");

roomBadge.textContent = room || "؟";
backToOrderLink.href = `cafeteria-order.html?room=${encodeURIComponent(room)}`;

let countdownTimer = null;
let unsubscribe = null;

if (!hasValidRoom || !hasValidOrder) {
  showInvalidState("رابط حالة الطلب غير صالح. يرجى إعادة إرسال الطلب من صفحة الكافتيريا.");
} else {
  watchOrder();
}

function watchOrder() {
  unsubscribe = onSnapshot(doc(db, "cafeteriaOrders", orderId), (snap) => {
    if (!snap.exists()) {
      showInvalidState("لم نعد نجد هذا الطلب. ربما تم حذفه أو انتهت صلاحيته.");
      localStorage.removeItem(ORDER_STORAGE_KEY);
      return;
    }

    const data = snap.data();
    renderOrder(data);

    if (data.status === "done") {
      localStorage.removeItem(ORDER_STORAGE_KEY);
      stopCountdown();
      orderStatusText.textContent = "تم تسليم الطلب بنجاح";
      orderStatusTime.textContent = "سيتم إغلاق هذه الصفحة تلقائياً خلال ثوانٍ";
          backToOrderLink.style.display = "block";
      setTimeout(() => {
        window.location.href = `cafeteria-order.html?room=${encodeURIComponent(room)}`;
      }, 5000);
    }
  }, (err) => {
    console.error(err);
    showInvalidState("تعذر تحميل حالة الطلب حالياً.");
  });
}

function renderOrder(data) {
  renderItems(data.items || []);
  orderTotal.textContent = `${Number(data.total || 0).toFixed(2)} ل.س`;
  backToOrderLink.style.display = data.status === "done" ? "block" : "none";

  const createdAt = toDate(data.createdAt);
  const receivedAt = toDate(data.receivedAt);
  const doneAt = toDate(data.doneAt);

  if (data.status === "new") {
    setStatusBadge("new", "تم استلام الطلب");
    renderSteps("new");
    orderStatusText.textContent = "طلبك وصل إلى الكافتيريا وهو بانتظار بدء التحضير";
    orderStatusTime.textContent = createdAt
      ? `وقت الإرسال: ${formatDateTime(createdAt)}`
      : "";
    startCountdown(createdAt || new Date());
  } else if (data.status === "preparing") {
    setStatusBadge("preparing", "قيد التحضير");
    renderSteps("preparing");
    orderStatusText.textContent = "طلبك الآن قيد التحضير";
    orderStatusTime.textContent = receivedAt
      ? `بدأ التحضير: ${formatDateTime(receivedAt)}`
      : "";
    startCountdown(createdAt || receivedAt || new Date());
  } else if (data.status === "done") {
    setStatusBadge("done", "تم التسليم");
    renderSteps("done");
    orderStatusText.textContent = "تم تسليم الطلب";
    orderStatusTime.textContent = doneAt
      ? `وقت التسليم: ${formatDateTime(doneAt)}`
      : "";
    progressRemaining.textContent = "0:00";
    progressBar.style.width = "0%";
    etaText.textContent = "تم تسليم الطلب بالكامل.";
  } else {
    setStatusBadge("new", "قيد المتابعة");
    renderSteps("new");
    orderStatusText.textContent = "جارِ تحديث حالة الطلب";
    orderStatusTime.textContent = "";
  }
}

function renderItems(items) {
  orderItemsList.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cafeteria-order-item-row";

    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const lineTotal = qty * price;

    row.innerHTML = `
      <div>
        <div class="cafeteria-order-item-name">${escapeHtml(item.name || "")}</div>
        <div class="request-meta">السعر: ${price.toFixed(2)} ل.س · الكمية: ${qty}</div>
        <div class="request-meta">المجموع الفرعي: ${lineTotal.toFixed(2)} ل.س</div>
      </div>
      <div class="cafeteria-order-item-price">${price.toFixed(2)} ل.س</div>
    `;

    orderItemsList.appendChild(row);
  });
}

function startCountdown(baseTime) {
  stopCountdown();
  updateCountdown(baseTime);
  countdownTimer = setInterval(() => updateCountdown(baseTime), 1000);
}

function updateCountdown(baseTime) {
  const elapsed = Date.now() - baseTime.getTime();
  const remaining = Math.max(0, ESTIMATED_DURATION_MS - elapsed);
  const ratio = remaining / ESTIMATED_DURATION_MS;

  progressBar.style.width = `${ratio * 100}%`;
  progressRemaining.textContent = formatDuration(remaining);
  etaText.textContent = remaining > 0
    ? `الوقت المتبقي التقريبي: ${formatDuration(remaining)}`
    : "قد يتأخر الطلب قليلاً، لكنه ما يزال قيد المتابعة.";

  if (remaining <= 0) {
    progressRemaining.textContent = "0:00";
    progressBar.style.width = "0%";
    stopCountdown();
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function setStatusBadge(state, text) {
  orderStatusBadge.className = `cafeteria-order-badge ${state}`;
  orderStatusBadge.textContent = text;
}

function renderSteps(status) {
  const order = ["new", "preparing", "done"];
  const currentIndex = order.indexOf(status);

  stepNodes.forEach((node, index) => {
    node.classList.remove("active", "done");
    stepLabels[index].classList.remove("active");

    if (index < currentIndex) {
      node.classList.add("done");
      stepLabels[index].classList.add("active");
    }

    if (index === currentIndex) {
      node.classList.add("active");
      stepLabels[index].classList.add("active");
    }
  });
}

function showInvalidState(message) {
  stopCountdown();
  if (unsubscribe) unsubscribe();
  setStatusBadge("new", "غير متاح");
  renderSteps("new");
  orderStatusText.textContent = message;
  orderStatusTime.textContent = "";
  progressRemaining.textContent = "0:00";
  progressBar.style.width = "0%";
  etaText.textContent = "لا يوجد وقت متوقع لهذا الطلب حالياً.";
  orderItemsList.innerHTML = "";
  orderTotal.textContent = "0.00 ل.س";
  backToOrderLink.style.display = "block";
}

function toDate(value) {
  return value && typeof value.toDate === "function"
    ? value.toDate()
    : null;
}

function formatDateTime(date) {
  return date.toLocaleString("ar", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


