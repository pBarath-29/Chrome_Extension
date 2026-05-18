const btn      = document.getElementById("analyze-btn");
const btnLabel = btn.querySelector(".btn-label");
const btnDesc  = btn.querySelector(".btn-desc");
const status   = document.getElementById("status");
const badge    = document.getElementById("page-badge");

const DOC_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

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

// On popup open — detect page type
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "CHECK_PAGE" }, response => {
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

btn.addEventListener("click", () => {
  btn.disabled = true;
  btnLabel.textContent = "Analyzing…";
  btnDesc.textContent  = "Reading document…";
  setStatus("");

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) {
      btn.disabled = false;
      btnLabel.textContent = "Review Agreement";
      btnDesc.textContent  = "Analyze this document";
      setStatus("No active tab found.", "error");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_AND_ANALYZE" }, response => {
      btn.disabled = false;
      btnLabel.textContent = "Review Agreement";
      btnDesc.textContent  = "Analyze this document";

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
          setStatus("Backend not reachable. Is the server running on port 8000?", "error");
        } else {
          setStatus(`Error: ${msg}`, "error");
        }
      }
    });
  });
});
