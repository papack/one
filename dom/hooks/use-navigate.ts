function isExternalUrl(url: string): boolean {
  return url.includes("://");
}

function notifyLocationChange() {
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useNavigate() {
  const navigate = (to: string | ((prev: string) => string)) => {
    // Current full location
    const current =
      window.location.pathname + window.location.search + window.location.hash;

    // Resolve next target
    const next = typeof to === "function" ? to(current) : to;

    // Redirect external URLs normally
    if (isExternalUrl(next)) {
      window.location.href = next;
      return;
    }

    // Create absolute URL relative to current origin
    // This ensures pathname, search params, and hash
    // are fully replaced by the new target
    const url = new URL(next, window.location.origin);

    // Build final URL
    const finalUrl = url.pathname + url.search + url.hash;

    // Push new history entry
    window.history.pushState(null, "", finalUrl);

    // Notify listeners/hooks manually
    notifyLocationChange();
  };

  return {
    navigate,
  };
}
