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

    // Intercept all media elements, even if not attached to the DOM
    window.__shieldblock_media_elements = window.__shieldblock_media_elements || new Set();

    const OriginalAudio = window.Audio;
    window.Audio = function(...args) {
      const audio = new OriginalAudio(...args);
      window.__shieldblock_media_elements.add(audio);
      return audio;
    };

    const originalCreateElement = document.createElement;
    document.createElement = function(tagName, options) {
      const el = originalCreateElement.call(document, tagName, options);
      if (tagName && (tagName.toLowerCase() === 'audio' || tagName.toLowerCase() === 'video')) {
        window.__shieldblock_media_elements.add(el);
      }
      return el;
    };
    setInterval(() => {
      const titleText = document.title || '';
      const playerBar = document.querySelector('[data-testid="now-playing-widget"]') || document.querySelector('footer');
      const playerText = playerBar ? playerBar.innerText || '' : '';

      const isAd = Boolean(
        /advertisement/i.test(titleText) ||
        (playerText && /advertisement|your music will continue|left in the break/i.test(playerText)) ||
        document.querySelector('[data-testid="ad-title"]') ||
        document.querySelector('[data-testid="ad-badge"]') ||
        document.querySelector('a[data-testid="track-info-advertiser"]') ||
        document.querySelector('a[href*="spotify.com/ads"]') // Fixed false positive from "spotify.com/add"
      );

      // Hide sidebar ad card if ad is playing
      if (sidebar && /advertisement|your music will continue/i.test(sidebarText)) {
        sidebar.style.setProperty('display', 'none', 'important');
      } else if (sidebar && sidebar.style.display === 'none') {
        sidebar.style.removeProperty('display');
      }

      // Control audio & video elements in Main World (DOM + Off-DOM)
      const domAudios = Array.from(document.querySelectorAll('audio, video'));
      const allAudios = new Set([...domAudios, ...window.__shieldblock_media_elements]);
      
      allAudios.forEach((media) => {
        // Enforce 16x speed instantly on media events to bypass setInterval throttling
        if (!media.dataset.shieldblockHooked) {
          media.dataset.shieldblockHooked = 'true';
          const enforceSkip = () => {
             if (media.dataset.shieldblockAd === 'true') {
                 try { if (media.playbackRate !== 16.0) media.playbackRate = 16.0; } catch(e){}
                 if (!media.muted) media.muted = true;
             }
          };
          media.addEventListener('timeupdate', enforceSkip);
          media.addEventListener('play', enforceSkip);
        }

        if (isAd) {
          media.dataset.shieldblockAd = 'true';
          media.muted = true;
          media.volume = 0;
          try { media.playbackRate = 16.0; } catch (e) {}
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
