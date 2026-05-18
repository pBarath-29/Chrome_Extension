/* Overlay panel — injected into host page DOM */
/* All DOM built via createElement — no innerHTML for Trusted Types compatibility */

function _riskClass(score) {
  if (score <= 3) return "green";
  if (score <= 6) return "yellow";
  return "red";
}

function _riskLabel(score) {
  if (score <= 3) return "Low";
  if (score <= 6) return "Moderate";
  return "High";
}

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

function _makeCloseIcon() {
  const s = _svgNS("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2.5", "stroke-linecap": "round" });
  s.appendChild(_svgNS("line", { x1: "18", y1: "6", x2: "6", y2: "18" }));
  s.appendChild(_svgNS("line", { x1: "6", y1: "6", x2: "18", y2: "18" }));
  return s;
}

function _buildBar(name, score) {
  const cls = _riskClass(score);
  const pct = Math.round((score / 10) * 100);

  const fill = _el("div", `tos-bar-fill ${cls}`);
  fill.style.width = "0%";
  fill.dataset.target = `${pct}%`;

  return _el("div", "tos-risk-row", [
    _el("div", "tos-risk-meta", [
      _txt("span", "tos-risk-name", name),
      _txt("span", `tos-risk-badge ${cls}`, _riskLabel(score)),
    ]),
    _el("div", "tos-bar-track", [fill]),
  ]);
}

function _buildList(items, danger) {
  if (!items || items.length === 0) {
    return _txt("p", "tos-empty", "None identified.");
  }
  const ul = _el("ul", danger ? "tos-list tos-danger" : "tos-list");
  items.forEach(item => ul.appendChild(_txt("li", null, item)));
  return ul;
}

function _buildSection(title, child) {
  return _el("div", "tos-section", [
    _txt("div", "tos-section-title", title),
    child,
  ]);
}

function _hr() {
  const el = document.createElement("hr");
  el.className = "tos-divider";
  return el;
}

function tosRemoveOverlay() {
  const el = document.getElementById("tos-clarity-overlay");
  if (el) el.remove();
}

function tosShowOverlay(data) {
  tosRemoveOverlay();
  if (!document.body) return;

  const { data_collection, data_sharing, user_rights,
          hidden_clauses, risk_scores, plain_english_explanation,
          summary, error } = data;

  const scores = risk_scores || { privacy: 0, legal: 0, lock_in: 0 };
  const hostname = (() => {
    try { return new URL(window.location.href).hostname; }
    catch (_) { return window.location.href; }
  })();

  const briefText = plain_english_explanation || summary || "";

  // Header
  const closeBtn = _el("button", "tos-close", [_makeCloseIcon()]);
  closeBtn.id = "tos-close-btn";
  closeBtn.title = "Close";
  const headerLeft = _el("div", null, [
    _txt("div", "tos-title", "Agreement Review"),
    _txt("div", "tos-subtitle", hostname),
  ]);
  const header = _el("div", "tos-header", [headerLeft, closeBtn]);

  // Error banner (if API failed)
  const errorBanner = error
    ? _txt("div", "tos-error-banner", `Analysis error: ${error}`)
    : null;

  // In Brief
  const briefChild = briefText
    ? _txt("div", "tos-plain-box", briefText)
    : _txt("p", "tos-empty", "No legal content detected. Try a Terms of Service or Privacy Policy page.");
  const briefSection = _buildSection("In Brief", briefChild);

  // Risk bars
  const riskSection = _el("div", "tos-section", [
    _txt("div", "tos-section-title", "Key Risks"),
    _buildBar("Privacy Risk", scores.privacy),
    _buildBar("Legal Risk", scores.legal),
    _buildBar("Lock-in Risk", scores.lock_in),
  ]);

  // Lists
  const watchSection  = _buildSection("Watch Out For",        _buildList(hidden_clauses, true));
  const infoSection   = _buildSection("Information Collected", _buildList(data_collection, false));
  const shareSection  = _buildSection("Third-Party Sharing",  _buildList(data_sharing, false));
  const rightsSection = _buildSection("Your Rights",          _buildList(user_rights, false));

  // Assemble
  const panel = document.createElement("div");
  panel.id = "tos-clarity-overlay";

  [header, errorBanner, briefSection, _hr(),
   riskSection, watchSection, infoSection, shareSection, rightsSection]
    .forEach(c => c && panel.appendChild(c));

  document.body.appendChild(panel);
  closeBtn.addEventListener("click", tosRemoveOverlay);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add("tos-open");
      setTimeout(() => {
        panel.querySelectorAll(".tos-bar-fill[data-target]").forEach(bar => {
          bar.style.width = bar.dataset.target;
        });
      }, 150);
    });
  });
}

document.addEventListener("tos-clarity-show", (e) => tosShowOverlay(e.detail));
document.addEventListener("tos-clarity-hide", () => tosRemoveOverlay());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("tos-clarity-overlay")) {
    tosRemoveOverlay();
  }
});

document.addEventListener("mousedown", (e) => {
  const panel = document.getElementById("tos-clarity-overlay");
  if (panel && !panel.contains(e.target)) tosRemoveOverlay();
});
