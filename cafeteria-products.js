import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const productName = document.getElementById("productName");
const productPrice = document.getElementById("productPrice");
const addProductBtn = document.getElementById("addProductBtn");
const productsList = document.getElementById("productsList");
const productsEmpty = document.getElementById("productsEmpty");

addProductBtn.addEventListener("click", addProduct);
productName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addProduct();
});
productPrice.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addProduct();
});

listenForProducts();

async function addProduct() {
  const name = productName.value.trim();
  const price = Number(productPrice.value);

  if (!name) {
	alert("يرجى إدخال اسم المنتج");
	return;
  }

  if (!Number.isFinite(price) || price < 0) {
	alert("يرجى إدخال سعر صحيح");
	return;
  }

  addProductBtn.disabled = true;
  addProductBtn.textContent = "جارِ الإضافة...";

  try {
	await addDoc(collection(db, "cafeteriaProducts"), {
	  name,
	  price,
	  isAvailable: true,
	  createdAt: serverTimestamp(),
	  updatedAt: serverTimestamp()
	});

	productName.value = "";
	productPrice.value = "";
  } catch (err) {
	console.error(err);
	alert("تعذر إضافة المنتج");
  } finally {
	addProductBtn.disabled = false;
	addProductBtn.textContent = "إضافة";
  }
}

function listenForProducts() {
  const q = query(
	collection(db, "cafeteriaProducts"),
	orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
	productsList.innerHTML = "";

	if (snapshot.empty) {
	  productsEmpty.style.display = "block";
	  return;
	}

	productsEmpty.style.display = "none";

	snapshot.forEach((docSnap) => {
	  const data = docSnap.data();
	  productsList.appendChild(buildProductCard(docSnap.id, data));
	});
  }, (err) => {
	console.error(err);
	productsList.innerHTML = "";
	productsEmpty.style.display = "block";
	productsEmpty.textContent = "تعذر تحميل المنتجات حالياً";
  });
}

function buildProductCard(id, data) {
  const card = document.createElement("div");
  card.className = "request-card";
  card.style.marginBottom = "10px";

  const priceLabel = Number.isFinite(data.price)
	? `${data.price.toFixed(2)} ر.س`
	: "--";

  card.innerHTML = `
	<div>
	  <div class="request-room">${escapeHtml(data.name || "")}</div>
	  <div class="request-meta">
		${priceLabel}
		&nbsp;·&nbsp;
		${data.isAvailable ? "متاح" : "غير متاح"}
	  </div>
	</div>
  `;

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";
  actions.style.justifyContent = "flex-end";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "action-btn";
  toggleBtn.textContent = data.isAvailable ? "إيقاف" : "تفعيل";
  toggleBtn.onclick = () => toggleAvailability(id, !!data.isAvailable);
  actions.appendChild(toggleBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn note-finish-btn";
  deleteBtn.textContent = "حذف";
  deleteBtn.onclick = () => removeProduct(id, data.name || "");
  actions.appendChild(deleteBtn);

  card.appendChild(actions);
  return card;
}

async function toggleAvailability(id, currentValue) {
  try {
	await updateDoc(doc(db, "cafeteriaProducts", id), {
	  isAvailable: !currentValue,
	  updatedAt: serverTimestamp()
	});
  } catch (err) {
	console.error(err);
	alert("تعذر تحديث حالة المنتج");
  }
}

async function removeProduct(id, name) {
  const ok = confirm(`حذف المنتج: ${name} ؟`);
  if (!ok) return;

  try {
	await deleteDoc(doc(db, "cafeteriaProducts", id));
  } catch (err) {
	console.error(err);
	alert("تعذر حذف المنتج");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
