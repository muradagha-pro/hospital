import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ── الفئات الافتراضية تُزرع عند أول تشغيل ──
const DEFAULT_CATEGORIES = [
  { label: "مشروبات ساخنة", order: 0 },
  { label: "مشروبات باردة", order: 1 },
  { label: "طعام",           order: 2 },
  { label: "حلويات",         order: 3 },
];

// ── DOM ──
const productName     = document.getElementById("productName");
const productPrice    = document.getElementById("productPrice");
const productCategory = document.getElementById("productCategory");
const addProductBtn   = document.getElementById("addProductBtn");
const productsList    = document.getElementById("productsList");
const productsEmpty   = document.getElementById("productsEmpty");
const categoriesList  = document.getElementById("categoriesList");
const newCategoryLabel = document.getElementById("newCategoryLabel");
const addCategoryBtn  = document.getElementById("addCategoryBtn");
const catMgrToggle    = document.getElementById("catMgrToggle");
const catMgrBody      = document.getElementById("catMgrBody");

// ── state ──
let categories     = [];   // [{id, label, order}]
let allProducts    = [];   // [{id, ...data}]
const openSections = new Set();

// ── toggle category manager panel ──
catMgrToggle.addEventListener("click", () => {
  const open = catMgrBody.classList.toggle("open");
  catMgrToggle.classList.toggle("open", open);
});

// ── wire add-category button ──
addCategoryBtn.addEventListener("click", addCategory);
newCategoryLabel.addEventListener("keydown", (e) => { if (e.key === "Enter") addCategory(); });

// ── wire add-product button ──
addProductBtn.addEventListener("click", addProduct);
productName.addEventListener("keydown",  (e) => { if (e.key === "Enter") addProduct(); });
productPrice.addEventListener("keydown", (e) => { if (e.key === "Enter") addProduct(); });

// ── bootstrap ──
seedCategoriesIfEmpty().then(() => {
  listenForCategories();
  listenForProducts();
});

// ─────────────────────────────────────────────
// زرع الفئات الافتراضية عند أول تشغيل
// ─────────────────────────────────────────────
async function seedCategoriesIfEmpty() {
  const snap = await getDocs(collection(db, "cafeteriaCategories"));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  DEFAULT_CATEGORIES.forEach((cat) => {
    const ref = doc(collection(db, "cafeteriaCategories"));
    batch.set(ref, { ...cat, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

// ─────────────────────────────────────────────
// الاستماع للفئات
// ─────────────────────────────────────────────
function listenForCategories() {
  const q = query(
    collection(db, "cafeteriaCategories"),
    orderBy("order", "asc")
  );

  onSnapshot(q, (snapshot) => {
    categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategorySelect();
    renderCategoriesList();
    renderProductsSections();
  }, (err) => {
    console.error(err);
  });
}

// ─────────────────────────────────────────────
// تحديث قائمة الفئة في نموذج إضافة المنتج
// ─────────────────────────────────────────────
function renderCategorySelect() {
  const current = productCategory.value;
  productCategory.innerHTML = "";

  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.label;
    if (cat.id === current) opt.selected = true;
    productCategory.appendChild(opt);
  });

  if (!productCategory.value && categories.length > 0) {
    productCategory.value = categories[0].id;
  }
}

// ─────────────────────────────────────────────
// عرض قائمة الفئات في لوحة الإدارة
// ─────────────────────────────────────────────
function renderCategoriesList() {
  categoriesList.innerHTML = "";

  if (categories.length === 0) {
    categoriesList.innerHTML =
      `<div style="color:var(--muted); padding:8px 4px; font-size:0.88rem;">لا توجد فئات بعد</div>`;
    return;
  }

  categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "request-card cafeteria-product-card";
    row.style.marginBottom = "6px";

    row.innerHTML = `<div class="request-room">${escapeHtml(cat.label)}</div>`;

    const del = document.createElement("button");
    del.className = "action-btn note-finish-btn";
    del.textContent = "حذف";
    del.onclick = () => deleteCategory(cat.id, cat.label);
    row.appendChild(del);

    categoriesList.appendChild(row);
  });
}

// ─────────────────────────────────────────────
// إضافة فئة جديدة
// ─────────────────────────────────────────────
async function addCategory() {
  const label = newCategoryLabel.value.trim();
  if (!label) { alert("يرجى إدخال اسم الفئة"); return; }

  addCategoryBtn.disabled = true;
  addCategoryBtn.textContent = "جارِ الإضافة...";

  try {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
    await addDoc(collection(db, "cafeteriaCategories"), {
      label,
      order: maxOrder + 1,
      createdAt: serverTimestamp()
    });
    newCategoryLabel.value = "";
  } catch (err) {
    console.error(err);
    alert("تعذر إضافة الفئة");
  } finally {
    addCategoryBtn.disabled = false;
    addCategoryBtn.textContent = "إضافة فئة";
  }
}

// ─────────────────────────────────────────────
// حذف فئة
// ─────────────────────────────────────────────
async function deleteCategory(id, label) {
  const hasProducts = allProducts.some((p) => p.category === id);
  if (hasProducts) {
    alert(`لا يمكن حذف الفئة "${label}" لأنها تحتوي على منتجات. احذف أو غيّر فئة المنتجات أولاً.`);
    return;
  }
  if (!confirm(`حذف الفئة: ${label} ؟`)) return;

  try {
    await deleteDoc(doc(db, "cafeteriaCategories", id));
  } catch (err) {
    console.error(err);
    alert("تعذر حذف الفئة");
  }
}

// ─────────────────────────────────────────────
// الاستماع للمنتجات
// ─────────────────────────────────────────────
function listenForProducts() {
  const q = query(
    collection(db, "cafeteriaProducts"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    allProducts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProductsSections();
  }, (err) => {
    console.error(err);
    productsList.innerHTML = "";
    productsEmpty.style.display = "block";
    productsEmpty.textContent = "تعذر تحميل المنتجات حالياً";
  });
}

// ─────────────────────────────────────────────
// عرض المنتجات مجمّعة حسب الفئة
// ─────────────────────────────────────────────
function renderProductsSections() {
  productsList.innerHTML = "";

  if (allProducts.length === 0) {
    productsEmpty.style.display = "block";
    return;
  }
  productsEmpty.style.display = "none";

  // group
  const groups = {};
  categories.forEach((c) => { groups[c.id] = []; });
  groups["_other"] = [];

  allProducts.forEach((p) => {
    const key = groups[p.category] !== undefined ? p.category : "_other";
    groups[key].push(p);
  });

  const displayCats = [
    ...categories,
    ...(groups["_other"].length > 0
      ? [{ id: "_other", label: "غير مصنّف" }]
      : [])
  ];

  displayCats.forEach((cat) => {
    const items = groups[cat.id];
    if (!items || items.length === 0) return;

    if (!openSections.has(cat.id)) openSections.add(cat.id); // admin: open by default

    const section = document.createElement("div");
    section.className = "cafe-category-section";

    const isOpen = openSections.has(cat.id);

    const header = document.createElement("div");
    header.className = "cafe-category-header" + (isOpen ? " open" : "");
    header.innerHTML = `
      <span>${escapeHtml(cat.label)} <span style="font-weight:400; font-size:0.82rem; opacity:.75;">(${items.length})</span></span>
      <span class="cafe-category-chevron">&#9660;</span>
    `;

    const body = document.createElement("div");
    body.className = "cafe-category-body" + (isOpen ? " open" : "");

    items.forEach((p) => body.appendChild(buildProductCard(p.id, p)));

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

// ─────────────────────────────────────────────
// إضافة منتج
// ─────────────────────────────────────────────
async function addProduct() {
  const name     = productName.value.trim();
  const price    = Number(productPrice.value);
  const category = productCategory.value;

  if (!name)  { alert("يرجى إدخال اسم المنتج"); return; }
  if (!Number.isFinite(price) || price < 0) { alert("يرجى إدخال سعر صحيح"); return; }
  if (!category) { alert("يرجى اختيار الفئة"); return; }

  addProductBtn.disabled = true;
  addProductBtn.textContent = "جارِ الإضافة...";

  try {
    await addDoc(collection(db, "cafeteriaProducts"), {
      name, price, category,
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

// ─────────────────────────────────────────────
// بطاقة المنتج
// ─────────────────────────────────────────────
function buildProductCard(id, data) {
  const card = document.createElement("div");
  card.className = "request-card cafeteria-product-card";

  const priceLabel = Number.isFinite(Number(data.price))
    ? `${Number(data.price).toFixed(2)} ر.س` : "--";

  card.innerHTML = `
    <div>
      <div class="request-room">${escapeHtml(data.name || "")}</div>
      <div class="request-meta">${priceLabel} · ${data.isAvailable ? "متاح" : "غير متاح"}</div>
    </div>
  `;

  const actions = document.createElement("div");
  actions.className = "cafeteria-qty-controls";
  actions.style.justifyContent = "flex-end";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "action-btn";
  toggleBtn.textContent = data.isAvailable ? "إيقاف" : "تفعيل";
  toggleBtn.onclick = () => toggleAvailability(id, !!data.isAvailable);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn note-finish-btn";
  deleteBtn.textContent = "حذف";
  deleteBtn.onclick = () => removeProduct(id, data.name || "");

  actions.appendChild(toggleBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);
  return card;
}

async function toggleAvailability(id, cur) {
  try {
    await updateDoc(doc(db, "cafeteriaProducts", id), {
      isAvailable: !cur, updatedAt: serverTimestamp()
    });
  } catch (err) { console.error(err); alert("تعذر تحديث حالة المنتج"); }
}

async function removeProduct(id, name) {
  if (!confirm(`حذف المنتج: ${name} ؟`)) return;
  try {
    await deleteDoc(doc(db, "cafeteriaProducts", id));
  } catch (err) { console.error(err); alert("تعذر حذف المنتج"); }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
