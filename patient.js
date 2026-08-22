import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { departmentForRoom } from "./departments.js";

// -------- تحديد رقم الغرفة والقسم --------
const params = new URLSearchParams(window.location.search);

const room = (params.get("room") || "").trim();
const hasValidRoom = /^\d+$/.test(room);

const dept = hasValidRoom
  ? departmentForRoom(room)
  : null;

document.getElementById("roomBadge").textContent = room || "؟";
document.getElementById("deptLabel").textContent =
  dept ? dept.name : "غير محدد";

const feedbackLink =
  document.getElementById("feedbackLink");

const cafeteriaLink =
  document.getElementById("cafeteriaLink");

configureRoomLink(
  feedbackLink,
  "feedback.html"
);

configureRoomLink(
  cafeteriaLink,
  "cafeteria-order.html"
);

const callBtn =
  document.getElementById("callBtn");

const callBtnText =
  document.getElementById("callBtnText");

const stepper =
  document.getElementById("stepper");

const statusLine =
  document.getElementById("statusLine");

const statusTime =
  document.getElementById("statusTime");

const cancelCallBtn =
  document.getElementById("cancelCallBtn");

const nodes = [
  document.getElementById("node1"),
  document.getElementById("node2"),
  document.getElementById("node3")
];

const labels = [
  document.getElementById("label1"),
  document.getElementById("label2"),
  document.getElementById("label3")
];

const STORAGE_KEY = hasValidRoom
  ? `activeRequest_room_${room}`
  : null;

let unsubscribe = null;
let autoCancelTimer = null;
let currentRequestId = null;

const AUTO_CANCEL_MS = 5 * 60 * 1000;

const existingId =
  STORAGE_KEY
    ? localStorage.getItem(STORAGE_KEY)
    : null;

if (existingId) {
  watchRequest(existingId);
}

if (!hasValidRoom) {
  blockCalling(
    "هذا الرابط غير صالح. يرجى مسح رمز QR الموجود داخل الغرفة مرة أخرى."
  );
} else if (!dept) {
  blockCalling(
    "لا يوجد قسم مرتبط بهذه الغرفة حالياً. يرجى مراجعة إعدادات الأقسام."
  );
}

callBtn.addEventListener("click", async () => {

  if (callBtn.disabled) return;

  if (!hasValidRoom) {
    alert("الرابط غير صالح. يرجى مسح رمز QR الصحيح للغرفة.");
    return;
  }

  if (!dept) {
    alert(
      "تعذر تحديد القسم المسؤول عن هذه الغرفة. الرجاء إبلاغ الإدارة لمراجعة رقم الغرفة."
    );
    return;
  }

  callBtn.disabled = true;
  callBtnText.textContent = "جارِ الإرسال...";

  try {

    const docRef =
      await addDoc(
        collection(db, "callRequests"),
        {
          room: room,
          department: dept.id,
          departmentName: dept.name,
          status: "sent",
          receivedBy: null,
          createdAt: serverTimestamp(),
          receivedAt: null,
          doneAt: null,
          note: ""
        }
      );

    if (STORAGE_KEY) {
      localStorage.setItem(
        STORAGE_KEY,
        docRef.id
      );
    }

    watchRequest(docRef.id);

  } catch (err) {

    alert(
      "تعذر إرسال الطلب. الرجاء التحقق من الاتصال بالإنترنت والمحاولة مجدداً."
    );

    console.error(err);

    callBtn.disabled = false;
    callBtnText.textContent = "استدعاء الممرضة";
  }

});

cancelCallBtn.addEventListener("click", async () => {
  await cancelActiveRequest("patient");
});

function watchRequest(requestId) {

  if (unsubscribe) unsubscribe();

  currentRequestId = requestId;

  callBtn.disabled = true;
  callBtn.classList.add("waiting");

  stepper.classList.add("visible");

  unsubscribe =
    onSnapshot(
      doc(db, "callRequests", requestId),
      (snap) => {

        if (!snap.exists()) return;

        const data = snap.data();

        renderStatus(data);

        const cancellable =
          data.status === "sent" || data.status === "received";
        cancelCallBtn.style.display = cancellable ? "block" : "none";

        if (data.status === "sent") {
          scheduleAutoCancel(data.createdAt);
        } else {
          clearAutoCancel();
        }

        if (data.status === "done") {

          callBtn.classList.remove("waiting");

          setTimeout(() => {

            releaseActiveRequest();

          }, 6000);

        }

        if (data.status === "cancelled") {
          callBtn.classList.remove("waiting");
          statusLine.textContent = "تم إلغاء الاستدعاء";
          statusTime.textContent = data.cancelledAt
            ? `وقت الإلغاء: ${formatTime(data.cancelledAt)}`
            : "";

          setTimeout(() => {
            releaseActiveRequest();
          }, 2500);
        }

      }
    );
}

function blockCalling(message) {
  callBtn.disabled = true;
  callBtn.classList.remove("waiting");
  callBtnText.textContent = "غير متاح";
  stepper.classList.remove("visible");
  cancelCallBtn.style.display = "none";
  statusLine.textContent = message;
  statusTime.textContent = "";
}

function configureRoomLink(linkEl, pagePath) {
  if (!linkEl) return;

  if (hasValidRoom) {
    linkEl.href =
      `${pagePath}?room=${encodeURIComponent(room)}`;
    linkEl.classList.remove("disabled");
    linkEl.removeAttribute("aria-disabled");
    return;
  }

  linkEl.href = "#";
  linkEl.classList.add("disabled");
  linkEl.setAttribute("aria-disabled", "true");
}

function renderStatus(data) {

  const order = [
    "sent",
    "received",
    "done"
  ];

  const currentIndex =
    order.indexOf(data.status);

  nodes.forEach((node, i) => {

    node.classList.remove(
      "active",
      "done"
    );

    labels[i].classList.remove(
      "active"
    );

    if (i < currentIndex)
      node.classList.add("done");

    if (i === currentIndex) {
      node.classList.add("active");
      labels[i].classList.add("active");
    }

    if (i < currentIndex)
      labels[i].classList.add("active");

  });

  if (data.status === "sent") {
    statusLine.textContent = "تم إرسال الطلب للممرضة";
    statusTime.textContent = data.createdAt
      ? `وقت الإرسال: ${formatTime(data.createdAt)}`
      : "";
    callBtnText.textContent = "تم الإرسال";
  } else if (data.status === "received") {
    statusLine.textContent = "الممرضة استلمت الطلب";
    statusTime.textContent = data.receivedAt
      ? `وقت الاستلام: ${formatTime(data.receivedAt)}`
      : "";
    callBtnText.textContent = "قيد التنفيذ";
  } else if (data.status === "done") {
    statusLine.textContent = "تم تنفيذ الطلب";
    statusTime.textContent = data.doneAt
      ? `وقت التنفيذ: ${formatTime(data.doneAt)}`
      : "";
    callBtnText.textContent = "تم التنفيذ";
  } else if (data.status === "cancelled") {
    statusLine.textContent = "تم إلغاء الاستدعاء";
    statusTime.textContent = data.cancelledAt
      ? `وقت الإلغاء: ${formatTime(data.cancelledAt)}`
      : "";
    callBtnText.textContent = "تم الإلغاء";
  } else {
    statusLine.textContent = "";
    statusTime.textContent = "";
  }

}

function formatTime(ts) {
  return ts && typeof ts.toDate === "function"
    ? ts.toDate().toLocaleString("ar", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";
}

function scheduleAutoCancel(createdAt) {
  clearAutoCancel();

  if (!createdAt || typeof createdAt.toDate !== "function") return;

  const elapsed = Date.now() - createdAt.toDate().getTime();
  const remaining = AUTO_CANCEL_MS - elapsed;

  if (remaining <= 0) {
    cancelActiveRequest("timeout");
    return;
  }

  autoCancelTimer = setTimeout(() => {
    cancelActiveRequest("timeout");
  }, remaining);
}

function clearAutoCancel() {
  if (autoCancelTimer) {
    clearTimeout(autoCancelTimer);
    autoCancelTimer = null;
  }
}

async function cancelActiveRequest(cancelledBy) {
  if (!currentRequestId) return;

  cancelCallBtn.disabled = true;
  try {
    const ref = doc(db, "callRequests", currentRequestId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      const status = snap.data().status;
      if (status === "done" || status === "cancelled") return;

      tx.update(ref, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy,
      });
    });
  } catch (err) {
    console.error(err);
    alert("تعذر إلغاء الاستدعاء حالياً");
  } finally {
    cancelCallBtn.disabled = false;
  }
}

function releaseActiveRequest() {
  clearAutoCancel();

  if (STORAGE_KEY) {
    localStorage.removeItem(STORAGE_KEY);
  }

  stepper.classList.remove("visible");
  callBtn.disabled = false;
  callBtn.classList.remove("waiting");
  callBtnText.textContent = "استدعاء الممرضة";
  cancelCallBtn.style.display = "none";
  currentRequestId = null;

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

