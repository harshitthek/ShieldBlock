# Contributing to ShieldBlock

Thank you for your interest in improving **ShieldBlock**! 

## Code Style & Security Guidelines

1. **Strict Zero-innerHTML Policy**: Never use `innerHTML`, `outerHTML`, or `document.write()`. Always construct DOM elements safely using `document.createElement()` and assign text with `.textContent`.
2. **Manifest V3 Standards**: Ensure background logic strictly adheres to service worker lifecycles. Do not store state in global service worker variables expected to survive worker termination. Use `chrome.storage.local` or `chrome.storage.session`.
3. **Performance First**: Any DOM manipulation or mutation observation must be debounced (minimum 150ms) to prevent main-thread lag on Single Page Applications (SPAs).
4. **Rule ID Namespace Scoping**:
   - Internal Rules (Allowlist & Global Disable): IDs `1` to `999,999`.
   - Subscription Rules: IDs `>= 1,000,000`.

## How to Submit Changes

1. Fork the Repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Verify syntax locally: `node -c background.js content.js popup.js options.js logger.js`.
4. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`).
5. Push to the Branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.
