/* Injected popup panel — runs in page main world via chrome.scripting */
window._tcpLoaded = true;

const _DOC_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
const _SEARCH_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const _CHEVRON_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function _tcpRemove() {
  const el = document.getElementById("tos-clarity-popup");
  if (el) el.remove();
  document.removeEventListener("mousedown", _tcpOutsideClick);
  document.removeEventListener("keydown", _tcpEscKey);
}

function _tcpCreate() {
  _tcpRemove();

  const panel = document.createElement("div");
  panel.id = "tos-clarity-popup";
  panel.innerHTML = `
    <div class="tcp-header">
      <div class="tcp-logo-icon"><span>TC</span></div>
      <div>
        <div class="tcp-app-name">ToS Clarity</div>
        <div class="tcp-app-sub">Legal document analysis</div>
      </div>
    </div>
    <hr class="tcp-divider" />
    <div id="tcp-badge">
      <div class="tcp-status-row">
        <div class="tcp-row-icon tcp-unknown">${_DOC_ICON}</div>
        <div class="tcp-row-body">
          <div class="tcp-row-title">Checking page…</div>
          <div class="tcp-row-sub">Detecting agreement</div>
        </div>
        <div class="tcp-status-dot tcp-unknown"></div>
      </div>
    </div>
    <hr class="tcp-divider" />
    <button class="tcp-analyze-btn" id="tcp-analyze-btn">
      <div class="tcp-btn-icon">${_SEARCH_ICON}</div>
      <div class="tcp-btn-body">
        <span class="tcp-btn-label">Review Agreement</span>
        <span class="tcp-btn-desc">Analyze this document</span>
      </div>
      <span class="tcp-btn-arrow">${_CHEVRON_ICON}</span>
    </button>
    <div id="tcp-status" class="tcp-status-msg"></div>
    <hr class="tcp-divider" />
    <div class="tcp-footer">Runs locally on your device</div>
  `;

  document.body.appendChild(panel);

  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("tcp-open")));

  document.getElementById("tcp-analyze-btn").addEventListener("click", () => {
    const btn = document.getElementById("tcp-analyze-btn");
    btn.disabled = true;
    btn.querySelector(".tcp-btn-label").textContent = "Analyzing…";
    btn.querySelector(".tcp-btn-desc").textContent  = "Reading document…";
    _tcpSetStatus("", "");
    document.dispatchEvent(new CustomEvent("tos-popup-analyze-request"));
  });

  document.addEventListener("mousedown", _tcpOutsideClick);
  document.addEventListener("keydown", _tcpEscKey);

  // Ask content script to check the page
  document.dispatchEvent(new CustomEvent("tos-popup-check-page"));
}

function _tcpOutsideClick(e) {
  const panel = document.getElementById("tos-clarity-popup");
  if (panel && !panel.contains(e.target)) _tcpRemove();
}

function _tcpEscKey(e) {
  if (e.key === "Escape" && document.getElementById("tos-clarity-popup")) _tcpRemove();
}

function _tcpSetStatus(msg, cls) {
  const el = document.getElementById("tcp-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "tcp-status-msg" + (cls ? " " + cls : "");
}

function _tcpSetBadge(isToS) {
  const badge = document.getElementById("tcp-badge");
  if (!badge) return;
  if (isToS) {
    badge.innerHTML = `
      <div class="tcp-status-row">
        <div class="tcp-row-icon tcp-detected">${_DOC_ICON}</div>
        <div class="tcp-row-body">
          <div class="tcp-row-title">Agreement detected</div>
          <div class="tcp-row-sub">Legal document on this page</div>
        </div>
        <div class="tcp-status-dot tcp-detected"></div>
      </div>`;
  } else {
    badge.innerHTML = `
      <div class="tcp-status-row">
        <div class="tcp-row-icon tcp-unknown">${_DOC_ICON}</div>
        <div class="tcp-row-body">
          <div class="tcp-row-title">No agreement found</div>
          <div class="tcp-row-sub">Not a legal document</div>
        </div>
        <div class="tcp-status-dot tcp-unknown"></div>
      </div>`;
    const btn = document.getElementById("tcp-analyze-btn");
    if (btn) btn.querySelector(".tcp-btn-label").textContent = "Review Anyway";
  }
}

// Events fired by content_script.js
document.addEventListener("tos-popup-toggle", () => {
  if (document.getElementById("tos-clarity-popup")) {
    _tcpRemove();
  } else {
    _tcpCreate();
  }
});

document.addEventListener("tos-popup-page-result", (e) => {
  _tcpSetBadge(e.detail.isToS);
});

document.addEventListener("tos-popup-status", (e) => {
  const { type, message } = e.detail;
  const btn = document.getElementById("tcp-analyze-btn");
  if (btn) {
    btn.disabled = false;
    btn.querySelector(".tcp-btn-label").textContent = "Review Agreement";
    btn.querySelector(".tcp-btn-desc").textContent  = "Analyze this document";
  }
  const cls = type === "success" ? "tcp-success" : type === "error" ? "tcp-error" : "";
  _tcpSetStatus(message, cls);
});
