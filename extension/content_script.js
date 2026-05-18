/* Content script — runs at document_idle on every page */

const TOS_PATTERNS = [
  /terms\s+of\s+(service|use)/i,
  /privacy\s+policy/i,
  /cookie\s+policy/i,
  /user\s+agreement/i,
  /end[\s-]user\s+licen[sc]e/i,
  /\beula\b/i,
  /legal\s+notice/i,
  /data\s+processing\s+(agreement|addendum)/i,
  /acceptable\s+use\s+policy/i,
];

const URL_KEYWORDS = [
  "terms", "privacy", "policy", "legal", "eula",
  "agreement", "cookies", "tos", "tos-", "data-use",
];

// Backend URL — loaded from storage, falls back to default
let _backendUrl = "http://127.0.0.1:8000";
chrome.storage.sync.get({ backendUrl: "http://127.0.0.1:8000" }, (result) => {
  _backendUrl = result.backendUrl;
});

// ─── Page Detection ──────────────────────────────────────────────────────────

function isToSPage() {
  const url = window.location.href.toLowerCase();
  if (URL_KEYWORDS.some(k => url.includes(k))) return true;

  const title = document.title;
  if (TOS_PATTERNS.some(re => re.test(title))) return true;

  const headings = Array.from(document.querySelectorAll("h1, h2"));
  return headings.some(h => TOS_PATTERNS.some(re => re.test(h.textContent)));
}

// ─── Text Extraction ─────────────────────────────────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IFRAME",
  "NAV", "FOOTER", "HEADER", "ASIDE",
]);

const SKIP_CLASS_FRAGMENTS = [
  "cookie-banner", "cookie-bar", "gdpr", "consent",
  "nav", "footer", "header", "sidebar", "advertisement", "ad-",
];

function shouldSkipElement(el) {
  if (SKIP_TAGS.has(el.tagName)) return true;
  const cls = (el.getAttribute("class") || "").toLowerCase();
  const id  = (el.id || "").toLowerCase();
  return SKIP_CLASS_FRAGMENTS.some(f => cls.includes(f) || id.includes(f));
}

function isVisible(el) {
  const s = window.getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
}

function extractVisibleText() {
  const root =
    document.querySelector("main, article, [role='main'], #content, .content, #main, .main") ||
    document.body;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (shouldSkipElement(node)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_SKIP;
        }
        const text = node.textContent.trim();
        if (!text) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent && !isVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const lines = [];
  let node;
  while ((node = walker.nextNode())) {
    lines.push(node.textContent.trim());
  }
  return lines.join("\n");
}

// ─── Script Loaders ──────────────────────────────────────────────────────────

function ensureOverlayScript(callback) {
  // Guard against duplicate injection
  if (document.getElementById("tos-overlay-script")) {
    callback();
    return;
  }
  if (!document.getElementById("tos-clarity-css")) {
    const link = document.createElement("link");
    link.id  = "tos-clarity-css";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("overlay.css");
    (document.head || document.documentElement).appendChild(link);
  }
  const script = document.createElement("script");
  script.id  = "tos-overlay-script";
  script.src = chrome.runtime.getURL("overlay.js");
  script.onload = () => callback();
  (document.head || document.documentElement).appendChild(script);
}

// ─── Injected-popup CustomEvent bridge ───────────────────────────────────────

document.addEventListener("tos-open-privacy", () => {
  chrome.runtime.sendMessage({ action: "OPEN_PRIVACY" });
});

document.addEventListener("tos-popup-check-page", () => {
  document.dispatchEvent(new CustomEvent("tos-popup-page-result", {
    detail: { isToS: isToSPage() },
  }));
});

document.addEventListener("tos-popup-analyze-request", () => {
  const text = extractVisibleText();
  const url  = window.location.href;

  fetch(`${_backendUrl}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, text }),
  })
    .then(res => {
      if (!res.ok) throw new Error(`Backend error ${res.status}`);
      return res.json();
    })
    .then(data => {
      ensureOverlayScript(() => {
        if (document.body) {
          document.dispatchEvent(new CustomEvent("tos-clarity-show", { detail: data }));
        }
      });
      document.dispatchEvent(new CustomEvent("tos-popup-status", {
        detail: { type: "success", message: "Review ready. See the panel." },
      }));
    })
    .catch(err => {
      const msg = err.message || "Unknown error";
      const friendly = (msg.includes("fetch") || msg.includes("Failed"))
        ? "Backend not reachable. Is the server running?"
        : `Error: ${msg}`;
      document.dispatchEvent(new CustomEvent("tos-popup-status", {
        detail: { type: "error", message: friendly },
      }));
    });
});

// ─── Message Handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "CHECK_PAGE") {
    sendResponse({ isToS: isToSPage() });
    return false;
  }

  if (message.action === "EXTRACT_AND_ANALYZE") {
    const text = extractVisibleText();
    const url  = window.location.href;

    fetch(`${_backendUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, text }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`Backend error ${res.status}`);
        return res.json();
      })
      .then(data => {
        ensureOverlayScript(() => {
          if (document.body) {
            document.dispatchEvent(new CustomEvent("tos-clarity-show", { detail: data }));
          }
        });
        sendResponse({ success: true });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (message.action === "CLOSE_OVERLAY") {
    document.dispatchEvent(new CustomEvent("tos-clarity-hide"));
    sendResponse({ success: true });
    return false;
  }
});
