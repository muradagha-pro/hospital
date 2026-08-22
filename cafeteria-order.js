import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const room = (params.get("room") || "").trim();
const hasValidRoom = /^\d+$/.test(room);

const roomBadge = document.getElementById("roomBadge");
const productsList = document.getElementById("productsList");
const productsEmpty = document.getElementById("productsEmpty");
const orderNote = document.getElementById("orderNote");
const totalLabel = document.getElementById("totalLabel");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const statusLine = document.getElementById("statusLine");
const statusTime = document.getElementById("statusTime");

roomBadge.textContent = room || "؟";

const cart = new Map();
let availableProducts = [];

if (!hasValidRoom) {
  sendOrderBtn.disabled = true;
  statusLine.textContent = "رابط الغرفة غير صالح. يرجى مسح QR الصحيح.";
} else {
  listenForProducts();
}

sendOrderBtn.addEventListener("click", submitOrder);

function listenForProducts() {
  const q = query(
	collection(db, "cafeteriaProducts"),
	orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    availableProducts = snapshot.docs
	  .map((d) => ({ id: d.id, ...d.data() }))
	  .filter((p) => p.isAvailable);

    if (availableProducts.length === 0) {
	  productsEmpty.style.display = "block";
	  sendOrderBtn.disabled = true;
      productsList.innerHTML = "";
	  updateTotal();
	  return;
	}

	productsEmpty.style.display = "none";
	sendOrderBtn.disabled = false;
    renderProducts();
  }, (err) => {
	console.error(err);
	productsList.innerHTML = "";
	productsEmpty.style.display = "block";
	productsEmpty.textContent = "تعذر تحميل المنتجات حالياً";
	sendOrderBtn.disabled = true;
  });
}

function renderProducts() {
  productsList.innerHTML = "";
  availableProducts.forEach((p) => {
    productsList.appendChild(buildProductItem(p));
  });
}

function buildProductItem(product) {
  const price = Number(product.price);
  const safePrice = Number.isFinite(price) ? price : 0;
  const qty = cart.get(product.id)?.qty || 0;

  const card = document.createElement("div");
  card.className = "request-card cafeteria-product-card";

  card.innerHTML = `
	<div>
	  <div class="request-room">${escapeHtml(product.name || "")}</div>
	  <div class="request-meta">${safePrice.toFixed(2)} ر.س</div>
	</div>
  `;

  const controls = document.createElement("div");
  controls.className = "cafeteria-qty-controls";

  const minus = document.createElement("button");
  minus.className = "action-btn note-finish-btn";
  minus.textContent = "-";
  minus.onclick = () => changeQty(product, -1);

  const qtyLabel = document.createElement("div");
  qtyLabel.className = "cafeteria-qty-label";
  qtyLabel.textContent = String(qty);

  const plus = document.createElement("button");
  plus.className = "action-btn";
  plus.textContent = "+";
  plus.onclick = () => changeQty(product, +1);

  controls.appendChild(minus);
  controls.appendChild(qtyLabel);
  controls.appendChild(plus);
  card.appendChild(controls);

  return card;
}

function changeQty(product, delta) {
  const current = cart.get(product.id)?.qty || 0;
  const next = Math.max(0, current + delta);

  if (next === 0) {
	cart.delete(product.id);
  } else {
	const price = Number(product.price);
	cart.set(product.id, {
	  productId: product.id,
	  name: product.name || "",
	  price: Number.isFinite(price) ? price : 0,
	  qty: next
	});
  }

  updateTotal();
  renderProducts();
}

function updateTotal() {
  let total = 0;
  cart.forEach((item) => {
	total += item.price * item.qty;
  });
  totalLabel.textContent = `الإجمالي: ${total.toFixed(2)} ر.س`;
}

async function submitOrder() {
  if (!hasValidRoom) return;

  const items = Array.from(cart.values()).filter((i) => i.qty > 0);
  if (items.length === 0) {
	alert("يرجى اختيار منتج واحد على الأقل");
	return;
  }

  const note = orderNote.value.trim();
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  sendOrderBtn.disabled = true;
  sendOrderBtn.textContent = "جارِ الإرسال...";

  try {
	await addDoc(collection(db, "cafeteriaOrders"), {
	  room,
	  items,
	  total,
	  note,
	  status: "new",
	  receivedBy: null,
	  createdAt: serverTimestamp(),
	  receivedAt: null,
	  doneAt: null
	});

	cart.clear();
	orderNote.value = "";
	updateTotal();
    renderProducts();

	statusLine.textContent = "تم إرسال طلب الكافتيريا";
	statusTime.textContent = new Date().toLocaleString("ar", {
	  month: "short",
	  day: "numeric",
	  hour: "2-digit",
	  minute: "2-digit"
	});
  } catch (err) {
	console.error(err);
	alert("تعذر إرسال الطلب");
  } finally {
	sendOrderBtn.disabled = false;
	sendOrderBtn.textContent = "إرسال الطلب";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
