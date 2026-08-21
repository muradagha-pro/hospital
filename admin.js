import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { DEPARTMENTS } from "./departments.js";

const rangeToday = document.getElementById("rangeToday");
const rangeWeek = document.getElementById("rangeWeek");
const loadingMsg = document.getElementById("loadingMsg");
const content = document.getElementById("content");

const statTotal = document.getElementById("statTotal");
const statDone = document.getElementById("statDone");
const statPending = document.getElementById("statPending");
const statAvgTime = document.getElementById("statAvgTime");
const deptBreakdown = document.getElementById("deptBreakdown");
const commentsList = document.getElementById("commentsList");
const commentsEmpty = document.getElementById("commentsEmpty");

let unsubscribe = null;
let currentRange = "today";
let openDeptKey = null; // يتذكر أي قسم كان مفتوح وقت إعادة الرسم

rangeToday.addEventListener("click", () => setRange("today"));
rangeWeek.addEventListener("click", () => setRange("week"));

setRange("today");

function setRange(range) {
  currentRange = range;
  rangeToday.classList.toggle("active", range === "today");
  rangeWeek.classList.toggle("active", range === "week");
  openDeptKey = null;
  loadData();
}

function loadData() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  loadingMsg.style.display = "block";
  content.style.display = "none";

  const start = new Date();
  if (currentRange === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 7);
  }
  const startTimestamp = Timestamp.fromDate(start);

  const q = query(
    collection(db, "callRequests"),
    where("createdAt", ">=", startTimestamp),
    orderBy("createdAt", "desc")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    render(requests);
    loadingMsg.style.display = "none";
    content.style.display = "block";
  }, (err) => {
    loadingMsg.textContent = "تعذر تحميل البيانات. تأكد من إعدادات القاعدة (Firestore Rules).";
    console.error(err);
  });
}

function render(requests) {
  // -------- بطاقات الملخص العام --------
  const total = requests.length;
  const done = requests.filter((r) => r.status === "done").length;
  const pending = requests.filter((r) => r.status === "sent").length;

  const responseTimes = requests
    .filter((r) => r.createdAt && r.receivedAt)
    .map((r) => (r.receivedAt.toDate() - r.createdAt.toDate()) / 1000 / 60);

  const avgMinutes = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  statTotal.textContent = total;
  statDone.textContent = done;
  statPending.textContent = pending;
  statAvgTime.textContent = avgMinutes !== null ? formatMinutes(avgMinutes) : "--";

  // -------- تجميع حسب القسم --------
  const byDept = {};
  DEPARTMENTS.forEach((d) => {
    byDept[d.id] = { name: d.name, count: 0, responseTimes: [], requests: [] };
  });
  byDept["_unknown"] = { name: "غير محدد", count: 0, responseTimes: [], requests: [] };

  requests.forEach((r) => {
    const key = byDept[r.department] ? r.department : "_unknown";
    byDept[key].count++;
    byDept[key].requests.push(r);
    if (r.createdAt && r.receivedAt) {
      byDept[key].responseTimes.push((r.receivedAt.toDate() - r.createdAt.toDate()) / 1000 / 60);
    }
  });

  const maxCount = Math.max(1, ...Object.values(byDept).map((d) => d.count));

  deptBreakdown.innerHTML = "";
  Object.entries(byDept).forEach(([key, d]) => {
    if (d.count === 0 && key === "_unknown") return;

    const avg = d.responseTimes.length
      ? d.responseTimes.reduce((a, b) => a + b, 0) / d.responseTimes.length
      : null;

    const row = document.createElement("div");
    row.className = "dept-row";
    row.innerHTML = `
      <div class="dept-row-top">
        <span class="dept-row-name">${d.name}</span>
        <span class="dept-row-stats">${d.count} استدعاء${avg !== null ? " · متوسط الاستجابة " + formatMinutes(avg) : ""}</span>
      </div>
      <div class="dept-bar-track">
        <div class="dept-bar-fill" style="width:${(d.count / maxCount) * 100}%;"></div>
      </div>
      <div class="dept-row-hint">${d.count > 0 ? "اضغط لعرض تفاصيل طلبات هذا القسم" : ""}</div>
    `;

    if (d.count > 0) {
      const detail = document.createElement("div");
      detail.className = "dept-detail" + (openDeptKey === key ? " open" : "");
      detail.appendChild(buildDeptDetail(d.requests));
      row.appendChild(detail);

      row.addEventListener("click", () => {
        const willOpen = !detail.classList.contains("open");
        // اقفلي كل التفاصيل المفتوحة الثانية
        document.querySelectorAll(".dept-detail.open").forEach((el) => el.classList.remove("open"));
        if (willOpen) {
          detail.classList.add("open");
          openDeptKey = key;
        } else {
          openDeptKey = null;
        }
      });
    }

    deptBreakdown.appendChild(row);
  });

  // -------- كل ملاحظات الممرضات (نظرة سريعة عامة) --------
  const withNotes = requests.filter((r) => r.note && r.note.trim().length > 0);

  commentsList.innerHTML = "";
  if (withNotes.length === 0) {
    commentsEmpty.style.display = "block";
  } else {
    commentsEmpty.style.display = "none";
    withNotes.forEach((r) => {
      const time = r.createdAt ? r.createdAt.toDate().toLocaleString("ar", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "";
      const item = document.createElement("div");
      item.className = "comment-item";
      item.innerHTML = `
        <div class="comment-meta">غرفة ${escapeHtml(String(r.room))} · ${escapeHtml(r.departmentName || "")} · ${escapeHtml(r.receivedBy || "")} · ${time}</div>
        <div class="comment-text">${escapeHtml(r.note)}</div>
      `;
      commentsList.appendChild(item);
    });
  }
}

// بناء قائمة تفاصيل طلبات قسم معين: وقت الطلب، مدة الاستجابة، مدة التنفيذ، والملاحظة
function buildDeptDetail(deptRequests) {
  const wrap = document.createElement("div");

  const sorted = [...deptRequests].sort((a, b) => {
    const ta = a.createdAt ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  sorted.forEach((r) => {
    const item = document.createElement("div");
    item.className = "detail-item";

    const requestTime = r.createdAt
      ? r.createdAt.toDate().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
      : "--";

    const responseDuration = (r.createdAt && r.receivedAt)
      ? formatMinutes((r.receivedAt.toDate() - r.createdAt.toDate()) / 1000 / 60)
      : "لم تُستلم بعد";

    const executionDuration = (r.receivedAt && r.doneAt)
      ? formatMinutes((r.doneAt.toDate() - r.receivedAt.toDate()) / 1000 / 60)
      : (r.status === "done" ? "--" : "لم يُنفَّذ بعد");

    item.innerHTML = `
      <div class="detail-item-top">
        <span class="detail-room">غرفة ${escapeHtml(String(r.room))}</span>
        <span class="badge ${r.status}">${r.status === "done" ? "تم التنفيذ" : r.status === "received" ? "قيد التنفيذ" : "طلب جديد"}</span>
      </div>
      <div class="detail-times">
        <span>🕐 وقت الطلب: ${requestTime}</span>
        <span>⏱️ مدة الاستجابة: ${responseDuration}</span>
        <span>✅ مدة التنفيذ: ${executionDuration}</span>
        ${r.receivedBy ? `<span>👤 ${escapeHtml(r.receivedBy)}</span>` : ""}
      </div>
    `;

    if (r.note) {
      const noteEl = document.createElement("div");
      noteEl.className = "detail-note";
      noteEl.innerHTML = `<strong>ملاحظة:</strong> ${escapeHtml(r.note)}`;
      item.appendChild(noteEl);
    }

    wrap.appendChild(item);
  });

  return wrap;
}

function formatMinutes(minutes) {
  if (minutes < 1) return `${Math.round(minutes * 60)} ثانية`;
  return `${minutes.toFixed(1)} دقيقة`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
