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

const tabCurrent = document.getElementById("tabCurrent");
const tabDone = document.getElementById("tabDone");
const ordersList = document.getElementById("ordersList");
const ordersEmpty = document.getElementById("ordersEmpty");

let activeTab = "current";
let allOrders = [];

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

listenForOrders();

function listenForOrders() {
  const q = query(
	collection(db, "cafeteriaOrders"),
	orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
	allOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
	renderOrders();
  }, (err) => {
	console.error(err);
	ordersList.innerHTML = "";
	ordersEmpty.style.display = "block";
	ordersEmpty.textContent = "تعذر تحميل الطلبات حالياً";
  });
}

function renderOrders() {
  ordersList.innerHTML = "";

  const items = allOrders.filter((o) => {
	if (activeTab === "current") {
	  return o.status === "new" || o.status === "preparing";
	}

	if (o.status !== "done") return false;
	if (!o.doneAt || typeof o.doneAt.toDate !== "function") return false;

	const d = o.doneAt.toDate();
	const now = new Date();
	return (
	  d.getFullYear() === now.getFullYear() &&
	  d.getMonth() === now.getMonth() &&
	  d.getDate() === now.getDate()
	);
  });

  if (items.length === 0) {
	ordersEmpty.style.display = "block";
	ordersEmpty.textContent = activeTab === "current"
	  ? "لا توجد طلبات حالية"
	  : "لا توجد طلبات منتهية اليوم";
	return;
  }

  ordersEmpty.style.display = "none";
  items.forEach((order) => {
	ordersList.appendChild(buildOrderCard(order));
  });
}

function buildOrderCard(order) {
  const card = document.createElement("div");
  card.className = "request-card";
  card.style.marginBottom = "10px";

  const createdAt = formatTime(order.createdAt);
  const itemSummary = Array.isArray(order.items)
	? order.items.map((i) => `${i.name} x${i.qty}`).join("، ")
	: "--";

  const badgeText = order.status === "done"
	? "تم التسليم"
	: order.status === "preparing"
	  ? "قيد التحضير"
	  : "طلب جديد";

  card.innerHTML = `
	<div>
	  <div class="request-room">غرفة ${escapeHtml(String(order.room || ""))}</div>
	  <div class="request-meta">
		<span class="badge ${order.status === "new" ? "sent" : order.status === "preparing" ? "received" : "done"}">${badgeText}</span>
		&nbsp;·&nbsp;${createdAt}
	  </div>
	  <div class="request-meta" style="margin-top:6px;">${escapeHtml(itemSummary)}</div>
	  <div class="request-meta" style="margin-top:4px; font-weight:700; color:var(--teal-dark);">
		الإجمالي: ${Number(order.total || 0).toFixed(2)} ر.س
	  </div>
	  ${order.note ? `<div class="detail-note" style="margin-top:8px;">${escapeHtml(order.note)}</div>` : ""}
	</div>
  `;

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";
  actions.style.justifyContent = "flex-end";

  if (activeTab === "current") {
	if (order.status === "new") {
	  const prepBtn = document.createElement("button");
	  prepBtn.className = "action-btn";
	  prepBtn.textContent = "بدء التحضير";
	  prepBtn.onclick = () => markPreparing(order.id);
	  actions.appendChild(prepBtn);
	}

	if (order.status === "preparing") {
	  const doneBtn = document.createElement("button");
	  doneBtn.className = "action-btn done-btn";
	  doneBtn.textContent = "تم التسليم";
	  doneBtn.onclick = () => markDone(order.id);
	  actions.appendChild(doneBtn);
	}
  }

  card.appendChild(actions);
  return card;
}

async function markPreparing(id) {
  try {
	await updateDoc(doc(db, "cafeteriaOrders", id), {
	  status: "preparing",
	  receivedAt: serverTimestamp()
	});
  } catch (err) {
	console.error(err);
	alert("تعذر تحديث الطلب");
  }
}

async function markDone(id) {
  try {
	await updateDoc(doc(db, "cafeteriaOrders", id), {
	  status: "done",
	  doneAt: serverTimestamp()
	});
  } catch (err) {
	console.error(err);
	alert("تعذر تحديث الطلب");
  }
}

function formatTime(ts) {
  if (!ts || typeof ts.toDate !== "function") return "--";
  return ts.toDate().toLocaleString("ar", {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit"
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
