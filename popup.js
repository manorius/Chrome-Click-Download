const selectElementBtn = document.getElementById('selectElementBtn');
const startBtn = document.getElementById('startBtn');
const recordClickBtn = document.getElementById('recordClickBtn');
const recordPrevBtn = document.getElementById('recordPrevBtn');
const selectedElementDiv = document.getElementById('selectedElement');
const manualSelectorInput = document.getElementById('manualSelectorInput');
const selectedPrevElementDiv = document.getElementById('selectedPrevElement');
const saveSelectorBtn = document.getElementById('saveSelectorBtn');
const chooseLocationBtn = document.getElementById('chooseLocationBtn');
const selectedLocationDiv = document.getElementById('selectedLocation');
const clickCountInput = document.getElementById('clickCount');
const statusDiv = document.getElementById('status');

let activeTabId;

// Get the active tab to inject scripts into
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    activeTabId = tabs[0].id;
    const nextKey = `next_selection_tab_${activeTabId}`;
    const prevKey = `prev_selection_tab_${activeTabId}`;
    // Load saved data on popup open
    chrome.storage.local.get([nextKey, prevKey, 'savedDirectoryName'], (result) => {
      const nextSelection = result[nextKey];
      if (nextSelection && nextSelection.selector) {
        selectedElementDiv.textContent = `Next: ${nextSelection.selector}`;
        selectedElementDiv.style.backgroundColor = '#d4edda'; // Greenish background
      }
      const prevSelection = result[prevKey];
      if (prevSelection && prevSelection.selector) {
        selectedPrevElementDiv.textContent = `Previous: ${prevSelection.selector}`;
        selectedPrevElementDiv.style.backgroundColor = '#d4edda';
      }
      if (result.savedDirectoryName) {
        selectedLocationDiv.textContent = `Folder: ${result.savedDirectoryName}`;
        selectedLocationDiv.style.backgroundColor = '#d4edda';
      }
    });
  }
});

selectElementBtn.addEventListener('click', async () => {
  if (!activeTabId) return;

  statusDiv.textContent = 'Click on an element on the page to select it.';
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId, allFrames: true },
      files: ['content.js'],
    });
    chrome.tabs.sendMessage(activeTabId, { action: 'start-selection' });
    window.close(); // Close popup to allow selection
  } catch (error) {
    console.error("Failed to inject content script:", error);
    statusDiv.textContent = 'Error: Could not inject script into the page. Try reloading the page.';
  }
});

recordClickBtn.addEventListener('click', async () => {
  if (!activeTabId) return;

  statusDiv.textContent = 'Click the desired element on the page to record it.';
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId, allFrames: true },
      files: ['content.js'],
    });
    chrome.tabs.sendMessage(activeTabId, { action: 'start-recording-next' });
    window.close(); // Close popup to allow selection
  } catch (error) {
    console.error("Failed to inject content script:", error);
    statusDiv.textContent = 'Error: Could not inject script into the page. Try reloading the page.';
  }
});

recordPrevBtn.addEventListener('click', async () => {
  if (!activeTabId) return;

  statusDiv.textContent = 'Click the "previous" element on the page to record it.';
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId, allFrames: true },
      files: ['content.js'],
    });
    chrome.tabs.sendMessage(activeTabId, { action: 'start-recording-prev' });
    window.close(); // Close popup to allow selection
  } catch (error) {
    console.error("Failed to inject content script:", error);
    statusDiv.textContent = 'Error: Could not inject script into the page. Try reloading the page.';
  }
});

saveSelectorBtn.addEventListener('click', () => {
  if (!activeTabId) return;

  const manualSelector = manualSelectorInput.value.trim();
  if (!manualSelector) {
    statusDiv.textContent = 'Please enter a selector.';
    return;
  }

  const storageKey = `next_selection_tab_${activeTabId}`;
  // Manual selection only works for the main frame (frameId: 0)
  const selection = {
    selector: manualSelector,
    frameId: 0
  };
  chrome.storage.local.set({ [storageKey]: selection }, () => {
    selectedElementDiv.textContent = `Next: ${selection.selector}`;
    selectedElementDiv.style.backgroundColor = '#d4edda';
    statusDiv.textContent = 'Selector saved!';
    manualSelectorInput.value = ''; // Clear input
  });
});

chooseLocationBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'choose-location' });
});

startBtn.addEventListener('click', () => {
  const clicks = parseInt(clickCountInput.value, 10);
  if (isNaN(clicks) || clicks < 1) {
    statusDiv.textContent = 'Please enter a valid number of clicks.';
    return;
  }
  const nextKey = `next_selection_tab_${activeTabId}`;
  const prevKey = `prev_selection_tab_${activeTabId}`;
  chrome.storage.local.get([nextKey, prevKey], (result) => {
    const nextSelection = result[nextKey];
    const prevSelection = result[prevKey]; // This can be undefined, which is fine

    if (!nextSelection || !nextSelection.selector) {
      statusDiv.textContent = 'Error: The "Next" button has not been selected.';
      return;
    }

    statusDiv.textContent = `Starting process for ${clicks} clicks...`;
    chrome.runtime.sendMessage({
      action: 'start-process',
      tabId: activeTabId,
      nextSelection: nextSelection,
      prevSelection: prevSelection,
      clicks: clicks,
    });
    window.close();
  });
});

// Listen for messages from the content script or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'location-selected') {
    selectedLocationDiv.textContent = `Folder: ${message.name}`;
    selectedLocationDiv.style.backgroundColor = '#d4edda';
  } else if (message.action === 'update-status') {
    statusDiv.textContent = message.status;
  }
});