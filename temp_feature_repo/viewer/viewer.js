const browser = typeof chrome !== 'undefined' ? chrome : browser;

// This script is now only used for Firefox (MV2)
// Listen for the 'displayHtml' message from the background script.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displayHtml") {
    const { htmlString, title } = request.data;
    document.title = title;

    // Firefox (MV2) specific logic: Use new Function() with unsafe-eval allowed by manifest
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    const scripts = tempDiv.querySelectorAll('script');

    while (tempDiv.firstChild) {
      document.body.appendChild(tempDiv.firstChild);
    }

    scripts.forEach(script => {
      try {
        if (script.textContent) {
          new Function(script.textContent)();
        }
      } catch (e) {
        console.error("Error executing script content in Firefox:", e);
      }
    });
  }
});

// Let the background script know this tab is ready to receive a message.
browser.runtime.sendMessage({ action: "viewerReady" });
