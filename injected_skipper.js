/**
 * ShieldBlock - Main World Engine (Spotify & YouTube Ad Skipper)
 * Runs directly inside the webpage JS context ("world": "MAIN")
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // SPOTIFY MAIN WORLD AD SKIPPER & MUTER
  // -------------------------------------------------------------
  function initSpotifyMainWorldSkipper() {
    if (!window.location.hostname.includes('spotify.com')) return;

    console.log('[ShieldBlock Main World] Spotify Engine Active');

    setInterval(() => {
      if (document.hidden) return;

      const bodyText = document.body ? document.body.innerText || '' : '';
      const sidebar = document.querySelector('aside') || document.querySelector('[aria-label="Now playing view"]');
      const sidebarText = sidebar ? sidebar.innerText || '' : '';

      const isAd = Boolean(
        /advertisement|your music will continue/i.test(bodyText) ||
        document.querySelector('[data-testid="ad-title"]') ||
        document.querySelector('[data-testid="ad-badge"]') ||
        document.querySelector('[aria-label*="Advertisement" i]') ||
        document.querySelector('[data-testid="ad-link"]') ||
        document.querySelector('.sponsor-container') ||
        document.querySelector('a[href*="spotify.com/ad"]')
      );

      // Hide sidebar ad card if ad is playing
      if (sidebar && /advertisement|your music will continue/i.test(sidebarText)) {
        sidebar.style.setProperty('display', 'none', 'important');
      } else if (sidebar && sidebar.style.display === 'none') {
        sidebar.style.removeProperty('display');
      }

      // Control audio & video elements in Main World
      const audios = document.querySelectorAll('audio, video');
      audios.forEach((media) => {
        if (isAd) {
          media.muted = true;
          media.volume = 0;
          try { media.playbackRate = 16.0; } catch (e) {}
          try {
            if (media.duration && isFinite(media.duration) && media.duration > 0 && media.currentTime < media.duration - 0.2) {
              media.currentTime = media.duration - 0.1;
            }
          } catch (e) {}
        } else if (media.dataset.shieldblockAd === 'true' || (media.muted && media.volume === 0)) {
          media.dataset.shieldblockAd = 'false';
          media.muted = false;
          media.volume = 1.0;
          media.playbackRate = 1.0;
        }
      });
    }, 200);
  }

  // -------------------------------------------------------------
  // YOUTUBE MAIN WORLD AD SKIPPER & ACCELERATOR
  // -------------------------------------------------------------
  function initYouTubeMainWorldSkipper() {
    if (!window.location.hostname.includes('youtube.com')) return;

    console.log('[ShieldBlock Main World] YouTube Engine Active');

    setInterval(() => {
      if (document.hidden) return;

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
        video.playbackRate = 16.0;
        if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.2) {
          video.currentTime = video.duration - 0.1;
        }
      }

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
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSpotifyMainWorldSkipper();
      initYouTubeMainWorldSkipper();
    });
  } else {
    initSpotifyMainWorldSkipper();
    initYouTubeMainWorldSkipper();
  }
})();
