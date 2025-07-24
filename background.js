let creating; // A promise that resolves when the offscreen document is created

// Helper function to create and manage the offscreen document
async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  // Check if an offscreen document is already open.
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // If not, create one.
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['BLOBS'],
      justification: 'To save screenshot files to a user-selected directory.'
    });
    await creating;
    creating = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start-process') {
    startProcess(message.tabId, message.nextSelection, message.prevSelection, message.clicks);
    sendResponse({ status: 'Process started in background.' });
  } else if (message.action === 'choose-location') {
    (async () => {
      await setupOffscreenDocument('offscreen.html');
      // After setup, send a message to the offscreen document to trigger the directory picker.
      await chrome.runtime.sendMessage({ type: 'select-directory', target: 'offscreen' });
      sendResponse(true);
    })();
    return true; // Required for async sendResponse
  }
  return true;
});

async function startProcess(tabId, nextSelection, prevSelection, clicks) {
  const { savedDirectoryName } = await chrome.storage.local.get('savedDirectoryName');

  for (let i = 1; i <= clicks; i++) {
    let elementsToToggle = [];
    try {
      // 1. Click the element
      await chrome.tabs.sendMessage(tabId, { // Send message to the specific frame
        action: 'click-element',
        selector: nextSelection.selector,
      }, { frameId: nextSelection.frameId });

      // 2. Wait a moment for the page to potentially update
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay

      // 3. Hide all recorded elements before taking the screenshot
      if (nextSelection) {
        await chrome.tabs.sendMessage(tabId, {
          action: 'hide-element',
          selector: nextSelection.selector,
        }, { frameId: nextSelection.frameId });
        elementsToToggle.push(nextSelection);
      }
      if (prevSelection) {
        // Check if the previous button is in a different frame
        const isSameFrame = prevSelection.frameId === nextSelection.frameId;
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'hide-element',
            selector: prevSelection.selector,
          }, { frameId: prevSelection.frameId });
          elementsToToggle.push(prevSelection);
        } catch (e) {
          // It's possible the prev button isn't on the page, which is fine.
          console.log("Could not hide previous button, it may not be visible.", e);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause for render

      // 4. Take a screenshot
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png'
      });

      // 5. Save the screenshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}-click-${i}.png`;

      if (savedDirectoryName) {
        // Use the File System Access API via the offscreen document
        await setupOffscreenDocument('offscreen.html');
        await chrome.runtime.sendMessage({
          type: 'save-file',
          target: 'offscreen',
          dataUrl: dataUrl,
          filename: filename
        });
      } else {
        // Fallback to the default downloads API
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        });
      }
    } catch (error) {
      console.error(`Error during click ${i}:`, error);
      showNotification('Error', `An error occurred during click ${i}. Check the console.`);
      break; // Stop the process on error
    } finally {
      // 6. ALWAYS show the element again for the next loop or after an error
      for (const selection of elementsToToggle) {
        if (selection) {
          await chrome.tabs.sendMessage(tabId, {
            action: 'show-element',
            selector: selection.selector,
          }, { frameId: selection.frameId }).catch(e => console.error("Failed to re-show element.", e));
        }
      }
    }
  }

  showNotification('Process Complete', `Finished ${clicks} clicks and screenshots.`);
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// When the extension is installed, open a page with instructions.
chrome.runtime.onInstalled.addListener((details) => {
  // Proactively create the offscreen document
  setupOffscreenDocument('offscreen.html');
  if (details.reason === 'install') {
    // You can create an onboarding.html page if you want.
    // For now, we'll just log to the console.
    console.log('Click & Download extension installed!');
  }
});