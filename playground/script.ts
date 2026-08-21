document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-post]");
  if (!el) return;

  const url = el.dataset.post;
  const selector = el.dataset.swap;

  if (!url || !selector) {
    console.error("Missing data-post or data-swap");
    return;
  }

  const target = document.querySelector(selector);

  if (!target) {
    console.error(`Target not found: ${selector}`);
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    target.innerHTML = await response.text();
  } catch (error) {
    console.error("Request failed:", error);
  }
});
