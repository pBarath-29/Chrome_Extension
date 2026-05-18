const btn         = document.getElementById("analyze-btn");
const btnLabel    = btn.querySelector(".btn-label");
const btnDesc     = btn.querySelector(".btn-desc");
const btnIconArea = document.getElementById("btn-icon-area");
const btnArrow    = document.getElementById("btn-arrow");
const status      = document.getElementById("status");
const badge       = document.getElementById("page-badge");
const setupScreen = document.getElementById("setup-screen");
const mainContent = document.getElementById("main-content");
const retryBtn    = document.getElementById("retry-btn");
const privacyLink = document.getElementById("privacy-link");

const SEARCH_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const DOC_ICON   = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

function setStatus(msg, cls) {
  status.textContent = msg;
  status.className = cls || "";
}

function setBadge(isToS) {
  if (isToS) {
    badge.innerHTML = `
      <div class="status-row">
        <div class="row-icon detected">${DOC_ICON}</div>
        <div class="row-body">
          <div class="row-title">Agreement detected</div>
          <div class="row-sub">Legal document on this page</div>
        </div>
        <div class="status-dot detected"></div>
      </div>`;
  } else {
    badge.innerHTML = `
      <div class="status-row">
        <div class="row-icon unknown">${DOC_ICON}</div>
        <div class="row-body">
          <div class="row-title">No agreement found</div>
          <div class="row-sub">Not a legal document</div>
        </div>
        <div class="status-dot unknown"></div>
      </div>`;
  }
}

function showSpinner() {
  btnIconArea.innerHTML = '<div class="spinner"></div>';
  btnArrow.style.display = "none";
}

function hideSpinner() {
  btnIconArea.innerHTML = SEARCH_SVG;
  btnArrow.style.display = "";
}

function showSetup() {
  setupScreen.classList.add("visible");
  mainContent.classList.add("hidden");
}

function showMain() {
  setupScreen.classList.remove("visible");
  mainContent.classList.remove("hidden");
}

function getBackendUrl() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ backendUrl: "http://127.0.0.1:8000" }, (r) => {
      resolve(r.backendUrl);
    });
  });
}

async function checkBackendAndInit() {
  const backendUrl = await getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("unhealthy");
    showMain();
    initPageBadge();
  } catch (_) {
    showSetup();
  }
}

function initPageBadge() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      setBadge(false);
      return;
    }
    const tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, { action: "CHECK_PAGE" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setBadge(false);
        setStatus("Reload the page if the extension isn't responding.");
        return;
      }
      setBadge(response.isToS);
      if (!response.isToS) {
        btnLabel.textContent = "Review Anyway";
      }
    });
  });
}

// On popup open — health check first
checkBackendAndInit();

retryBtn.addEventListener("click", () => {
  retryBtn.textContent = "Checking…";
  retryBtn.disabled = true;
  checkBackendAndInit().finally(() => {
    retryBtn.textContent = "Retry Connection";
    retryBtn.disabled = false;
  });
});

if (privacyLink) {
  privacyLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("privacy_policy.html") });
  });
}

btn.addEventListener("click", () => {
  btn.disabled = true;
  btnLabel.textContent = "Analyzing…";
  btnDesc.textContent  = "This may take 15–30 seconds";
  showSpinner();
  setStatus("");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      btn.disabled = false;
      btnLabel.textContent = "Review Agreement";
      btnDesc.textContent  = "Analyze this document";
      hideSpinner();
      setStatus("No active tab found.", "error");
      return;
    }

    const tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_AND_ANALYZE" }, (response) => {
      btn.disabled = false;
      btnLabel.textContent = "Review Agreement";
      btnDesc.textContent  = "Analyze this document";
      hideSpinner();

      if (chrome.runtime.lastError) {
        setStatus("Could not reach the page. Try reloading it.", "error");
        return;
      }

      if (!response) {
        setStatus("No response from content script.", "error");
        return;
      }

      if (response.success) {
        setStatus("Review ready. See the panel.", "success");
      } else {
        const msg = response.error || "Unknown error";
        if (msg.includes("fetch") || msg.includes("Failed")) {
          setStatus("Backend not reachable. Is the server running?", "error");
        } else {
          setStatus(`Error: ${msg}`, "error");
        }
      }
    });
  });
});
