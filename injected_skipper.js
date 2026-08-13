/**
 * ShieldBlock - Main World Engine (Spotify & YouTube Ad Skipper)
 * Runs directly inside the webpage JS context ("world": "MAIN")
 */

(function () {
  'use strict';


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
      initYouTubeMainWorldSkipper();
    });
  } else {
    initYouTubeMainWorldSkipper();
  }
})();
