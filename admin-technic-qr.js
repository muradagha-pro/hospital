const qrContainer = document.getElementById("qrCode");
const qrDomainText = document.getElementById("qrDomainText");
const printBtn = document.getElementById("printBtn");
const openDomainBtn = document.getElementById("openDomainBtn");
const textBeforeInput = document.getElementById("textBeforeInput");
const textAfterInput = document.getElementById("textAfterInput");
const printTextBefore = document.getElementById("printTextBefore");
const printTextAfter = document.getElementById("printTextAfter");
const textFontSizeInput = document.getElementById("textFontSize");
const textAlignSelect = document.getElementById("textAlign");
const textBoldInput = document.getElementById("textBold");
const textItalicInput = document.getElementById("textItalic");
const printRoomNumber = document.getElementById("printRoomNumber");

const params = new URLSearchParams(window.location.search);
const domain = normalizeDomain(params.get("domain") || "");
const room = normalizeRoom(params.get("room") || "");
const roomUrl = domain && room ? buildRoomUrl(domain, room) : "";

if (!roomUrl) {
  qrDomainText.textContent = "تعذر إنشاء الرمز: تأكد من الرابط ورقم الغرفة";
  if (printRoomNumber) printRoomNumber.textContent = "";
} else {
  qrDomainText.textContent = `الغرفة ${room} - ${roomUrl}`;
  if (printRoomNumber) printRoomNumber.textContent = `رقم الغرفة: ${room}`;
  // High error correction keeps QR readable with center logo overlay.
  new QRCode(qrContainer, {
    text: roomUrl,
    width: 292,
    height: 292,
    correctLevel: QRCode.CorrectLevel.H,
  });
}

if (textBeforeInput && printTextBefore) {
  textBeforeInput.addEventListener("input", syncPrintText);
}

if (textAfterInput && printTextAfter) {
  textAfterInput.addEventListener("input", syncPrintText);
}

[textFontSizeInput, textAlignSelect, textBoldInput, textItalicInput].forEach((el) => {
  el?.addEventListener("input", applyTextStyle);
  el?.addEventListener("change", applyTextStyle);
});

syncPrintText();
applyTextStyle();

printBtn?.addEventListener("click", () => {
  const originalTitle = document.title;
  document.title = " ";
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 50);
});

openDomainBtn?.addEventListener("click", () => {
  if (!roomUrl) return;
  window.open(roomUrl, "_blank");
});

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

function normalizeRoom(value) {
  const room = String(value || "").trim();
  if (!/^\d+$/.test(room)) return "";
  const roomNum = Number(room);
  if (!Number.isFinite(roomNum) || roomNum <= 0) return "";
  return String(roomNum);
}

function buildRoomUrl(domainBase, roomNumber) {
  try {
    const url = new URL("patient.html", domainBase);
    url.searchParams.set("room", roomNumber);
    return url.toString();
  } catch {
    return "";
  }
}

function syncPrintText() {
  if (printTextBefore && textBeforeInput) {
    printTextBefore.textContent = textBeforeInput.value.trim();
  }
  if (printTextAfter && textAfterInput) {
    printTextAfter.textContent = textAfterInput.value.trim();
  }
}

function applyTextStyle() {
  const sizeRaw = Number(textFontSizeInput?.value || 22);
  const fontSize = Number.isFinite(sizeRaw) ? Math.min(72, Math.max(10, sizeRaw)) : 22;
  const textAlign = textAlignSelect?.value || "center";
  const fontWeight = textBoldInput?.checked ? "700" : "400";
  const fontStyle = textItalicInput?.checked ? "italic" : "normal";

  [printTextBefore, printTextAfter].forEach((el) => {
    if (!el) return;
    el.style.fontSize = `${fontSize}px`;
    el.style.textAlign = textAlign;
    el.style.fontWeight = fontWeight;
    el.style.fontStyle = fontStyle;
  });
}

