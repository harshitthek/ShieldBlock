/**
 * ShieldBlock - Cosmetic Filtering & Element Picker Content Script
 */

(function () {
  'use me strict';

  // Common Ad Selectors for Cosmetic Removal
  const AD_SELECTORS = [
    '.ad-container',
    '.ad-wrapper',
    '.ad-box',
    '.ad-placement',
    '.ad-banner',
    '.adsbygoogle',
    '.sponsored-post',
    '.sponsored-card',
    '[aria-label="Sponsored"]',
    '[id*="google_ads_iframe"]',
    '[id*="div-gpt-ad"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'iframe[src*="taboola.com"]',
    'iframe[src*="outbrain.com"]',
    '[data-testid="ad-link"]',
    '.main-leaderboard-ad',
    '[aria-label="Advertisement"]'
  ];

  let blockedCountOnPage = 0;

  // Initialize Cosmetic Filtering
  async function initCosmeticFilter() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
      if (!response || !response.enabled || response.isWhitelisted) {
        console.log('[ShieldBlock] Cosmetic filtering skipped (disabled or whitelisted)');
        return;
      }

      // Run initial DOM cleanup
      cleanAdElements();

      // Debounced DOM cleanup to prevent CPU spikes on SPAs
      let debouncedCleanTimer = null;
      function debouncedCleanAdElements() {
        if (debouncedCleanTimer) clearTimeout(debouncedCleanTimer);
        debouncedCleanTimer = setTimeout(() => {
          cleanAdElements();
        }, 150);
      }

      // Observe dynamic changes (Single Page Applications, continuous scroll, infinite feeds)
      const observer = new MutationObserver((mutations) => {
        let shouldClean = false;
        for (const m of mutations) {
          if (m.addedNodes.length > 0) {
            shouldClean = true;
            break;
          }
        }
        if (shouldClean) {
          debouncedCleanAdElements();
        }
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, { childList: true, subtree: true });
        });
      }

      // Page Visibility Power Saver: Disconnect observer when tab is hidden to free RAM & CPU
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          observer.disconnect();
        } else if (document.body) {
          cleanAdElements();
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    } catch (e) {
      console.warn('[ShieldBlock] Error initializing cosmetic filter:', e);
    }
  }

  const COMBINED_AD_SELECTOR = AD_SELECTORS.join(', ');

  // Hide DOM ad elements matching known selectors
  function cleanAdElements() {
    let newlyFound = 0;

    try {
      const elements = document.querySelectorAll(COMBINED_AD_SELECTOR);
      elements.forEach((el) => {
        if (!el.classList.contains('shieldblock-hidden')) {
          el.classList.add('shieldblock-hidden');
          el.style.setProperty('display', 'none', 'important');
          newlyFound++;
        }
      });
    } catch (e) {
      // invalid selector edge case
    }

    // Check for Anti-Adblock modal traps (fixed translucent backdrops with no scroll)
    cleanAntiAdblockOverlays();

    if (newlyFound > 0) {
      blockedCountOnPage += newlyFound;
      chrome.runtime.sendMessage({
        action: 'INCREMENT_BLOCKED',
        count: newlyFound
      }).catch(() => {});
    }
  }

  // Detect and remove intrusive anti-adblock full-screen paywalls/overlays
  function cleanAntiAdblockOverlays() {
    if (!document.body) return;
    const overlays = document.querySelectorAll('div[class*="adblock"], div[id*="adblock"], div[class*="paywall"]');
    overlays.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' && parseInt(style.zIndex, 10) > 999) {
        const text = el.innerText ? el.innerText.toLowerCase() : '';
        if (text.includes('adblock') || text.includes('disable your ad blocker') || text.includes('turn off adblock')) {
          el.remove();
          document.body.style.setProperty('overflow', 'auto', 'important');
          console.log('[ShieldBlock] Cleaned anti-adblock overlay');
        }
      }
    });
  }



  let isPickerActive = false;
  let pickerMode = 'permanent'; // 'permanent' or 'zap'
  let hoveredElement = null;
  let highlightBox = null;
  let badgeEl = null;

  function activateElementPicker(mode = 'permanent') {
    if (isPickerActive) deactivateElementPicker();
    isPickerActive = true;
    pickerMode = mode;

    // Create Highlight UI
    highlightBox = document.createElement('div');
    highlightBox.id = 'shieldblock-picker-highlight';

    badgeEl = document.createElement('div');
    badgeEl.id = 'shieldblock-picker-badge';
    if (mode === 'zap') {
      badgeEl.textContent = '⚡ ShieldBlock: Click element to Zap (press ESC to exit)';
      badgeEl.style.background = '#be185d';
      badgeEl.style.borderColor = '#f43f5e';
      badgeEl.style.color = '#ffffff';
      highlightBox.style.borderColor = '#ec4899';
      highlightBox.style.backgroundColor = 'rgba(236, 72, 153, 0.2)';
      highlightBox.style.boxShadow = '0 0 12px rgba(236, 72, 153, 0.5)';
    } else {
      badgeEl.textContent = '🛡️ ShieldBlock: Click element to block permanently';
    }
    highlightBox.appendChild(badgeEl);

    document.documentElement.appendChild(highlightBox);

    document.addEventListener('mouseover', handlePickerMouseOver, true);
    document.addEventListener('click', handlePickerClick, true);
    document.addEventListener('keydown', handlePickerKeyDown, true);
  }

  function deactivateElementPicker() {
    isPickerActive = false;
    if (highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
    document.removeEventListener('mouseover', handlePickerMouseOver, true);
    document.removeEventListener('click', handlePickerClick, true);
    document.removeEventListener('keydown', handlePickerKeyDown, true);
  }

  function handlePickerMouseOver(e) {
    if (!isPickerActive || e.target === highlightBox || highlightBox.contains(e.target)) return;
    
    // Ignore html / body tags
    if (e.target === document.documentElement || e.target === document.body) return;

    hoveredElement = e.target;
    const rect = hoveredElement.getBoundingClientRect();

    highlightBox.style.top = `${rect.top + window.scrollY}px`;
    highlightBox.style.left = `${rect.left + window.scrollX}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
    highlightBox.style.display = 'block';
  }

  function handlePickerClick(e) {
    if (!isPickerActive || !hoveredElement) return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = hoveredElement;

    if (pickerMode === 'zap') {
      targetEl.remove();
      highlightBox.style.display = 'none';
      hoveredElement = null;
    } else {
      deactivateElementPicker();
      const selector = generateUniqueCssSelector(targetEl);
      showBlockConfirmationModal(targetEl, selector);
    }
  }

  function handlePickerKeyDown(e) {
    if (e.key === 'Escape') {
      deactivateElementPicker();
    }
  }

  // Generate robust, fully-qualified CSS selector for targeted element
  function generateUniqueCssSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

    // If element has a valid ID, return directly
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    const path = [];
    let current = el;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName.toLowerCase();

      if (tag === 'body' || tag === 'html') {
        path.unshift(tag);
        break;
      }

      if (current.id) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }

      let selector = tag;
      const parent = current.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  // Render Confirmation Modal safely without innerHTML
  function showBlockConfirmationModal(targetEl, selector) {
    const backdrop = document.createElement('div');
    backdrop.id = 'shieldblock-modal-backdrop';

    const modal = document.createElement('div');
    modal.id = 'shieldblock-modal';

    const h3 = document.createElement('h3');
    h3.textContent = '🛡️ Block Element';

    const p = document.createElement('p');
    p.textContent = `Do you want to permanently hide this element on `;
    const strong = document.createElement('strong');
    strong.textContent = window.location.hostname;
    p.appendChild(strong);
    p.appendChild(document.createTextNode('?'));

    const code = document.createElement('code');
    code.textContent = selector;

    const actions = document.createElement('div');
    actions.className = 'shieldblock-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'shieldblock-btn shieldblock-btn-secondary';
    cancelBtn.id = 'shieldblock-cancel-btn';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'shieldblock-btn shieldblock-btn-primary';
    confirmBtn.id = 'shieldblock-confirm-btn';
    confirmBtn.textContent = 'Hide Element';

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    modal.appendChild(h3);
    modal.appendChild(p);
    modal.appendChild(code);
    modal.appendChild(actions);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    cancelBtn.onclick = () => backdrop.remove();

    confirmBtn.onclick = async () => {
      targetEl.style.setProperty('display', 'none', 'important');
      backdrop.remove();

      // Save rule to background storage (background worker injects via scripting API)
      const domain = window.location.hostname.replace(/^www\./, '');
      await chrome.runtime.sendMessage({
        action: 'SAVE_ELEMENT_PICKER_RULE',
        domain,
        selector
      });
    };
  }

  // Listen for messages from Popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ACTIVATE_ELEMENT_PICKER') {
      activateElementPicker(msg.mode || 'permanent');
      sendResponse({ success: true });
    }
  });

  // -------------------------------------------------------------
  // SPOTIFY WEB PLAYER AUDIO AD ACCELERATION & MUTER ENGINE
  // -------------------------------------------------------------
  function initSpotifyAdSkipper() {
    if (!window.location.hostname.includes('spotify.com')) return;

    console.log('[ShieldBlock] Spotify Web Player ad acceleration engine active');

    setInterval(() => {
      if (document.hidden) return; // Zero RAM & CPU usage when tab is in background

      // Search all player containers on Spotify Web Player & Mobile Web Player
      const nowPlaying = document.querySelector('[data-testid="now-playing-widget"]') ||
                         document.querySelector('.now-playing-bar') ||
                         document.querySelector('.Root__now-playing-bar') ||
                         document.querySelector('footer') ||
                         document.body;

      const playerText = nowPlaying ? nowPlaying.innerText || '' : '';
      const sidebar = document.querySelector('aside') || document.querySelector('[aria-label="Now playing view"]');
      const sidebarText = sidebar ? sidebar.innerText || '' : '';

      const isAdPlaying = /advertisement|your music will continue/i.test(playerText) ||
                          /advertisement|your music will continue/i.test(sidebarText) ||
                          document.querySelector('[data-testid="ad-title"]') ||
                          document.querySelector('[data-testid="ad-badge"]') ||
                          document.querySelector('[aria-label*="Advertisement" i]') ||
                          document.querySelector('[data-testid="ad-link"]') ||
                          document.querySelector('.sponsor-container') ||
                          document.querySelector('a[href*="spotify.com/ad"]');

      // Hide sidebar ad card visual container if ad is playing
      if (sidebar && /advertisement|your music will continue/i.test(sidebarText)) {
        sidebar.style.setProperty('display', 'none', 'important');
      } else if (sidebar && sidebar.style.display === 'none') {
        sidebar.style.removeProperty('display');
      }

      const mediaElements = document.querySelectorAll('audio, video');

      mediaElements.forEach((media) => {
        // Event listener enforcement so Spotify JS cannot un-mute or slow down playback during ads
        if (!media.dataset.shieldblockTracked) {
          media.dataset.shieldblockTracked = 'true';
          media.addEventListener('ratechange', () => {
            if (media.dataset.shieldblockAd === 'true' && media.playbackRate !== 16.0) {
              media.playbackRate = 16.0;
            }
          });
          media.addEventListener('volumechange', () => {
            if (media.dataset.shieldblockAd === 'true' && !media.muted) {
              media.muted = true;
            }
          });
        }

        if (isAdPlaying) {
          media.dataset.shieldblockAd = 'true';
          media.muted = true;
          media.playbackRate = 16.0; // Fast-forward 2-min ad in ~100ms
          try {
            media.currentTime = 999999; // Jump to end of ad stream regardless of Infinity/NaN duration
          } catch (e) {}
        } else {
          if (media.dataset.shieldblockAd === 'true') {
            media.dataset.shieldblockAd = 'false';
            media.muted = false;
            media.playbackRate = 1.0;
          }
        }
      });

      // Auto-click Skip / Next button if Spotify presents one
      if (isAdPlaying) {
        const nextBtn = document.querySelector('[data-testid="control-button-skip-forward"]') ||
                        document.querySelector('[aria-label="Next"]') ||
                        document.querySelector('[aria-label="Skip"]') ||
                        document.querySelector('button[aria-label*="Next" i]') ||
                        document.querySelector('button[aria-label*="Skip" i]');
        if (nextBtn) {
          nextBtn.click();
        }
      }
    }, 250);
  }

  // -------------------------------------------------------------
  // YOUTUBE VIDEO AD ACCELERATION & AUTO-SKIPPER ENGINE
  // -------------------------------------------------------------
  function initYouTubeAdSkipper() {
    if (!window.location.hostname.includes('youtube.com')) return;

    console.log('[ShieldBlock] YouTube video ad acceleration engine active');

    setInterval(() => {
      // Skip background tabs to save RAM & CPU
      if (document.hidden && !document.querySelector('.html5-video-player.ad-showing')) return;

      // YouTube Video Ad Indicators
      const player = document.querySelector('.html5-video-player');
      const isAdShowing = player && (
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting') ||
        document.querySelector('.ytp-ad-module') ||
        document.querySelector('.ytp-ad-player-overlay')
      );

      const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

      if (video && isAdShowing) {
        video.muted = true;
        video.playbackRate = 16.0; // Fast-forward video ad at 16x speed
        if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.2) {
          video.currentTime = video.duration - 0.1; // Jump straight to end
        }
      }

      // Auto-click YouTube Skip Ad buttons (Modern & Classic)
      const skipButtonsSelector = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button.ytp-ad-skip-button-container',
        '.ytp-ad-overlay-close-button'
      ].join(', ');

      const btn = document.querySelector(skipButtonsSelector);
      if (btn) {
        btn.click();
      }
    }, 300);
  }

  // Start extension engines
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initCosmeticFilter();
      initSpotifyAdSkipper();
      initYouTubeAdSkipper();
    });
  } else {
    initCosmeticFilter();
    initSpotifyAdSkipper();
    initYouTubeAdSkipper();
  }
})();
