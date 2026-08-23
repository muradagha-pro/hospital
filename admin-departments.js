import { db } from "./firebase-config.js";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { createDepartmentId, refreshDepartments } from "./departments.js";

const deptName = document.getElementById("deptName");
const deptId = document.getElementById("deptId");
const roomStart = document.getElementById("roomStart");
const roomEnd = document.getElementById("roomEnd");
const addDeptBtn = document.getElementById("addDeptBtn");
const deptList = document.getElementById("deptList");
const deptEmpty = document.getElementById("deptEmpty");

let currentRows = [];

deptName.addEventListener("input", () => {
  if (deptId.value.trim()) return;
  deptId.value = createDepartmentId(deptName.value);
});

addDeptBtn.addEventListener("click", addDepartment);

[deptName, deptId, roomStart, roomEnd].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDepartment();
  });
});

listenForDepartments();

function listenForDepartments() {
  const q = query(collection(db, "departmentsConfig"), orderBy("order", "asc"));

  onSnapshot(q, (snapshot) => {
    currentRows = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() }));
    renderDepartments(currentRows);
    refreshDepartments();
  }, (err) => {
    console.error(err);
    deptList.innerHTML = "";
    deptEmpty.style.display = "block";
    deptEmpty.textContent = "تعذر تحميل الأقسام حالياً";
  });
}

async function addDepartment() {
  const name = deptName.value.trim();
  const idRaw = deptId.value.trim() || createDepartmentId(name);
  const id = createDepartmentId(idRaw);
  const start = Number(roomStart.value);
  const end = Number(roomEnd.value);

  if (!name) {
    alert("يرجى إدخال اسم القسم");
    return;
  }

  if (!id) {
    alert("يرجى إدخال رمز القسم");
    return;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || end < start) {
    alert("يرجى إدخال مجال غرف صحيح");
    return;
  }

  const duplicate = currentRows.some((r) => String(r.id || "") === id);
  if (duplicate) {
    alert("رمز القسم موجود مسبقاً. اختر رمزاً آخر.");
    return;
  }

  const roomOverlap = currentRows.find((r) => {
    const rs = Number(r.roomStart);
    const re = Number(r.roomEnd);
    if (!Number.isFinite(rs) || !Number.isFinite(re)) return false;
    return !(end < rs || start > re);
  });

  if (roomOverlap) {
    alert(`هذا المجال يتداخل مع قسم: ${roomOverlap.name || roomOverlap.id}`);
    return;
  }

  addDeptBtn.disabled = true;
  addDeptBtn.textContent = "جارِ الإضافة...";

  try {
    await setDoc(doc(db, "departmentsConfig", id), {
      id,
      name,
      roomStart: start,
      roomEnd: end,
      order: currentRows.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    deptName.value = "";
    deptId.value = "";
    roomStart.value = "";
    roomEnd.value = "";
  } catch (err) {
    console.error(err);
    alert("تعذر إضافة القسم");
  } finally {
    addDeptBtn.disabled = false;
    addDeptBtn.textContent = "إضافة";
  }
}

function renderDepartments(rows) {
  deptList.innerHTML = "";

  if (rows.length === 0) {
    deptEmpty.style.display = "block";
    deptEmpty.textContent = "لا توجد أقسام حالياً";
    return;
  }

  deptEmpty.style.display = "none";

  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "request-card";
    card.style.marginBottom = "10px";

    card.innerHTML = `
      <div>
        <div class="request-room">${escapeHtml(row.name || "")}</div>
        <div class="request-meta">رمز القسم: ${escapeHtml(String(row.id || ""))}</div>
        <div class="request-meta">الغرف: ${Number(row.roomStart)} - ${Number(row.roomEnd)}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.justifyContent = "flex-end";

    const del = document.createElement("button");
    del.className = "action-btn note-finish-btn";
    del.textContent = "حذف";
    del.onclick = () => removeDepartment(row.docId, row.name || row.id || "");

    actions.appendChild(del);
    card.appendChild(actions);
    deptList.appendChild(card);
  });
}

async function removeDepartment(docId, name) {
  const ok = confirm(`حذف القسم: ${name} ؟`);
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "departmentsConfig", docId));
    await refreshDepartments();
  } catch (err) {
    console.error(err);
    alert("تعذر حذف القسم");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

