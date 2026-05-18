chrome.runtime.onInstalled.addListener(() => {
  console.log("ToS Clarity installed.");
});

// Per-tab injection lock to prevent duplicate scripts on rapid double-clicks
const _injecting = new Set();

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  if (_injecting.has(tab.id)) return;
  _injecting.add(tab.id);

  try {
    const [{ result: loaded }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window._tcpLoaded,
      world: "MAIN",
    });

    if (!loaded) {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["injected_popup.css"],
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["injected_popup.js"],
        world: "MAIN",
      });
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.dispatchEvent(new CustomEvent("tos-popup-toggle")),
      world: "MAIN",
    });
  } catch (e) {
    console.warn("ToS Clarity: cannot inject into this page.", e.message);
  } finally {
    _injecting.delete(tab.id);
  }
});
