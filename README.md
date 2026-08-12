<div align="center">
  <br />
  <h1>🛡️ ShieldBlock</h1>
  <p><b>Next-Generation High-Performance Ad & Tracker Blocker for Google Chrome</b></p>

  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
  [![Privacy First](https://img.shields.io/badge/Privacy-100%25-emerald.svg?style=for-the-badge)](https://github.com/harshitthek)
  [![License](https://img.shields.io/badge/License-MIT-purple.svg?style=for-the-badge)](LICENSE)

  <br />
  <p><i>Zero CPU Overhead • Cosmetic Element Cleaning • Real-time Network Logger • Temporary Element Zapper</i></p>
  <br />
</div>

---

## 🌟 Overview

**ShieldBlock** is a lightweight, ultra-fast Chrome extension engineered from the ground up for **Manifest V3**. By leveraging Chrome's native `declarativeNetRequest` (DNR) API, ShieldBlock intercepts and blocks network requests (ads, tracking scripts, telemetry, and annoyance popups) at the browser core level without consuming main-thread CPU cycles or memory.

Beyond network blocking, ShieldBlock features an advanced **Cosmetic Filtering Engine** powered by debounced DOM observers, an interactive **Element Picker & Zapper**, a **Live Network Debug Logger**, and **Remote Filter Subscriptions**.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🚀 Native DNR Network Engine** | Blocks ad networks (DoubleClick, Taboola, Outbrain) natively at browser network layer before download. |
| **⚡ Element Zapper (Temp)** | Click any annoying element on a page to instantly erase it without saving permanent rules. |
| **🛡️ Element Picker (Permanent)** | Select DOM elements with automatic strict selector generation (`body > main > div:nth-of-type(2)`). |
| **📊 Real-time Network Logger** | Live streaming view of blocked requests, resource types, and rule IDs in a separate dashboard. |
| **🌐 Remote Filter Subscriptions** | Subscribe to remote JSON filter lists with automatic rule namespace isolation (`ID >= 1,000,000`). |
| **🔓 Anti-AdBlock Overlay Cleaner** | Detects and removes anti-adblock modal traps and restores page scrolling automatically. |
| **🎵 Spotify Ad Acceleration** | Detects Spotify Web Player audio ads, mutes playback, accelerates to 16.0x speed, and auto-skips in 1-2s. |
| **🎨 Glassmorphic Dashboard** | Sleek UI with global toggle, stats counters, domain allowlist editor, and JSON configuration backup. |
| **🔐 Zero-innerHTML Security** | Built 100% with strict DOM node creation (`createElement` / `textContent`) to eliminate XSS vectors. |

---

## 🛠️ Architecture Overview

```
                          ┌────────────────────────┐
                          │  Manifest V3 Engine    │
                          └───────────┬────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ declarativeNet     │      │ Background Service │      │  Content Script    │
│ Request (DNR)      │      │ Worker (JS)        │      │  (Cosmetic Filter) │
└──────────┬─────────┘      └─────────┬──────────┘      └─────────┬──────────┘
           │                          │                          │
  ┌────────┴────────┐        ┌────────┴────────┐        ┌────────┴────────┐
  │ Static Rulesets │        │ Storage & State │        │ MutationObserver│
  │ (Ads/Trackers)  │        │ (Local/Session) │        │ (150ms Debounce)│
  └─────────────────┘        └─────────────────┘        └─────────────────┘
```

---

## 📥 Installation Guide (Developer Mode)

Because ShieldBlock is configured for high-performance developer mode with the `declarativeNetRequestFeedback` permission, install it as an **unpacked extension**:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harshitthek/ShieldBlock.git
   cd ShieldBlock
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left menu.
5. Select the `ShieldBlock` directory.
6. **ShieldBlock** is now active! Pin it to your browser toolbar for quick access.

---

## 📁 Repository Structure

```
├── manifest.json            # MV3 configuration declaration
├── background.js             # Service worker & state controller
├── content.js                # Cosmetic filtering, anti-adblock & element picker
├── content.css               # Element picker overlay modal styles
├── popup.html / css / js     # Extension toolbar popup interface
├── options.html / css / js   # Fullscreen dashboard & settings manager
├── logger.html / css / js    # Real-time network logger window
├── rules/
│   ├── rules_ads.json        # Static network ad blocking rules
│   ├── rules_trackers.json   # Static network tracker blocking rules
│   └── rules_annoyances.json # Static annoyance & popup blocking rules
├── icons/                    # Extension brand icons
├── LICENSE                   # MIT License
└── README.md                 # Project documentation
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
