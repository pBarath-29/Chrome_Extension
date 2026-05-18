/* Overlay panel — injected into host page DOM */

function _tosEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

function _buildBar(name, score) {
  const cls = _riskClass(score);
  const pct = Math.round((score / 10) * 100);
  return `
    <div class="tos-risk-row">
      <div class="tos-risk-meta">
        <span class="tos-risk-name">${_tosEscape(name)}</span>
        <span class="tos-risk-badge ${cls}">${_riskLabel(score)}</span>
      </div>
      <div class="tos-bar-track">
        <div class="tos-bar-fill ${cls}" style="width:0%" data-target="${pct}%"></div>
      </div>
    </div>`;
}

function _buildList(items, danger) {
  if (!items || items.length === 0) {
    return '<p class="tos-empty">None identified.</p>';
  }
  const cls = danger ? "tos-list tos-danger" : "tos-list";
  const lis = items.map(item => `<li>${_tosEscape(item)}</li>`).join("");
  return `<ul class="${cls}">${lis}</ul>`;
}

function tosRemoveOverlay() {
  const el = document.getElementById("tos-clarity-overlay");
  if (el) el.remove();
}

function tosShowOverlay(data) {
  tosRemoveOverlay();

  const { data_collection, data_sharing, user_rights,
          hidden_clauses, risk_scores, plain_english_explanation } = data;

  const scores = risk_scores || { privacy: 0, legal: 0, lock_in: 0 };
  const hostname = (() => { try { return new URL(window.location.href).hostname; } catch (_) { return window.location.href; } })();

  const panel = document.createElement("div");
  panel.id = "tos-clarity-overlay";

  panel.innerHTML = `
    <div class="tos-header">
      <div>
        <div class="tos-title">Agreement Review</div>
        <div class="tos-subtitle">${_tosEscape(hostname)}</div>
      </div>
      <button class="tos-close" id="tos-close-btn" title="Close">&#x2715;</button>
    </div>

    <div class="tos-section">
      <div class="tos-section-title">In Brief</div>
      <div class="tos-plain-box">${_tosEscape(plain_english_explanation)}</div>
    </div>

    <hr class="tos-divider" />

    <div class="tos-section">
      <div class="tos-section-title">Key Risks</div>
      ${_buildBar("Privacy Risk", scores.privacy)}
      ${_buildBar("Legal Risk", scores.legal)}
      ${_buildBar("Lock-in Risk", scores.lock_in)}
    </div>

    <div class="tos-section">
      <div class="tos-section-title">Watch Out For</div>
      ${_buildList(hidden_clauses, true)}
    </div>

    <div class="tos-section">
      <div class="tos-section-title">Information Collected</div>
      ${_buildList(data_collection, false)}
    </div>

    <div class="tos-section">
      <div class="tos-section-title">Third-Party Sharing</div>
      ${_buildList(data_sharing, false)}
    </div>

    <div class="tos-section">
      <div class="tos-section-title">Your Rights</div>
      ${_buildList(user_rights, false)}
    </div>
  `;

  document.body.appendChild(panel);
  document.getElementById("tos-close-btn").addEventListener("click", tosRemoveOverlay);

  // Animate in (defer one frame so the transition fires)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      panel.classList.add("tos-open");
      // Animate bars after panel slides in
      setTimeout(() => {
        panel.querySelectorAll(".tos-bar-fill[data-target]").forEach(bar => {
          bar.style.width = bar.dataset.target;
        });
      }, 150);
    });
  });
}

// overlay.js runs in the main world; communicate via CustomEvent on the shared document
document.addEventListener("tos-clarity-show", (e) => tosShowOverlay(e.detail));
document.addEventListener("tos-clarity-hide", () => tosRemoveOverlay());

// Escape key closes the overlay
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("tos-clarity-overlay")) {
    tosRemoveOverlay();
  }
});

// Click outside the panel closes it
document.addEventListener("mousedown", (e) => {
  const panel = document.getElementById("tos-clarity-overlay");
  if (panel && !panel.contains(e.target)) {
    tosRemoveOverlay();
  }
});
