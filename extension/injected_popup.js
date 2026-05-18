/* Injected popup panel — runs in page main world via chrome.scripting */
window._tcpLoaded = true;

// ── DOM helpers (no innerHTML — required for Trusted Types compatibility) ──

function _el(tag, cls, children) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (children) children.forEach(c => c && el.appendChild(c));
  return el;
}

function _txt(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.textContent = text;
  return el;
}

function _svgNS(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function _makeDocIcon() {
  const s = _svgNS("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" });
  s.appendChild(_svgNS("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }));
  s.appendChild(_svgNS("polyline", { points: "14 2 14 8 20 8" }));
  s.appendChild(_svgNS("line", { x1: "16", y1: "13", x2: "8", y2: "13" }));
  s.appendChild(_svgNS("line", { x1: "16", y1: "17", x2: "8", y2: "17" }));
  return s;
}

function _makeSearchIcon() {
  const s = _svgNS("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" });
  s.appendChild(_svgNS("circle", { cx: "11", cy: "11", r: "8" }));
  s.appendChild(_svgNS("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }));
  return s;
}

function _makeChevronIcon() {
  const s = _svgNS("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" });
  s.appendChild(_svgNS("polyline", { points: "9 18 15 12 9 6" }));
  return s;
}

function _makeBadgeRow(iconCls, dotCls, titleText, subText) {
  const icon = _el("div", `tcp-row-icon ${iconCls}`, [_makeDocIcon()]);
  const body = _el("div", "tcp-row-body", [
    _txt("div", "tcp-row-title", titleText),
    _txt("div", "tcp-row-sub", subText),
  ]);
  const dot = _el("div", `tcp-status-dot ${dotCls}`);
  return _el("div", "tcp-status-row", [icon, body, dot]);
}

function _hr() {
  const el = document.createElement("hr");
  el.className = "tcp-divider";
  return el;
}

// ── Remove ────────────────────────────────────────────────────────────────

function _tcpRemove() {
  const el = document.getElementById("tos-clarity-popup");
  if (el) el.remove();
  document.removeEventListener("mousedown", _tcpOutsideClick);
  document.removeEventListener("keydown", _tcpEscKey);
}

// ── Create ────────────────────────────────────────────────────────────────

function _tcpCreate() {
  _tcpRemove();

  // Header
  const header = _el("div", "tcp-header", [
    _el("div", "tcp-logo-icon", [_txt("span", null, "TC")]),
    _el("div", null, [
      _txt("div", "tcp-app-name", "ToS Clarity"),
      _txt("div", "tcp-app-sub", "Legal document analysis"),
    ]),
  ]);

  // Badge
  const badge = _el("div", null, [
    _makeBadgeRow("tcp-unknown", "tcp-unknown", "Checking page…", "Detecting agreement"),
  ]);
  badge.id = "tcp-badge";

  // Analyze button
  const btnLabel = _txt("span", "tcp-btn-label", "Review Agreement");
  const btnDesc  = _txt("span", "tcp-btn-desc", "Analyze this document");
  const btn = _el("button", "tcp-analyze-btn", [
    _el("div", "tcp-btn-icon", [_makeSearchIcon()]),
    _el("div", "tcp-btn-body", [btnLabel, btnDesc]),
    _el("span", "tcp-btn-arrow", [_makeChevronIcon()]),
  ]);
  btn.id = "tcp-analyze-btn";

  // Status
  const statusDiv = _el("div", "tcp-status-msg");
  statusDiv.id = "tcp-status";

  // Footer
  const footerGroq = _txt("span", null, "Runs locally on your device");
  const footerDot  = _txt("span", "tcp-footer-dot", "·");
  const footerLink = _txt("a", "tcp-footer-link", "Privacy Policy");
  footerLink.href = "#";
  footerLink.addEventListener("click", (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("tos-open-privacy"));
  });
  const footer = _el("div", "tcp-footer", [footerGroq, footerDot, footerLink]);

  // Assemble panel
  const panel = document.createElement("div");
  panel.id = "tos-clarity-popup";
  [header, _hr(), badge, _hr(), btn, statusDiv, _hr(), footer]
    .forEach(c => panel.appendChild(c));

  document.body.appendChild(panel);
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("tcp-open")));

  btn.addEventListener("click", () => {
    try {
      const b = document.getElementById("tcp-analyze-btn");
      if (!b) return;
      b.disabled = true;
      const lbl = b.querySelector(".tcp-btn-label");
      const dsc = b.querySelector(".tcp-btn-desc");
      if (lbl) lbl.textContent = "Analyzing…";
      if (dsc) dsc.textContent = "This may take 15–30 seconds";
      _tcpSetStatus("", "");
      document.dispatchEvent(new CustomEvent("tos-popup-analyze-request"));
    } catch (e) {
      console.warn("ToS Clarity: analyze dispatch failed", e);
    }
  });

  document.addEventListener("mousedown", _tcpOutsideClick);
  document.addEventListener("keydown", _tcpEscKey);
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
  while (badge.firstChild) badge.removeChild(badge.firstChild);

  if (isToS) {
    badge.appendChild(_makeBadgeRow("tcp-detected", "tcp-detected", "Agreement detected", "Legal document on this page"));
  } else {
    badge.appendChild(_makeBadgeRow("tcp-unknown", "tcp-unknown", "No agreement found", "Not a legal document"));
    const btn = document.getElementById("tcp-analyze-btn");
    if (btn) {
      const lbl = btn.querySelector(".tcp-btn-label");
      if (lbl) lbl.textContent = "Review Anyway";
    }
  }
}

// ── Events ────────────────────────────────────────────────────────────────

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
    const lbl = btn.querySelector(".tcp-btn-label");
    const dsc = btn.querySelector(".tcp-btn-desc");
    if (lbl) lbl.textContent = "Review Agreement";
    if (dsc) dsc.textContent = "Analyze this document";
  }
  const cls = type === "success" ? "tcp-success" : type === "error" ? "tcp-error" : "";
  _tcpSetStatus(message, cls);
});
