# 🔐 Google Auth React Lab & Fullstack Implementation

A modern full-stack web application built with **React 19, Vite, Node.js, Express, and Google Authentication** designed to help you test, inspect, and implement Google Sign-In with total confidence.

---

## 🌟 What Was Built (React + Node.js)

1. **React 19 Single Page Application (`client/`)**
   - Built with **Vite** and styled with modern, responsive CSS.
   - Integrated with official **`@react-oauth/google`** library (`<GoogleLogin />` and `<GoogleOAuthProvider />`).
   - Interactive **Live JSON & Token Inspector** with tabs for:
     - **Server Response JSON** (returned from `/api/auth/google`)
     - **Decoded Google Claims** (`sub`, `email`, `aud`, `iss`, `exp`)
     - **Raw Encrypted JWT String** (`header.payload.signature`)
   - **🧪 Instant Demo Login**: Test and view the real-world JSON response immediately even before creating Google Cloud credentials!

2. **Express Backend (`server.js`)**
   - Cryptographically verifies tokens using **`google-auth-library`** (`verifyIdToken`).
   - Secure encrypted session management using **`cookie-session`**.
   - Protected API endpoint (`/api/me`) to verify persistent login state.
   - Dual-serving mode: serves the built React app (`client/dist`) or API routes dynamically.

---

## 📁 Project Structure

```
Google-auth/
├── client/                  # ⚛️ React 19 Frontend (Vite)
│   ├── src/
│   │   ├── App.jsx          # React Auth components, Inspector, & Blueprints
│   │   ├── App.css          # Modern styling matching Google branding
│   │   ├── index.css        # Typography and root styles
│   │   └── main.jsx         # React root entry point
│   ├── vite.config.js       # Vite dev server with proxy to backend
│   └── package.json         # React dependencies (@react-oauth/google, lucide-react)
├── server.js                # 🚀 Express backend with Google verification & session routes
├── .env                     # Your local Google Client ID & Secret
├── .env.example             # Template for environment configuration
└── package.json             # Root scripts (runs backend & frontend concurrently)
```

---

## 🚀 Running the App

### Option A: Run Both Backend & Frontend Together (Development)
From the project root directory:
```bash
npm run dev
```
- **React Frontend (with HMR):** [http://localhost:5173](http://localhost:5173)
- **Express Backend:** [http://localhost:3000](http://localhost:3000)

### Option B: Build React and Serve from Express (Production-Ready)
```bash
npm run build
npm start
```
- Open **[http://localhost:3000](http://localhost:3000)** (serves the compiled React app directly from Express).

---

## 🚀 Quick Start Guide (What You Have to Change)

### Step 1: Get Google OAuth Credentials from Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Google-Auth-Lab`) or select an existing project.
3. Configure the **OAuth Consent Screen**:
   - Go to **APIs & Services** > **OAuth consent screen**.
   - User Type: Select **External** and click **Create**.
   - Fill in:
     - **App name**: e.g., `Google Auth Lab`
     - **User support email**: Your email
     - **Developer contact information**: Your email
   - Under **Scopes**, click **Add or Remove Scopes** and select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Under **Test users**, click **+ ADD USERS** and add your personal Google account email (crucial while the app is in "Testing" mode!).
   - Save and return to dashboard.
4. Create **OAuth Client ID**:
   - Go to **APIs & Services** > **Credentials**.
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Google Auth Test Web App`.
   - **Authorized JavaScript origins**:
     - Click **+ ADD URI** and add:
       ```
       http://localhost:3000
       ```
   - **Authorized redirect URIs**:
     - Click **+ ADD URI** and add:
       ```
       http://localhost:3000/auth/google/callback
       ```
   - Click **CREATE**.
   - Copy your **Client ID** and **Client Secret**.

---

### Step 2: Update Your `.env` File

Open the `.env` file in the project root:

```env
PORT=3000

# Paste your Client ID from Google Cloud Console
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com

# Paste your Client Secret from Google Cloud Console
GOOGLE_CLIENT_SECRET=your_client_secret_here

# The exact callback URL you registered in Google Cloud Console
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Secret key used to encrypt session cookies (any random string)
SESSION_SECRET=dev_secret_google_auth_testing_key_12345
```

---

### Step 3: Start the Application

In your terminal, run:

```bash
npm start
```

Or run with automatic reload during development:

```bash
npm run dev
```

Now open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧠 How Google Auth Actually Works (The Mechanics)

### Method 1: Google Identity Services (GSI)
```
Browser (User)                 Your Backend                  Google Servers
      │                              │                             │
      ├─── Click "Sign In" ──────────┼────────────────────────────►│
      │    (Popup / One-Tap)         │                             │
      │◄── Returns Signed ID Token ──┼─────────────────────────────┤
      │    (JWT)                     │                             │
      │                              │                             │
      ├─── POST /api/auth/google ───►│                             │
      │    { credential: JWT }       │                             │
      │                              ├─── Verify Token Signature ─►│
      │                              │    (verifyIdToken)          │
      │                              │◄── Public Keys Match ───────┤
      │                              │    (Extract sub, email)     │
      │                              │                             │
      │◄── Set Cookie Session ───────┤                             │
      │    (HTTP-Only Cookie)        │                             │
```

1. The frontend loads Google's SDK (`gsi/client`).
2. When the user signs in, Google gives the client a signed **JWT ID Token** (`credential`).
3. **Crucial Security Step:** The client sends this token to your backend (`/api/auth/google`).
4. Your backend uses `google-auth-library` (`verifyIdToken`) to check:
   - Was this token genuinely signed by Google? (`iss === 'https://accounts.google.com'`)
   - Was this token issued specifically for YOUR app? (`aud === GOOGLE_CLIENT_ID`)
   - Is the token still valid? (`exp > current_time`)
5. If valid, your backend extracts the user's permanent ID (`sub`), email, and name, and stores it in an HTTP-only session cookie.

---

### Method 2: OAuth 2.0 Authorization Code Flow
```
Browser (User)                 Your Backend                  Google Servers
      │                              │                             │
      ├─── Click OAuth Link ────────►│                             │
      │    (GET /auth/google)        ├─── Redirect to Google ─────►│
      │◄─────────────────────────────┤    with scope & client_id   │
      │                                                            │
      ├─── User reviews consent screen ───────────────────────────►│
      │◄── Redirect to callback with ?code= ───────────────────────┤
      │    (GET /auth/google/callback?code=...)                    │
      │                              │                             │
      ├─── Browser hits callback ───►│                             │
      │                              ├─── Exchange code for Tokens►│
      │                              │    (Client ID + Secret)     │
      │                              │◄── Access & Refresh Tokens ─┤
      │                              │                             │
      │◄── Set Cookie & Redirect ────┤                             │
```

1. The browser visits `/auth/google`.
2. The server redirects the user to Google's consent screen with requested scopes (`openid`, `profile`, `email`).
3. When the user approves, Google redirects back to `/auth/google/callback?code=AUTHORIZATION_CODE`.
4. Your server securely contacts Google behind the scenes using your `GOOGLE_CLIENT_SECRET` to exchange that temporary code for:
   - **ID Token:** User identity info.
   - **Access Token:** Can be used to call Google APIs (e.g. Gmail, Drive, Calendar, YouTube).
   - **Refresh Token:** Used to get new access tokens when the current one expires.

---

## 🔍 Understanding the Decoded Token Claims

When a user signs in, the lab shows the decoded token payload. Here is what each key means:

| Key | Meaning | What to do with it |
| :--- | :--- | :--- |
| **`sub`** | Subject | The user's permanent, unique Google ID (e.g., `1083948...`). **Use this as the primary key or unique identifier in your database.** |
| **`email`** | Email Address | The user's Google email address. |
| **`email_verified`** | Boolean (`true`/`false`) | Confirms Google verified ownership of this address. |
| **`name`** / **`picture`** | Profile Data | Full name and profile picture URL. |
| **`aud`** | Audience | Matches your `GOOGLE_CLIENT_ID`. If it doesn't match, the token was forged or stolen from another app. |
| **`iss`** | Issuer | Always `https://accounts.google.com`. |
| **`exp`** | Expiration | Unix epoch timestamp when token expires (tokens are short-lived, typically 1 hour). |

---

## 🛠 Common Errors & How to Fix Them

1. **`redirect_uri_mismatch`**
   - **Cause:** The URL the browser was redirected back to does not match the URI in Google Cloud Console.
   - **Fix:** Ensure `http://localhost:3000/auth/google/callback` is listed under **Authorized redirect URIs** in Google Cloud Console.

2. **`origin_mismatch` / `gsi_client` blocked**
   - **Cause:** The origin domain is not whitelisted for Google Identity Services.
   - **Fix:** Ensure `http://localhost:3000` (no trailing slash) is listed under **Authorized JavaScript origins**.

3. **`Access blocked: This app has not been verified` (Error 403)**
   - **Cause:** Your app is in "Testing" mode and the account trying to log in is not listed under Test Users.
   - **Fix:** In Google Cloud Console > **OAuth consent screen** > **Test users**, add your Google email address.
