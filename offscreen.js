let directoryHandle = null;

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message, sender, sendResponse) {
  // We are only listening for messages targeted to the offscreen document.
  if (message.target !== 'offscreen') {
    return;
  }

  switch (message.type) {
    case 'select-directory':
      try {
        directoryHandle = await window.showDirectoryPicker();
        const name = directoryHandle.name;
        // Store the name for display in the popup
        await chrome.storage.local.set({ savedDirectoryName: name });
        // Send a message to the popup to update its UI
        chrome.runtime.sendMessage({ action: 'location-selected', name: name });
        sendResponse(true);
      } catch (error) {
        console.error("Error selecting directory:", error);
        sendResponse(false);
      }
      break;
    case 'save-file':
      if (!directoryHandle) {
        console.error("No directory selected for saving file.");
        sendResponse({ success: false, error: "No directory selected." });
        return;
      }
      const blob = await (await fetch(message.dataUrl)).blob();
      const fileHandle = await directoryHandle.getFileHandle(message.filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      sendResponse({ success: true });
      break;
  }
  // Return true to indicate that we will send a response asynchronously.
  return true;
}