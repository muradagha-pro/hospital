import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);

const room = params.get("room") || "";

const roomNumber = document.getElementById("roomNumber");
const feedbackType = document.getElementById("feedbackType");
const feedbackTitle = document.getElementById("feedbackTitle");
const feedbackMessage = document.getElementById("feedbackMessage");
const sendFeedbackBtn = document.getElementById("sendFeedbackBtn");
const successMsg = document.getElementById("successMsg");

roomNumber.textContent = room || "غير محدد";

sendFeedbackBtn.addEventListener("click", async () => {

  const title = feedbackTitle.value.trim();
  const message = feedbackMessage.value.trim();

  if (!title) {
    alert("يرجى إدخال عنوان الرسالة");
    return;
  }

  if (!message) {
    alert("يرجى كتابة تفاصيل الرسالة");
    return;
  }

  sendFeedbackBtn.disabled = true;
  sendFeedbackBtn.textContent = "جارِ الإرسال...";

  try {

    await addDoc(collection(db, "feedbacks"), {
      room,
      type: feedbackType.value,
      title,
      message,
      status: "new",
      createdAt: serverTimestamp()
    });

    feedbackTitle.value = "";
    feedbackMessage.value = "";

    successMsg.style.display = "block";

    setTimeout(() => {
      successMsg.style.display = "none";
    }, 5000);

  } catch (err) {

    console.error(err);

    alert(
      "تعذر إرسال الرسالة. الرجاء التحقق من الاتصال والمحاولة مرة أخرى."
    );

  } finally {

    sendFeedbackBtn.disabled = false;
    sendFeedbackBtn.textContent = "إرسال";

  }

});
