import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { 
  ShieldCheck, 
  User, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  LogOut, 
  Zap, 
  AlertTriangle,
  Code2,
  FileCode,
  Database,
  Cloud
} from 'lucide-react';
import './App.css';

// Helper to decode JWT in the browser
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  
  // UI Tabs
  const [methodTab, setMethodTab] = useState('gsi'); // 'gsi' | 'oauth'
  const [inspectorTab, setInspectorTab] = useState('server'); // 'server' | 'claims' | 'raw'
  const [recipeTab, setRecipeTab] = useState('react'); // 'react' | 'nextjs' | 'db' | 'apis'
  
  // Inspector Data
  const [serverResponse, setServerResponse] = useState(null);
  const [googleClaims, setGoogleClaims] = useState(null);
  const [rawCredential, setRawCredential] = useState('');
  const [copied, setCopied] = useState(false);

  // 1. Load configuration and session on mount
  useEffect(() => {
    async function init() {
      try {
        // Fetch server OAuth config
        const configRes = await fetch('/api/config');
        const configData = await configRes.json();
        setConfig(configData);

        // Check if user session already exists
        const userRes = await fetch('/api/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
          setServerResponse(userData);
          setGoogleClaims(userData.user.rawPayload || null);
        }

        // Check query parameters (for OAuth 2.0 redirect feedback)
        const params = new URLSearchParams(window.location.search);
        if (params.get('auth') === 'success') {
          showAlert('OAuth 2.0 redirect flow completed successfully!', 'success');
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (params.get('error')) {
          showAlert(`OAuth error: ${params.get('error')}`, 'error');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        showAlert('Could not connect to backend server. Make sure port 3000 is running.', 'error');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const showAlert = (message, type = 'info') => {
    setAlert({ message, type });
    if (type !== 'error') {
      setTimeout(() => setAlert(null), 5000);
    }
  };

  // 2. Handle Google Login Success (via @react-oauth/google)
  const handleGoogleSuccess = async (credentialResponse) => {
    showAlert('Received Google token! Cryptographically verifying with backend...', 'info');

    const jwtToken = credentialResponse.credential;
    setRawCredential(jwtToken);
    setGoogleClaims(decodeJwt(jwtToken));

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: jwtToken }),
      });

      const data = await res.json();
      setServerResponse(data);

      if (!res.ok) {
        throw new Error(data.error || 'Server token verification failed');
      }

      setUser(data.user);
      showAlert(`Welcome ${data.user.name}! Authentication verified.`, 'success');
    } catch (err) {
      console.error('Login error:', err);
      showAlert(`Sign in failed: ${err.message}`, 'error');
    }
  };

  // 3. Demo Login Handler (Allows instant testing without Google credentials)
  const handleDemoLogin = async () => {
    showAlert('Generating simulated Google Auth response...', 'info');

    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json();

      setServerResponse(data);
      setGoogleClaims(data.user.rawPayload);
      setRawCredential(data.rawGoogleCredential);
      setUser(data.user);

      showAlert('Demo Session created! Check the live JSON response on the right.', 'success');
    } catch (err) {
      showAlert(`Demo login failed: ${err.message}`, 'error');
    }
  };

  // 4. Test Protected API (/api/me)
  const handleTestProtected = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setServerResponse(data);

      if (res.ok) {
        showAlert(`Protected API returned 200 OK! Valid session for ${data.user.name}.`, 'success');
      } else {
        showAlert(`Protected API returned ${res.status} Unauthorized.`, 'error');
      }
    } catch (err) {
      showAlert(`Protected API call failed: ${err.message}`, 'error');
    }
  };

  // 5. Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setServerResponse({ status: 'logged_out', message: 'User session destroyed.' });
      setGoogleClaims(null);
      setRawCredential('');
      showAlert('Signed out successfully.', 'info');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Copy helper
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInspectorContent = () => {
    if (inspectorTab === 'server') {
      return JSON.stringify(serverResponse || { status: 'awaiting_authentication', hint: 'Sign in to inspect server JSON' }, null, 2);
    }
    if (inspectorTab === 'claims') {
      return JSON.stringify(googleClaims || { hint: 'No Google claims decoded yet' }, null, 2);
    }
    if (inspectorTab === 'raw') {
      return rawCredential || '// Raw Google JWT string will appear here when authenticated.\n// Format: header.payload.signature';
    }
    return '';
  };

  const effectiveClientId = config?.clientId || 'dummy-placeholder-client-id';

  return (
    <GoogleOAuthProvider clientId={effectiveClientId}>
      <div className="react-lab-container">
        
        {/* Navigation Bar */}
        <header className="navbar">
          <div className="brand">
            <div className="logo-box">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div>
              <div className="title-row">
                <h1>Google Auth React Lab</h1>
                <span className="react-badge">React 19 + Vite</span>
              </div>
              <p className="subtitle">Full-stack React implementation with real-time JSON inspection</p>
            </div>
          </div>

          <div className={`status-pill ${user ? 'authenticated' : 'unauthenticated'}`}>
            <span className="pulse-dot"></span>
            <span>{user ? `Logged in: ${user.name}` : 'Not Signed In'}</span>
          </div>
        </header>

        {/* Missing Credentials Alert Banner */}
        {config && (!config.hasClientId || !config.hasClientSecret) && (
          <div className="banner banner-warning">
            <AlertTriangle className="banner-icon" />
            <div className="banner-body">
              <h3>Google Credentials Not Configured in <code>.env</code></h3>
              <p>
                To test with your real Google account, provide your <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the project's <code>.env</code> file.
              </p>
              <div className="chip-list">
                <span className="chip">1. Add Authorized JavaScript Origin: <code>http://localhost:5173</code></span>
                <span className="chip">2. Add Authorized Redirect URI: <code>http://localhost:3000/auth/google/callback</code></span>
              </div>
            </div>
          </div>
        )}

        {/* Global Toast Alert */}
        {alert && (
          <div className={`alert-box alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        {/* Main Grid: Auth Playground vs Live JSON Inspector */}
        <main className="main-grid">

          {/* LEFT COLUMN: Playground */}
          <section className="card card-playground">
            <div className="card-header">
              <div className="header-icon-title">
                <ShieldCheck className="icon-blue" />
                <h2>Authentication Playground</h2>
              </div>
              <span className="pill-badge">Interactive</span>
            </div>

            {!user ? (
              <div className="auth-methods-container">
                {/* Demo Shortcut */}
                <div className="demo-callout">
                  <div className="callout-text">
                    <strong>Want to see the JSON right now?</strong>
                    <span>No Google Cloud credentials required!</span>
                  </div>
                  <button className="btn btn-demo" onClick={handleDemoLogin}>
                    <Zap size={16} /> Instant Demo Login
                  </button>
                </div>

                <div className="tab-switcher">
                  <button 
                    className={`tab-btn ${methodTab === 'gsi' ? 'active' : ''}`}
                    onClick={() => setMethodTab('gsi')}
                  >
                    Method 1: React Google Button
                  </button>
                  <button 
                    className={`tab-btn ${methodTab === 'oauth' ? 'active' : ''}`}
                    onClick={() => setMethodTab('oauth')}
                  >
                    Method 2: OAuth 2.0 Redirect
                  </button>
                </div>

                {methodTab === 'gsi' && (
                  <div className="method-box">
                    <span className="method-tag">Recommended React Component</span>
                    <h3>Official <code>&lt;GoogleLogin /&gt;</code> Component</h3>
                    <p>
                      Uses <code>@react-oauth/google</code> to display Google's official button. Handles account selection in a popup or One-Tap and sends the signed JWT to <code>/api/auth/google</code>.
                    </p>

                    <div className="button-area">
                      {config?.hasClientId ? (
                        <GoogleLogin
                          onSuccess={handleGoogleSuccess}
                          onError={() => showAlert('Google Sign-In failed or popup was closed', 'error')}
                          useOneTap
                          shape="pill"
                          size="large"
                          theme="outline"
                        />
                      ) : (
                        <div className="notice-box">
                          ⚠️ <strong>Google Button Disabled:</strong> Add <code>GOOGLE_CLIENT_ID</code> to <code>.env</code> to activate the official button, or click <strong>Instant Demo Login</strong> above to preview!
                        </div>
                      )}
                    </div>

                    <div className="steps-list">
                      <div className="step-item"><span className="step-num">1</span> User clicks React Google Login button</div>
                      <div className="step-item"><span className="step-num">2</span> Google returns encrypted JWT credential</div>
                      <div className="step-item"><span className="step-num">3</span> Backend cryptographically verifies token</div>
                    </div>
                  </div>
                )}

                {methodTab === 'oauth' && (
                  <div className="method-box">
                    <span className="method-tag">Classic Server Redirect</span>
                    <h3>OAuth 2.0 Redirect Flow</h3>
                    <p>
                      Redirects the entire browser to Google's consent screen. After approval, Google returns an authorization code to our backend callback to exchange for tokens.
                    </p>

                    <div className="redirect-btn-area">
                      <a href="/auth/google" className="btn btn-google-redirect">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Continue with Google (Redirect)</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Authenticated Profile View */
              <div className="authenticated-profile">
                <div className="profile-banner">
                  <img 
                    src={user.picture || 'https://via.placeholder.com/80?text=Avatar'} 
                    alt={user.name} 
                    className="avatar-img"
                  />
                  <div className="profile-meta">
                    <h3>{user.name}</h3>
                    <p className="profile-email">{user.email}</p>
                    <div className="meta-tags">
                      <span className="tag tag-success">✓ Email Verified</span>
                      <span className="tag tag-blue">{user.authMethod || 'Google Sign-In'}</span>
                    </div>
                  </div>
                </div>

                <div className="profile-info-grid">
                  <div className="info-row">
                    <span className="info-label">Google Unique ID (sub):</span>
                    <span className="info-value mono">{user.id}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Session Login Time:</span>
                    <span className="info-value">{new Date(user.loginTime).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="profile-buttons">
                  <button className="btn btn-secondary" onClick={handleTestProtected}>
                    <Zap size={16} /> Test Protected API (<code>/api/me</code>)
                  </button>
                  <button className="btn btn-danger" onClick={handleLogout}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT COLUMN: Live JSON & Token Inspector */}
          <section className="card card-inspector">
            <div className="card-header">
              <div className="header-icon-title">
                <Code2 className="icon-purple" />
                <h2>Live JSON & Token Inspector</h2>
              </div>
              <span className="pill-badge pill-purple">Real-Time</span>
            </div>

            <p className="section-desc">
              Examine the verified claims and payload responses exchanged between Google and your server:
            </p>

            <div className="inspector-subtabs">
              <button 
                className={`subtab-btn ${inspectorTab === 'server' ? 'active' : ''}`}
                onClick={() => setInspectorTab('server')}
              >
                1. Server Response (JSON)
              </button>
              <button 
                className={`subtab-btn ${inspectorTab === 'claims' ? 'active' : ''}`}
                onClick={() => setInspectorTab('claims')}
              >
                2. Decoded Google Claims
              </button>
              <button 
                className={`subtab-btn ${inspectorTab === 'raw' ? 'active' : ''}`}
                onClick={() => setInspectorTab('raw')}
              >
                3. Raw JWT Credential
              </button>
            </div>

            <div className="code-viewer">
              <div className="code-viewer-top">
                <span>
                  {inspectorTab === 'server' && 'Backend API Response (/api/auth/google)'}
                  {inspectorTab === 'claims' && 'Verified Google JWT Claims (Payload)'}
                  {inspectorTab === 'raw' && 'Raw Encrypted Google JWT String'}
                </span>
                <button className="btn-copy" onClick={() => handleCopy(getInspectorContent())}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="code-content">
                <code>{getInspectorContent()}</code>
              </pre>
            </div>

            {/* Claims Guide */}
            <div className="claims-dictionary">
              <h4>Key Google Claims Dictionary:</h4>
              <div className="dictionary-grid">
                <div>
                  <strong><code>sub</code> (Subject):</strong>
                  <span>Permanent unique Google User ID. Store as primary key in DB.</span>
                </div>
                <div>
                  <strong><code>email</code>:</strong>
                  <span>User's verified Google email address.</span>
                </div>
                <div>
                  <strong><code>aud</code> (Audience):</strong>
                  <span>Matches your Client ID to ensure token was created for your app.</span>
                </div>
                <div>
                  <strong><code>exp</code> (Expires):</strong>
                  <span>Unix expiration timestamp (usually 1 hour).</span>
                </div>
              </div>
            </div>
          </section>

        </main>

        {/* BOTTOM SECTION: Production Code Blueprints & Framework Recipes */}
        <section className="card card-recipes" id="recipes">
          <div className="card-header">
            <div className="header-icon-title">
              <FileCode className="icon-green" />
              <h2>Full Production Code Blueprints for New Applications</h2>
            </div>
            <span className="pill-badge pill-green">Copy-Paste Recipes</span>
          </div>

          <p className="section-desc">
            Copy and adapt these proven patterns directly into your new React, Next.js, or Fullstack projects:
          </p>

          <div className="tab-switcher recipe-switcher">
            <button 
              className={`tab-btn ${recipeTab === 'react' ? 'active' : ''}`}
              onClick={() => setRecipeTab('react')}
            >
              ⚛️ React (@react-oauth/google)
            </button>
            <button 
              className={`tab-btn ${recipeTab === 'nextjs' ? 'active' : ''}`}
              onClick={() => setRecipeTab('nextjs')}
            >
              ▲ Next.js App Router
            </button>
            <button 
              className={`tab-btn ${recipeTab === 'db' ? 'active' : ''}`}
              onClick={() => setRecipeTab('db')}
            >
              🗄️ Database & Account Linking
            </button>
            <button 
              className={`tab-btn ${recipeTab === 'apis' ? 'active' : ''}`}
              onClick={() => setRecipeTab('apis')}
            >
              📂 Google APIs (Drive/Calendar)
            </button>
          </div>

          {recipeTab === 'react' && (
            <div className="recipe-box">
              <h3>React Component Pattern</h3>
              <p>Install with <code>npm install @react-oauth/google</code>:</p>
              <pre className="code-content"><code>{`import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function LoginButton() {
  const handleSuccess = async (credentialResponse) => {
    // 1. Send credential to your backend
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialResponse.credential })
    });
    const data = await res.json();
    console.log('User signed in:', data.user);
  };

  return (
    <GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => console.log('Login Failed')}
        useOneTap
        shape="pill"
      />
    </GoogleOAuthProvider>
  );
}`}</code></pre>
            </div>
          )}

          {recipeTab === 'nextjs' && (
            <div className="recipe-box">
              <h3>Next.js App Router API Route (<code>app/api/auth/google/route.js</code>)</h3>
              <pre className="code-content"><code>{`import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { cookies } from 'next/headers';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(request) {
  const { credential } = await request.json();

  // 1. Cryptographically verify token
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();

  // 2. Set secure HTTP-only session cookie in Next.js
  const cookieStore = await cookies();
  cookieStore.set('session_user_id', payload.sub, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  return NextResponse.json({
    success: true,
    user: { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture }
  });
}`}</code></pre>
            </div>
          )}

          {recipeTab === 'db' && (
            <div className="recipe-box">
              <h3>Database User Schema & Account Linking Pattern</h3>
              <p>Store users in PostgreSQL / Prisma / MongoDB without duplicating accounts when users sign in with email vs Google:</p>
              <pre className="code-content"><code>{`async function findOrCreateGoogleUser(payload) {
  const { sub: googleId, email, name, picture } = payload;

  // 1. Check if user already exists with this Google ID
  let user = await db.user.findUnique({ where: { googleId } });
  if (user) return user;

  // 2. If a user with this email registered previously via password, link Google!
  user = await db.user.findUnique({ where: { email } });
  if (user) {
    return await db.user.update({
      where: { email },
      data: { googleId, avatar_url: picture || user.avatar_url }
    });
  }

  // 3. Otherwise create brand new user
  return await db.user.create({
    data: { googleId, email, name, avatar_url: picture }
  });
}`}</code></pre>
            </div>
          )}

          {recipeTab === 'apis' && (
            <div className="recipe-box">
              <h3>Accessing Google APIs (Drive, Calendar, Gmail)</h3>
              <pre className="code-content"><code>{`const { google } = require('googleapis');

// When using Method 2 (OAuth Redirect Flow), exchange the code for access/refresh tokens:
// const { tokens } = await oauth2Client.getToken(code);
// oauth2Client.setCredentials(tokens);

async function listGoogleDriveFiles(authClient) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const response = await drive.files.list({
    pageSize: 10,
    fields: 'files(id, name, mimeType)'
  });
  return response.data.files;
}`}</code></pre>
            </div>
          )}

        </section>

        {/* Footer */}
        <footer className="footer">
          <p>Google Auth React Testing Lab • Built with React 19, Vite, and Google Identity Services</p>
        </footer>

      </div>
    </GoogleOAuthProvider>
  );
}
