import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const room = (params.get("room") || "").trim();
const hasValidRoom = /^\d+$/.test(room);

const roomBadge     = document.getElementById("roomBadge");
const productsList  = document.getElementById("productsList");
const productsEmpty = document.getElementById("productsEmpty");
const orderNote     = document.getElementById("orderNote");
const totalLabel    = document.getElementById("totalLabel");
const sendOrderBtn  = document.getElementById("sendOrderBtn");
const statusLine    = document.getElementById("statusLine");
const statusTime    = document.getElementById("statusTime");

roomBadge.textContent = room || "؟";

const ORDER_STORAGE_KEY = `activeCafeteriaOrder_room_${room}`;

const cart = new Map();
let availableProducts = [];
let categories = [];            // loaded from Firestore
const openSections = new Set(); // patient starts with all collapsed

if (!hasValidRoom) {
  sendOrderBtn.disabled = true;
  statusLine.textContent = "رابط الغرفة غير صالح. يرجى مسح QR الصحيح.";
} else {
  const existingOrderId = localStorage.getItem(ORDER_STORAGE_KEY);
  if (existingOrderId) {
    redirectToOrderStatus(existingOrderId);
  }

  listenForCategories();
  listenForProducts();
}

sendOrderBtn.addEventListener("click", submitOrder);

// ── load categories from Firestore ──
function listenForCategories() {
  const q = query(
    collection(db, "cafeteriaCategories"),
    orderBy("order", "asc")
  );

  onSnapshot(q, (snapshot) => {
    categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProducts();
  }, (err) => {
    console.error(err);
  });
}

// ── load available products ──
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
  if (availableProducts.length === 0) return;
  productsList.innerHTML = "";

  // build groups using live categories
  const groups = {};
  categories.forEach((c) => { groups[c.id] = []; });
  groups["_other"] = [];

  availableProducts.forEach((p) => {
    const key = groups[p.category] !== undefined ? p.category : "_other";
    groups[key].push(p);
  });

  const displayCats = [
    ...categories,
    ...(groups["_other"].length > 0 ? [{ id: "_other", label: "أخرى" }] : [])
  ];

  displayCats.forEach((cat) => {
    const items = groups[cat.id];
    if (!items || items.length === 0) return;

    const catCartCount = items.reduce((sum, p) => sum + (cart.get(p.id)?.qty || 0), 0);
    const isOpen = openSections.has(cat.id);

    const section = document.createElement("div");
    section.className = "cafe-category-section";

    const header = document.createElement("div");
    header.className = "cafe-category-header" + (isOpen ? " open" : "");
    header.innerHTML = `
      <span>${escapeHtml(cat.label)}${catCartCount > 0
        ? `<span class="cafe-cat-badge">${catCartCount}</span>` : ""}</span>
      <span class="cafe-category-chevron">&#9660;</span>
    `;

    const body = document.createElement("div");
    body.className = "cafe-category-body" + (isOpen ? " open" : "");

    items.forEach((p) => body.appendChild(buildProductItem(p)));

    header.addEventListener("click", () => {
      const opening = !body.classList.contains("open");
      body.classList.toggle("open", opening);
      header.classList.toggle("open", opening);
      if (opening) openSections.add(cat.id);
      else openSections.delete(cat.id);
    });

    section.appendChild(header);
    section.appendChild(body);
    productsList.appendChild(section);
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
      <div class="request-meta">${safePrice.toFixed(2)} ل.س</div>
    </div>
  `;

  const controls = document.createElement("div");
  controls.className = "cafeteria-qty-controls";

  const minus = document.createElement("button");
  minus.className = "action-btn note-finish-btn";
  minus.textContent = "-";
  minus.disabled = qty === 0;
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
  cart.forEach((item) => { total += item.price * item.qty; });
  totalLabel.textContent = `الإجمالي: ${total.toFixed(2)} ل.س`;
}

async function submitOrder() {
  if (!hasValidRoom) return;

  const items = Array.from(cart.values()).filter((i) => i.qty > 0);
  if (items.length === 0) {
    alert("يرجى اختيار منتج واحد على الأقل");
    return;
  }

  const note  = orderNote.value.trim();
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  sendOrderBtn.disabled = true;
  sendOrderBtn.textContent = "جارِ الإرسال...";

  try {
    const orderRef = await addDoc(collection(db, "cafeteriaOrders"), {
      room, items, total, note,
      status: "new",
      receivedBy: null,
      createdAt: serverTimestamp(),
      receivedAt: null,
      doneAt: null
    });

    localStorage.setItem(ORDER_STORAGE_KEY, orderRef.id);
    redirectToOrderStatus(orderRef.id);
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

function redirectToOrderStatus(orderId) {
  const target =
    `cafeteria-order-status.html?room=${encodeURIComponent(room)}&order=${encodeURIComponent(orderId)}`;
  window.location.href = target;
}

