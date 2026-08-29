const USERNAME = "abdulkarim";
const PASSWORD = "AbdulKarim";
const SESSION_KEY = "adminTechnicAuth";

const loginCard = document.getElementById("technicLoginCard");
const contentCard = document.getElementById("technicContent");
const usernameInput = document.getElementById("technicUsername");
const passwordInput = document.getElementById("technicPassword");
const loginBtn = document.getElementById("technicLoginBtn");
const loginError = document.getElementById("technicLoginError");

init();

function init() {
  if (isAuthenticated()) {
    showContent();
    return;
  }

  showLogin();

  loginBtn?.addEventListener("click", handleLogin);
  [usernameInput, passwordInput].forEach((input) => {
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    });
  });
}

function handleLogin() {
  const enteredUsername = String(usernameInput?.value || "").trim();
  const enteredPassword = String(passwordInput?.value || "");

  const valid = enteredUsername === USERNAME && enteredPassword === PASSWORD;

  if (!valid) {
    if (loginError) loginError.style.display = "block";
    return;
  }

  if (loginError) loginError.style.display = "none";
  sessionStorage.setItem(SESSION_KEY, "1");
  showContent();
}

function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

async function showContent() {
  if (loginCard) loginCard.style.display = "none";
  if (contentCard) contentCard.style.display = "block";

  await import("./admin-departments.js");
  await import("./admin-technic.js");
}

function showLogin() {
  if (loginCard) loginCard.style.display = "block";
  if (contentCard) contentCard.style.display = "none";
}

