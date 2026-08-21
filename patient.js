import { db } from "./firebase-config.js";
import {
  collection, addDoc, doc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { departmentForRoom } from "./departments.js";

// -------- تحديد رقم الغرفة والقسم --------
// يُقرأ رقم الغرفة من رابط QR الخاص بالغرفة، مثال: patient.html?room=204
// والقسم يُحدَّد تلقائياً حسب مجال رقم الغرفة (معرّف بملف departments.js)
const params = new URLSearchParams(window.location.search);
let room = params.get("room");

if (!room) {
  room = prompt("لم يتم تحديد رقم الغرفة تلقائياً. الرجاء إدخال رقم الغرفة:");
}

const dept = departmentForRoom(room);

document.getElementById("roomBadge").textContent = room || "؟";
document.getElementById("deptLabel").textContent = dept ? dept.name : "غير محدد";

const callBtn = document.getElementById("callBtn");
const callBtnText = document.getElementById("callBtnText");
const stepper = document.getElementById("stepper");
const statusLine = document.getElementById("statusLine");
const statusTime = document.getElementById("statusTime");
const nodes = [document.getElementById("node1"), document.getElementById("node2"), document.getElementById("node3")];
const labels = [document.getElementById("label1"), document.getElementById("label2"), document.getElementById("label3")];

const STORAGE_KEY = `activeRequest_room_${room}`;
let unsubscribe = null;

const existingId = localStorage.getItem(STORAGE_KEY);
if (existingId) {
  watchRequest(existingId);
}

callBtn.addEventListener("click", async () => {
  if (callBtn.disabled) return;

  if (!dept) {
    alert("تعذر تحديد القسم المسؤول عن هذه الغرفة. الرجاء إبلاغ الإدارة لمراجعة رقم الغرفة.");
    return;
  }

  callBtn.disabled = true;
  callBtnText.textContent = "جارِ الإرسال...";

  try {
    const docRef = await addDoc(collection(db, "callRequests"), {
      room: room,
      department: dept.id,
      departmentName: dept.name,
      status: "sent",
      receivedBy: null,
      createdAt: serverTimestamp(),
      receivedAt: null,
      doneAt: null,
      note: "",
    });
    localStorage.setItem(STORAGE_KEY, docRef.id);
    watchRequest(docRef.id);
  } catch (err) {
    alert("تعذر إرسال الطلب. الرجاء التحقق من الاتصال بالإنترنت والمحاولة مجدداً.");
    console.error(err);
    callBtn.disabled = false;
    callBtnText.textContent = "استدعاء الممرضة";
  }
});

function watchRequest(requestId) {
  if (unsubscribe) unsubscribe();

  callBtn.disabled = true;
  callBtn.classList.add("waiting");
  stepper.classList.add("visible");

  unsubscribe = onSnapshot(doc(db, "callRequests", requestId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderStatus(data);

    if (data.status === "done") {
      callBtn.classList.remove("waiting");
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        stepper.classList.remove("visible");
        callBtn.disabled = false;
        callBtnText.textContent = "استدعاء الممرضة";
        if (unsubscribe) unsubscribe();
      }, 6000);
    }
  });
}

function renderStatus(data) {
  const order = ["sent", "received", "done"];
  const currentIndex = order.indexOf(data.status);

  nodes.forEach((node, i) => {
    node.classList.remove("active", "done");
    labels[i].classList.remove("active");
    if (i < currentIndex) node.classList.add("done");
    if (i === currentIndex) { node.classList.add("active"); labels[i].classList.add("active"); }
  });

  if (data.status === "sent") {
    statusLine.textContent = "تم إرسال طلبك، بانتظار استلام الممرضة";
    callBtnText.textContent = "تم إرسال الطلب";
  } else if (data.status === "received") {
    statusLine.textContent = data.receivedBy
      ? `الممرضة ${data.receivedBy} في الطريق إليك`
      : "الطلب قيد التنفيذ";
    callBtnText.textContent = "قيد التنفيذ";
  } else if (data.status === "done") {
    statusLine.textContent = "تم تنفيذ طلبك ✓";
    callBtnText.textContent = "تم التنفيذ";
  }

  statusTime.textContent = new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}
