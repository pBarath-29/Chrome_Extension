const urlInput   = document.getElementById("backend-url");
const saveBtn    = document.getElementById("save-btn");
const testBtn    = document.getElementById("test-btn");
const testResult = document.getElementById("test-result");

// Load saved URL on open
chrome.storage.sync.get({ backendUrl: "http://127.0.0.1:8000" }, (result) => {
  urlInput.value = result.backendUrl;
});

saveBtn.addEventListener("click", () => {
  const url = urlInput.value.trim() || "http://127.0.0.1:8000";
  chrome.storage.sync.set({ backendUrl: url }, () => {
    saveBtn.textContent = "Saved!";
    setTimeout(() => { saveBtn.textContent = "Save"; }, 1500);
  });
});

testBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim() || "http://127.0.0.1:8000";
  testResult.textContent = "Connecting…";
  testResult.className = "";

  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    testResult.textContent = `Connected. Model: ${data.model || "unknown"}`;
    testResult.className = "success";
  } catch (err) {
    testResult.textContent = `Failed: ${err.message}. Is the backend running?`;
    testResult.className = "error";
  }
});
