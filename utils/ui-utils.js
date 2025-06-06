// UI utilities for the PomoBlock extension

/**
 * Show status message
 */
export function showStatusMessage(messageElement, message, type = 'success', duration = 5000) {
  messageElement.textContent = message;
  messageElement.className = `status-message ${type} show`;
  
  // Hide message after specified duration
  setTimeout(() => {
    messageElement.classList.remove('show');
  }, duration);
}

/**
 * Animate button with success state
 */
export function animateButtonSuccess(button, successText, originalText, duration = 2000) {
  const originalBg = button.style.background;
  button.style.background = '#66BB6A';
  button.textContent = successText;
  
  setTimeout(() => {
    button.style.background = originalBg;
    button.textContent = originalText;
  }, duration);
}

/**
 * Set button loading state
 */
export function setButtonLoading(button, loadingText) {
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = loadingText;
  button.classList.add('loading');
}

/**
 * Reset button from loading state
 */
export function resetButtonLoading(button, newText = null) {
  button.disabled = false;
  button.textContent = newText || button.dataset.originalText || button.textContent;
  button.classList.remove('loading');
  delete button.dataset.originalText;
}

/**
 * Add input validation styling
 */
export function setInputValidation(input, isValid) {
  if (isValid) {
    input.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  } else {
    input.style.borderColor = '#f44336';
  }
}

/**
 * Create and append element with classes and content
 */
export function createElement(tag, classes = [], content = '', attributes = {}) {
  const element = document.createElement(tag);
  
  if (classes.length > 0) {
    element.className = classes.join(' ');
  }
  
  if (content) {
    if (content.includes('<')) {
      element.innerHTML = content;
    } else {
      element.textContent = content;
    }
  }
  
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  
  return element;
}

/**
 * Toggle element visibility with animation
 */
export function toggleVisibility(element, visible, animationClass = 'enabled') {
  if (visible) {
    element.classList.add(animationClass);
  } else {
    element.classList.remove(animationClass);
  }
}

/**
 * Update toggle label text based on state
 */
export function updateToggleLabel(toggle, label, enabledText, disabledText) {
  if (toggle.checked) {
    label.textContent = enabledText;
    label.style.opacity = '1';
  } else {
    label.textContent = disabledText;
    label.style.opacity = '0.7';
  }
}

/**
 * Confirm action with user
 */
export function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

/**
 * Debounce function calls
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

/**
 * Add event listener with automatic cleanup
 */
export function addEventListenerWithCleanup(element, event, handler, options = {}) {
  element.addEventListener(event, handler, options);
  
  // Return cleanup function
  return () => {
    element.removeEventListener(event, handler, options);
  };
}

/**
 * Focus element with optional delay
 */
export function focusElement(element, delay = 0) {
  if (delay > 0) {
    setTimeout(() => element.focus(), delay);
  } else {
    element.focus();
  }
}

/**
 * Update counter display
 */
export function updateCounter(element, count, singular, plural) {
  element.textContent = `${count} ${count !== 1 ? plural : singular}`;
}

/**
 * Add CSS animation class temporarily
 */
export function addTemporaryClass(element, className, duration = 1000) {
  element.classList.add(className);
  setTimeout(() => {
    element.classList.remove(className);
  }, duration);
}