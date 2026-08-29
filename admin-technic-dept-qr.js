const qrContainer = document.getElementById("qrCode");
const statusText = document.getElementById("statusText");
const deptNameText = document.getElementById("deptNameText");
const printBtn = document.getElementById("printBtn");
const openLinkBtn = document.getElementById("openLinkBtn");

const params = new URLSearchParams(window.location.search);
const domain = normalizeDomain(params.get("domain") || "");
const deptId = String(params.get("deptId") || "").trim();
const deptName = String(params.get("deptName") || "").trim();
const departmentUrl = domain && deptId ? buildDepartmentUrl(domain, deptId) : "";

if (!departmentUrl) {
  statusText.textContent = "تعذر إنشاء QR القسم: تأكد من الدومين ورمز القسم";
  deptNameText.textContent = deptName || "--";
} else {
  statusText.textContent = "رمز القسم جاهز للطباعة";
  deptNameText.textContent = deptName || deptId;

  new QRCode(qrContainer, {
    text: departmentUrl,
    width: 292,
    height: 292,
    correctLevel: QRCode.CorrectLevel.H,
  });
}

printBtn?.addEventListener("click", () => {
  const originalTitle = document.title;
  document.title = " ";
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 50);
});

openLinkBtn?.addEventListener("click", () => {
  if (!departmentUrl) return;
  window.open(departmentUrl, "_blank");
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

function buildDepartmentUrl(domainBase, id) {
  try {
    const url = new URL("nurse.html", domainBase);
    url.searchParams.set("dept", id);
    return url.toString();
  } catch {
    return "";
  }
}

