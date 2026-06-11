# Frontend Architecture & Interface Documentation

This document describes the structure, styles, page layouts, and client-side JavaScript components of the **FD Platform Prototype Frontend**.

---

## 1. Directory Structure

The frontend code resides in the `/frontend` directory and is structured as follows:

```
frontend/
├── index.html            # Landing / Discover Page
├── login.html            # Login Screen (Phone Entry)
├── otp.html              # OTP Entry Screen
├── rates.html            # FD Interest Rates Card Browser
├── book.html             # FD Booking Details & Nominee Form
├── pan.html              # KYC Phase 1: PAN verification
├── aadhaar.html          # KYC Phase 2: Aadhaar eKYC
├── vkyc.html             # KYC Phase 3: Video KYC mock
├── confirmation.html     # Success booking screen
├── portfolio.html        # Portfolio Viewer (User bookings)
├── widget.js             # Chat assistant widget script
├── css/
│   └── styles.css        # Core design system stylesheet
└── js/
    ├── api.js            # Shared Fetch API helper (injects JWT headers)
    ├── index.js          # Landing page logic
    ├── auth.js           # Auth & OTP-less verification flows
    ├── rates.js          # Specific rates card compiler
    ├── book.js           # Booking controller
    ├── pan.js            # PAN KYC controller
    ├── aadhaar.js        # Aadhaar OTP verification controller
    ├── vkyc.js           # Video KYC status controller
    ├── confirmation.js   # Success screen renderer
    └── portfolio.js      # Portfolio UI controller
```

---

## 2. Core Styles & Typography (`css/styles.css`)

The system utilizes Vanilla CSS for maximum flexibility.
- **Font Face:** Uses Google Fonts' **Roboto** (weights 400, 500, 600, 700).
- **Core Theme:** Styled with custom HSL-tailored variables to represent a clean finance product layout.
- **Mobile-Responsive Layout:** All files wrap inside a `.app-wrapper` optimized for high-fidelity mobile-first previews, with header navigation, responsive grids, and standard footers.

---

## 3. UI Pages & Flow Transition

The booking journey simulates a production-grade Indian banking flow in a mock format:

```
                  (anonymous entry)
                     index.html
                         │
                         ▼
                     login.html ──► otp.html (universal OTP '123456')
                         │
                         ▼
                     rates.html (browse & select rate)
                         │
                         ▼
                     book.html (input principal & nominee details)
                         │
                         ▼
                     pan.html (verify PAN format)
                         │
                         ▼
                    aadhaar.html (verify Aadhaar via OTP mock)
                         │
                         ▼
                     vkyc.html (video KYC validation mock)
                         │
                         ▼
                 confirmation.html (success) ──► portfolio.html
```

---

## 4. Storage Life-Cycle Policy

The client handles two tokens differently:
1. **`auth_token` (JWT):** Acquired upon successful login at `otp.html`. Saved in `localStorage` to survive page reloads and browser restarts. Used for site-wide page transitions.
2. **`finbot_anon_token` (Opaque Token):** Acquired by entering phone/DOB/PAN in the bot verification flow. Stored in `sessionStorage` so that any browser tab refresh or close instantly deletes it (protecting user data in shared environments).

---

## 5. Shadow-DOM Chat Assistant (`widget.js`)

The chat assistant is injected onto every page via a deferred script tag:
`<script src="widget.js" defer></script>`

- **Shadow DOM Isolation:** Renders the launcher floating action button (FAB) and chat frame inside a Shadow Root. This prevents any hosting page CSS from bleeding into the bot widget.
- **Floating Launcher:** Floating launcher sits on the bottom-right corner. It morphs into a full-height pane on mobile screens, and a compact panel on desktops.
- **Interaction Modes:**
  - **Menu Mode:** Uses chip buttons to drive conversations, minimizing user keyboard inputs.
  - **Verification Sub-flow:** Enables temporary keyboard inputs to allow the anonymous user to enter their Phone, DOB, and PAN.
  - **Free-form Q&A Mode:** Activates when "Talk to assistant" is tapped. It opens a persistent chat input, triggers the `/api/bot/llm` backend API, displays typing indicators during latency periods, and appends token metrics.
- **Fallback Integration:** If the upstream LLM hits a quota or is unavailable, the client maps the user's input words to matching hardcoded FAQ options to provide helpful fallback guidance.
