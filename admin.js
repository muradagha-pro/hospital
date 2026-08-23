import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { DEPARTMENTS, refreshDepartments } from "./departments.js";

const rangeToday = document.getElementById("rangeToday");
const rangeWeek = document.getElementById("rangeWeek");
const loadingMsg = document.getElementById("loadingMsg");
const content = document.getElementById("content");

const statTotal = document.getElementById("statTotal");
const statAvgTime = document.getElementById("statAvgTime");

const callSummaryRow = document.getElementById("callSummaryRow");
const callSummaryDetail = document.getElementById("callSummaryDetail");
const callBreakdownEmpty = document.getElementById("callBreakdownEmpty");
const deptBreakdown = document.getElementById("deptBreakdown");

const cafeSummaryRow = document.getElementById("cafeSummaryRow");
const cafeStatTotal = document.getElementById("cafeStatTotal");
const cafeStatRevenue = document.getElementById("cafeStatRevenue");
const cafeSummaryDetail = document.getElementById("cafeSummaryDetail");
const cafeRoomBreakdown = document.getElementById("cafeRoomBreakdown");
const cafeRoomsEmpty = document.getElementById("cafeRoomsEmpty");

const commentsList = document.getElementById("commentsList");
const commentsEmpty = document.getElementById("commentsEmpty");
const commentsSummaryRow = document.getElementById("commentsSummaryRow");
const commentsDetail = document.getElementById("commentsDetail");
const commentsCount = document.getElementById("commentsCount");

const feedbackList = document.getElementById("feedbackList");
const feedbackEmpty = document.getElementById("feedbackEmpty");
const feedbackSummaryRow = document.getElementById("feedbackSummaryRow");
const feedbackDetail = document.getElementById("feedbackDetail");
const feedbackCount = document.getElementById("feedbackCount");
const feedbackEmptyDefaultText = feedbackEmpty ? feedbackEmpty.textContent.trim() : "";

let callsUnsubscribe = null;
let cafeUnsubscribe = null;
let currentRange = "today";
let latestRequests = [];
let latestCafeOrders = [];
let openCallDeptKey = null;
let openCallRoomKeyByDept = {};
let openCafeRoomKey = null;

rangeToday.addEventListener("click", () => setRange("today"));
rangeWeek.addEventListener("click", () => setRange("week"));

commentsSummaryRow.addEventListener("click", (event) => {
  if (commentsDetail.contains(event.target)) return;
  const willOpen = !commentsDetail.classList.contains("open");
  commentsDetail.classList.toggle("open", willOpen);
});

feedbackSummaryRow.addEventListener("click", (event) => {
  if (feedbackDetail.contains(event.target)) return;
  const willOpen = !feedbackDetail.classList.contains("open");
  feedbackDetail.classList.toggle("open", willOpen);
});

callSummaryRow.addEventListener("click", (event) => {
  if (callSummaryDetail.contains(event.target)) return;
  const willOpen = !callSummaryDetail.classList.contains("open");
  callSummaryDetail.classList.toggle("open", willOpen);
  renderCallBreakdownByDept(latestRequests);
});

cafeSummaryRow.addEventListener("click", (event) => {
  if (cafeSummaryDetail.contains(event.target)) return;
  const willOpen = !cafeSummaryDetail.classList.contains("open");
  cafeSummaryDetail.classList.toggle("open", willOpen);
  renderCafeteriaByRoom(latestCafeOrders);
});

initAdminPage();

async function initAdminPage() {
  await refreshDepartments();
  setRange("today");
  listenForFeedbacks();
}

function setRange(range) {
  currentRange = range;
  rangeToday.classList.toggle("active", range === "today");
  rangeWeek.classList.toggle("active", range === "week");
  openCallDeptKey = null;
  openCallRoomKeyByDept = {};
  openCafeRoomKey = null;
  loadData();
}

function loadData() {
  if (callsUnsubscribe) { callsUnsubscribe(); callsUnsubscribe = null; }
  if (cafeUnsubscribe) { cafeUnsubscribe(); cafeUnsubscribe = null; }

  loadingMsg.style.display = "block";
  content.style.display = "none";

  const start = new Date();
  if (currentRange === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 7);
  }
  const startTimestamp = Timestamp.fromDate(start);

  const callsQuery = query(
    collection(db, "callRequests"),
    where("createdAt", ">=", startTimestamp),
    orderBy("createdAt", "desc")
  );

  callsUnsubscribe = onSnapshot(callsQuery, (snapshot) => {
    latestRequests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCallSummary(latestRequests);
    renderCallBreakdownByDept(latestRequests);
    renderNurseNotes(latestRequests);
    loadingMsg.style.display = "none";
    content.style.display = "block";
  }, (err) => {
    loadingMsg.textContent = "تعذر تحميل البيانات. تأكد من إعدادات القاعدة (Firestore Rules).";
    console.error(err);
  });

  loadCafeteriaData();
}

function renderCallSummary(requests) {
  const total = requests.length;

  const responseTimes = requests
    .filter((r) => r.createdAt && r.receivedAt)
    .map((r) => (r.receivedAt.toDate() - r.createdAt.toDate()) / 1000 / 60);

  const avgMinutes = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  statTotal.textContent = String(total);
  statAvgTime.textContent = avgMinutes !== null ? formatMinutes(avgMinutes) : "--";
}

function renderCallBreakdownByDept(requests) {
  deptBreakdown.innerHTML = "";

  if (requests.length === 0) {
    callBreakdownEmpty.style.display = "block";
    return;
  }
  callBreakdownEmpty.style.display = "none";

  const byDept = {};
  DEPARTMENTS.forEach((d) => {
    byDept[d.id] = { name: d.name, count: 0, byRoom: {}, responseTimes: [] };
  });
  byDept._unknown = { name: "غير محدد", count: 0, byRoom: {}, responseTimes: [] };

  requests.forEach((r) => {
    const deptKey = byDept[r.department] ? r.department : "_unknown";
    const roomKey = String(r.room || "غير محدد");
    byDept[deptKey].count += 1;
    if (!byDept[deptKey].byRoom[roomKey]) {
      byDept[deptKey].byRoom[roomKey] = { count: 0, calls: [] };
    }
    byDept[deptKey].byRoom[roomKey].count += 1;
    byDept[deptKey].byRoom[roomKey].calls.push(r);

    if (r.createdAt && r.receivedAt) {
      byDept[deptKey].responseTimes.push(
        (r.receivedAt.toDate() - r.createdAt.toDate()) / 1000 / 60
      );
    }
  });

  Object.entries(byDept)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([deptKey, info]) => {
      const deptAvg = info.responseTimes.length
        ? info.responseTimes.reduce((a, b) => a + b, 0) / info.responseTimes.length
        : null;

      const row = document.createElement("div");
      row.className = "dept-row";
      row.innerHTML = `
        <div class="dept-row-top">
          <span class="dept-row-name">${escapeHtml(info.name)}</span>
          <span class="dept-row-stats">${info.count} استدعاء${deptAvg !== null ? ` · متوسط ${formatMinutes(deptAvg)}` : " · متوسط --"}</span>
        </div>
        <div class="dept-row-hint">اضغط لعرض إجمالي الاستدعاءات حسب الغرف</div>
      `;

      const detail = document.createElement("div");
      detail.className = "dept-detail" + (openCallDeptKey === deptKey ? " open" : "");

      const roomsWrap = document.createElement("div");
      const openRoomKey = openCallRoomKeyByDept[deptKey] || null;
      const rooms = Object.entries(info.byRoom).sort((a, b) => {
        const aa = Number(a[0]);
        const bb = Number(b[0]);
        if (Number.isFinite(aa) && Number.isFinite(bb)) return aa - bb;
        return a[0].localeCompare(b[0], "ar");
      });

      rooms.forEach(([room, roomInfo]) => {
        const roomRow = document.createElement("div");
        roomRow.className = "dept-row";
        roomRow.style.marginTop = "8px";
        roomRow.innerHTML = `
          <div class="dept-row-top">
            <span class="dept-row-name">غرفة ${escapeHtml(room)}</span>
            <span class="dept-row-stats">${roomInfo.count} استدعاء</span>
          </div>
          <div class="dept-row-hint">اضغط لعرض قائمة الاستدعاءات</div>
        `;

        const roomDetail = document.createElement("div");
        roomDetail.className = "dept-detail";

        const callsWrap = document.createElement("div");
        const sortedCalls = [...roomInfo.calls].sort((a, b) => {
          const ta = a.createdAt && typeof a.createdAt.toMillis === "function"
            ? a.createdAt.toMillis()
            : 0;
          const tb = b.createdAt && typeof b.createdAt.toMillis === "function"
            ? b.createdAt.toMillis()
            : 0;
          return tb - ta;
        });

        sortedCalls.forEach((call) => {
          const time = call.createdAt && typeof call.createdAt.toDate === "function"
            ? call.createdAt.toDate().toLocaleString("ar", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })
            : "--";

          const callItem = document.createElement("div");
          callItem.className = "detail-item";
          callItem.style.marginTop = "8px";
          callItem.innerHTML = `
            <div class="detail-item-top">
              <span class="badge ${escapeHtml(call.status || "sent")}">${statusLabel(call.status)}</span>
              <span class="detail-room">${time}</span>
            </div>
            <div class="detail-times">
              <span>${escapeHtml(call.departmentName || info.name)}</span>
              ${call.receivedBy ? `<span>بواسطة ${escapeHtml(call.receivedBy)}</span>` : ""}
            </div>
          `;
          callsWrap.appendChild(callItem);
        });

        roomDetail.appendChild(callsWrap);
        roomRow.appendChild(roomDetail);

        roomRow.addEventListener("click", (event) => {
          event.stopPropagation();
          const willOpen = !roomDetail.classList.contains("open");
          roomsWrap.querySelectorAll(".dept-detail.open")
            .forEach((el) => el.classList.remove("open"));
          if (willOpen) {
            roomDetail.classList.add("open");
            openCallRoomKeyByDept[deptKey] = room;
          } else {
            openCallRoomKeyByDept[deptKey] = null;
          }
        });

        if (openRoomKey === room) {
          roomDetail.classList.add("open");
        }

        roomsWrap.appendChild(roomRow);
      });

      detail.appendChild(roomsWrap);
      row.appendChild(detail);

      row.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = !detail.classList.contains("open");
        document.querySelectorAll("#deptBreakdown .dept-detail.open")
          .forEach((el) => el.classList.remove("open"));
        if (willOpen) {
          detail.classList.add("open");
          openCallDeptKey = deptKey;
        } else {
          openCallDeptKey = null;
          openCallRoomKeyByDept[deptKey] = null;
        }
      });

      deptBreakdown.appendChild(row);
    });
}

function statusLabel(status) {
  if (status === "done") return "تم التنفيذ";
  if (status === "received") return "قيد التنفيذ";
  if (status === "cancelled") return "تم الإلغاء";
  return "طلب جديد";
}

function renderNurseNotes(requests) {
  const withNotes = requests.filter((r) => r.note && r.note.trim().length > 0);
  commentsCount.textContent = String(withNotes.length);

  commentsList.innerHTML = "";
  if (withNotes.length === 0) {
    commentsEmpty.style.display = "block";
    return;
  }

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

function loadCafeteriaData() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startTimestamp = Timestamp.fromDate(start);

  const q = query(
    collection(db, "cafeteriaOrders"),
    where("createdAt", ">=", startTimestamp),
    orderBy("createdAt", "desc")
  );

  cafeUnsubscribe = onSnapshot(q, (snapshot) => {
    latestCafeOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCafeteriaSummary(latestCafeOrders);
    if (cafeSummaryDetail.classList.contains("open")) {
      renderCafeteriaByRoom(latestCafeOrders);
    }
  }, (err) => {
    console.error(err);
    cafeStatTotal.textContent = "--";
    cafeStatRevenue.textContent = "--";
    cafeRoomBreakdown.innerHTML = "";
    cafeRoomsEmpty.style.display = "block";
    cafeRoomsEmpty.textContent = "تعذر تحميل طلبات الكافتيريا حالياً.";
  });
}

function renderCafeteriaSummary(orders) {
  const total = orders.length;
  const revenue = orders
    .filter((o) => o.status === "done")
    .reduce((sum, o) => sum + (Number.isFinite(Number(o.total)) ? Number(o.total) : 0), 0);

  cafeStatTotal.textContent = String(total);
  cafeStatRevenue.textContent = `${revenue.toFixed(2)} ل.س`;
}

function renderCafeteriaByRoom(orders) {
  cafeRoomBreakdown.innerHTML = "";

  if (orders.length === 0) {
    cafeRoomsEmpty.style.display = "block";
    cafeRoomsEmpty.textContent = "لا توجد طلبات كافتيريا اليوم";
    return;
  }

  cafeRoomsEmpty.style.display = "none";

  const byRoom = {};
  orders.forEach((o) => {
    const key = String(o.room || "غير محدد");
    if (!byRoom[key]) {
      byRoom[key] = { count: 0, total: 0 };
    }
    byRoom[key].count += 1;
    byRoom[key].total += Number.isFinite(Number(o.total)) ? Number(o.total) : 0;
  });

  Object.entries(byRoom)
    .sort((a, b) => {
      const aa = Number(a[0]);
      const bb = Number(b[0]);
      if (Number.isFinite(aa) && Number.isFinite(bb)) return aa - bb;
      return a[0].localeCompare(b[0], "ar");
    })
    .forEach(([roomKey, info]) => {
      const row = document.createElement("div");
      row.className = "dept-row";

      row.innerHTML = `
        <div class="dept-row-top">
          <span class="dept-row-name">غرفة ${escapeHtml(roomKey)}</span>
          <span class="dept-row-stats">${info.count} طلب</span>
        </div>
        <div class="dept-row-hint">اضغط لعرض إجمالي طلبات هذه الغرفة</div>
      `;

      const detail = document.createElement("div");
      detail.className = "dept-detail" + (openCafeRoomKey === roomKey ? " open" : "");
      detail.innerHTML = `
        <div class="detail-item" style="margin-top:8px;">
          <div class="detail-times">
            <span>عدد الطلبات: ${info.count}</span>
            <span>إجمالي المبلغ: ${info.total.toFixed(2)} ل.س</span>
          </div>
        </div>
      `;

      row.appendChild(detail);
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = !detail.classList.contains("open");
        document.querySelectorAll("#cafeRoomBreakdown .dept-detail.open")
          .forEach((el) => el.classList.remove("open"));
        if (willOpen) {
          detail.classList.add("open");
          openCafeRoomKey = roomKey;
        } else {
          openCafeRoomKey = null;
        }
      });

      cafeRoomBreakdown.appendChild(row);
    });
}

function listenForFeedbacks() {
  const q = query(
    collection(db, "feedbacks"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    feedbackList.innerHTML = "";
    feedbackCount.textContent = String(snapshot.size);

    if (snapshot.empty) {
      if (feedbackEmptyDefaultText) feedbackEmpty.textContent = feedbackEmptyDefaultText;
      feedbackEmpty.style.display = "block";
      return;
    }

    if (feedbackEmptyDefaultText) feedbackEmpty.textContent = feedbackEmptyDefaultText;
    feedbackEmpty.style.display = "none";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const time = data.createdAt
        ? data.createdAt.toDate().toLocaleString("ar", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      const item = document.createElement("div");
      item.className = "comment-item";
      item.innerHTML = `
        <div class="comment-meta">
          غرفة ${escapeHtml(String(data.room || ""))}
          ·
          ${data.type === "complaint" ? "شكوى" : "اقتراح"}
          ·
          ${time}
        </div>

        <div class="comment-text">
          <strong>${escapeHtml(data.title || "")}</strong>
        </div>

        <div class="comment-text" style="margin-top:8px;">
          ${escapeHtml(data.message || "")}
        </div>
      `;

      feedbackList.appendChild(item);
    });
  }, (err) => {
    console.error(err);
    feedbackList.innerHTML = "";
    feedbackEmpty.textContent = "تعذر تحميل الشكاوى والاقتراحات حالياً. يرجى المحاولة لاحقاً.";
    feedbackEmpty.style.display = "block";
  });
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
