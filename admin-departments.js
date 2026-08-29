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
const qrDomainInput = document.getElementById("qrDomain");

let currentRows = [];
let editingDocId = null;

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

    const departmentPath = buildDepartmentPath(row.id);

    card.innerHTML = `
      <div>
        <div class="request-room">${escapeHtml(row.name || "")}</div>
        <div class="request-meta">رمز القسم: ${escapeHtml(String(row.id || ""))}</div>
        <div class="request-meta">رابط القسم: <a href="${escapeHtml(departmentPath)}" target="_blank" rel="noopener noreferrer">${escapeHtml(departmentPath)}</a></div>
        <div class="request-meta">الغرف: ${Number(row.roomStart)} - ${Number(row.roomEnd)}</div>
      </div>
    `;

    if (editingDocId !== row.docId) {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.justifyContent = "flex-end";

      const editBtn = document.createElement("button");
      editBtn.className = "action-btn";
      editBtn.textContent = "تعديل";
      editBtn.onclick = () => {
        editingDocId = row.docId;
        renderDepartments(currentRows);
      };

      const qrBtn = document.createElement("button");
      qrBtn.className = "action-btn done-btn";
      qrBtn.textContent = "QR القسم";
      qrBtn.onclick = () => openDepartmentQrPage(row);

      actions.appendChild(editBtn);
      actions.appendChild(qrBtn);
      card.appendChild(actions);
    }

    if (editingDocId === row.docId) {
      card.appendChild(buildEditor(row));
    }

    deptList.appendChild(card);
  });
}

function buildEditor(row) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "12px";
  wrap.style.paddingTop = "12px";
  wrap.style.borderTop = "1px solid var(--line)";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = String(row.name || "");
  nameInput.placeholder = "اسم القسم";
  nameInput.style.cssText = "width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); margin-bottom:8px;";

  const roomsWrap = document.createElement("div");
  roomsWrap.style.cssText = "display:flex; gap:8px; flex-wrap:wrap;";

  const startInput = document.createElement("input");
  startInput.type = "number";
  startInput.min = "1";
  startInput.value = String(Number(row.roomStart || ""));
  startInput.placeholder = "من غرفة";
  startInput.style.cssText = "flex:1; min-width:120px; padding:10px; border-radius:10px; border:1px solid var(--line);";

  const endInput = document.createElement("input");
  endInput.type = "number";
  endInput.min = "1";
  endInput.value = String(Number(row.roomEnd || ""));
  endInput.placeholder = "إلى غرفة";
  endInput.style.cssText = "flex:1; min-width:120px; padding:10px; border-radius:10px; border:1px solid var(--line);";

  roomsWrap.appendChild(startInput);
  roomsWrap.appendChild(endInput);

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; margin-top:10px;";

  const saveBtn = document.createElement("button");
  saveBtn.className = "action-btn done-btn";
  saveBtn.textContent = "حفظ التعديلات";
  saveBtn.onclick = async () => {
    await updateDepartment(row, {
      name: nameInput.value.trim(),
      roomStart: Number(startInput.value),
      roomEnd: Number(endInput.value),
    });
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "action-btn note-finish-btn";
  cancelBtn.textContent = "إلغاء";
  cancelBtn.onclick = () => {
    editingDocId = null;
    renderDepartments(currentRows);
  };

  const delBtn = document.createElement("button");
  delBtn.className = "action-btn danger-btn";
  delBtn.textContent = "حذف القسم";
  delBtn.onclick = () => removeDepartment(row.docId, row.name || row.id || "");

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(delBtn);

  wrap.appendChild(nameInput);
  wrap.appendChild(roomsWrap);
  wrap.appendChild(actions);

  return wrap;
}

async function updateDepartment(row, changes) {
  const name = changes.name;
  const start = changes.roomStart;
  const end = changes.roomEnd;

  if (!name) {
    alert("يرجى إدخال اسم القسم");
    return;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || end < start) {
    alert("يرجى إدخال مجال غرف صحيح");
    return;
  }

  const roomOverlap = currentRows.find((r) => {
    if (r.docId === row.docId) return false;
    const rs = Number(r.roomStart);
    const re = Number(r.roomEnd);
    if (!Number.isFinite(rs) || !Number.isFinite(re)) return false;
    return !(end < rs || start > re);
  });

  if (roomOverlap) {
    alert(`هذا المجال يتداخل مع قسم: ${roomOverlap.name || roomOverlap.id}`);
    return;
  }

  try {
    await setDoc(doc(db, "departmentsConfig", row.docId), {
      ...row,
      name,
      roomStart: start,
      roomEnd: end,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    editingDocId = null;
    await refreshDepartments();
  } catch (err) {
    console.error(err);
    alert("تعذر حفظ التعديلات");
  }
}

async function removeDepartment(docId, name) {
  const ok = confirm(
    `تحذير: سيتم حذف القسم "${name}" وستضيع بياناته المرتبطة بتوزيع الغرف.\n\nهل أنت متأكد من المتابعة؟`
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "departmentsConfig", docId));
    if (editingDocId === docId) editingDocId = null;
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

function openDepartmentQrPage(row) {
  const normalizedDomain = normalizeDomain(qrDomainInput ? qrDomainInput.value : "");
  if (!normalizedDomain) {
    alert("يرجى إدخال رابط النظام الصحيح في حقل الدومين أولا");
    return;
  }

  const targetUrl = `admin-technic-dept-qr.html?domain=${encodeURIComponent(normalizedDomain)}&deptId=${encodeURIComponent(String(row.id || ""))}&deptName=${encodeURIComponent(String(row.name || ""))}`;
  const popup = window.open(targetUrl, "_blank");
  if (!popup) {
    window.location.href = targetUrl;
  }
}

function buildDepartmentPath(deptId) {
  return `nurse.html?dept=${encodeURIComponent(String(deptId || ""))}`;
}

function normalizeDomain(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) return "";
    return `${parsed.origin}/`;
  } catch {
    return "";
  }
}

