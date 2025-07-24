// Ensure this script doesn't run multiple times
if (typeof window.contentScriptLoaded === 'undefined') {
  window.contentScriptLoaded = true;

  let currentTarget = null;

  const mouseOverHandler = (event) => {
    // Remove previous highlight
    if (currentTarget) {
      currentTarget.style.outline = '';
    }
    currentTarget = event.target;
    currentTarget.style.outline = '2px solid #007bff'; // Highlight with a blue border
  };

  const clickHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Clean up
    if (currentTarget) {
      currentTarget.style.outline = '';
    }
    document.removeEventListener('mouseover', mouseOverHandler, true);
    document.removeEventListener('click', clickHandler, true);

    const selector = generateCssSelector(event.target);
    chrome.runtime.sendMessage({ action: 'element-selected', selector: selector });
  };

  const recordNextClickHandler = (event) => {
    // We DO NOT call preventDefault or stopPropagation.
    // We want the user's click to function as normal.

    // Clean up all listeners immediately to only capture one click.
    cleanupListeners();

    const selector = generateCssSelector(event.target);
    chrome.runtime.sendMessage({ action: 'next-element-selected', selector: selector });
  };

  const recordPrevClickHandler = (event) => {
    // We DO NOT call preventDefault or stopPropagation.
    // We want the user's click to function as normal.

    // Clean up all listeners immediately to only capture one click.
    cleanupListeners();

    const selector = generateCssSelector(event.target);
    chrome.runtime.sendMessage({ action: 'prev-element-selected', selector: selector });
  };

  function cleanupListeners() {
    if (currentTarget) {
      currentTarget.style.outline = '';
      currentTarget = null;
    }
    document.removeEventListener('mouseover', mouseOverHandler, true);
    document.removeEventListener('click', clickHandler, true);
    document.removeEventListener('click', recordNextClickHandler, true);
    document.removeEventListener('click', recordPrevClickHandler, true);
  }

  function startSelection() {
    cleanupListeners(); // Ensure no other listeners are active
    document.addEventListener('mouseover', mouseOverHandler, true);
    document.addEventListener('click', clickHandler, true);
  }
  
  function startRecordingNext() {
    cleanupListeners(); // Ensure no other listeners are active
    document.addEventListener('click', recordNextClickHandler, true);
  }

  function startRecordingPrev() {
    cleanupListeners(); // Ensure no other listeners are active
    document.addEventListener('click', recordPrevClickHandler, true);
  }

  // Function to simulate a more realistic user click
  function simulateRealClick(element) {
    // Get the position of the element to calculate the center coordinates.
    const rect = element.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    // Find the actual element at the center point. This handles cases where
    // an overlay might be present or the event listener is on a parent.
    const targetElement = document.elementFromPoint(clientX, clientY) || element;

    // Dispatch mouseover first to trigger any hover effects that make the element visible
    const eventSequence = ['mouseover', 'mousedown', 'mouseup', 'click'];
    eventSequence.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: clientX, // The crucial X coordinate
            clientY: clientY, // The crucial Y coordinate
            buttons: 1 // Simulate the left mouse button
        });
        targetElement.dispatchEvent(event);
    });
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start-selection') {
      startSelection();
      sendResponse({ status: 'selection started' });
    } else if (message.action === 'start-recording-next') {
      startRecordingNext();
      sendResponse({ status: 'selection started' });
    } else if (message.action === 'start-recording-prev') {
      startRecordingPrev();
      sendResponse({ status: 'selection started' });
    } else if (message.action === 'click-element') {
      const element = document.querySelector(message.selector);
      if (element) {
        simulateRealClick(element);
        sendResponse({ status: 'clicked' });
      } else {
        sendResponse({ status: 'error', message: 'Element not found' });
      }
    } else if (message.action === 'hide-element') {
      const element = document.querySelector(message.selector);
      if (element) {
        element.style.visibility = 'hidden';
        sendResponse({ status: 'hidden' });
      }
    } else if (message.action === 'show-element') {
      const element = document.querySelector(message.selector);
      if (element) {
        element.style.visibility = ''; // Revert to default visibility from CSS
        sendResponse({ status: 'shown' });
      }
    }
    return true; // Indicates that the response is sent asynchronously
  });

  // Function to generate a unique CSS selector for an element
  function generateCssSelector(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while (sib = sib.previousElementSibling) {
          if (sib.nodeName.toLowerCase() == selector) nth++;
        }
        if (nth != 1) selector += ":nth-of-type("+nth+")";
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(" > ");
  }
}