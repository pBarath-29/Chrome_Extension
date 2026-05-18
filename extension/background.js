chrome.runtime.onInstalled.addListener(() => {
  console.log("ToS Clarity installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    // Check if popup script is already loaded in MAIN world
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

    // Toggle the popup
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.dispatchEvent(new CustomEvent("tos-popup-toggle")),
      world: "MAIN",
    });
  } catch (e) {
    console.warn("ToS Clarity: cannot inject into this page.", e.message);
  }
});
