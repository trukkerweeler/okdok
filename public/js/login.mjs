const form = document.querySelector("#loginForm");
const errorMessage = document.querySelector("#loginError");
const submitButton = document.querySelector("#submitButton");

function getDestination() {
  const destination = new URLSearchParams(window.location.search).get("next");
  return destination && destination.startsWith("/") && !destination.startsWith("//")
    ? destination
    : "/transactions.html";
}

async function redirectIfAuthenticated() {
  const response = await fetch("/auth/status", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Unable to check login status.");
  }
  const auth = await response.json();
  if (auth.loggedIn) {
    window.location.replace(getDestination());
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  submitButton.disabled = true;

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: form.elements.username.value,
        password: form.elements.password.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Login failed.");
    }
    window.location.replace(getDestination());
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

redirectIfAuthenticated().catch((error) => {
  errorMessage.textContent = error.message;
  errorMessage.hidden = false;
});
