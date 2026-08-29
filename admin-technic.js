const qrDomainInput = document.getElementById("qrDomain");
const qrRoomInput = document.getElementById("qrRoom");
const generateQrPageBtn = document.getElementById("generateQrPageBtn");

if (generateQrPageBtn && qrDomainInput && qrRoomInput) {
  generateQrPageBtn.addEventListener("click", () => {
    const normalizedDomain = normalizeDomain(qrDomainInput.value);
    if (!normalizedDomain) {
      alert("يرجى إدخال رابط نظام صحيح");
      return;
    }

    const room = normalizeRoom(qrRoomInput.value);
    if (!room) {
      alert("يرجى إدخال رقم غرفة صحيح");
      return;
    }

    const targetUrl = `admin-technic-qr.html?domain=${encodeURIComponent(normalizedDomain)}&room=${encodeURIComponent(room)}`;
    const popup = window.open(targetUrl, "_blank");

    // Fallback when popups are blocked.
    if (!popup) {
      window.location.href = targetUrl;
    }
  });

  [qrDomainInput, qrRoomInput].forEach((input) => input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      generateQrPageBtn.click();
    }
  }));
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

function normalizeRoom(value) {
  const room = String(value || "").trim();
  if (!/^\d+$/.test(room)) return "";
  const roomNum = Number(room);
  if (!Number.isFinite(roomNum) || roomNum <= 0) return "";
  return String(roomNum);
}

