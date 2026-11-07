require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google OAuth2 Client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware: stores session state in an encrypted cookie
app.use(
  cookieSession({
    name: 'google_auth_session',
    keys: [process.env.SESSION_SECRET || 'dev_secret_google_auth_testing_key_12345'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
);

// Serve static React frontend files
const clientDistPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * 1. Config Check Endpoint
 * Returns Google Client ID so frontend can initialize Google Sign-In SDK
 */
app.get('/api/config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`;

  res.json({
    clientId,
    callbackUrl,
    isConfigured: Boolean(clientId && clientId.trim() !== '' && clientSecret && clientSecret.trim() !== ''),
    hasClientId: Boolean(clientId && clientId.trim() !== ''),
    hasClientSecret: Boolean(clientSecret && clientSecret.trim() !== '')
  });
});

/**
 * 2. Method A: Google Identity Services (GSI) Token Verification
 * Frontend receives ID token (JWT) from Google and sends it here.
 * The backend verifies the token using Google's public certificates.
 */
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Missing credential (ID Token)' });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      error: 'GOOGLE_CLIENT_ID is not configured in the server .env file.'
    });
  }

  try {
    // Verify the ID token with Google Auth Library
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Extract user info
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      givenName: payload.given_name,
      familyName: payload.family_name,
      emailVerified: payload.email_verified,
      authMethod: 'Google Identity Services (One-Tap / Sign-In Button)',
      loginTime: new Date().toISOString(),
      rawPayload: payload,
    };

    // Save in session
    req.session.user = user;

    res.json({
      success: true,
      message: 'Authentication successful',
      user,
    });
  } catch (error) {
    console.error('ID Token Verification Failed:', error.message);
    res.status(401).json({
      error: 'Invalid Google ID Token',
      details: error.message,
    });
  }
});

/**
 * 2b. Interactive Demo Endpoint
 * Allows testing the full UI, token JSON responses, and session flow without needing Google Cloud setup first.
 */
app.post('/api/auth/demo', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const demoPayload = {
    iss: 'https://accounts.google.com',
    azp: '1082938491823-exampleapps.googleusercontent.com',
    aud: '1082938491823-exampleapps.googleusercontent.com',
    sub: '109483920194827364512',
    email: 'alex.developer@gmail.com',
    email_verified: true,
    nbf: now - 10,
    name: 'Alex Developer',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    given_name: 'Alex',
    family_name: 'Developer',
    locale: 'en',
    iat: now,
    exp: now + 3600,
    jti: 'mock_jwt_token_id_992182749'
  };

  const user = {
    id: demoPayload.sub,
    email: demoPayload.email,
    name: demoPayload.name,
    picture: demoPayload.picture,
    givenName: demoPayload.given_name,
    familyName: demoPayload.family_name,
    emailVerified: demoPayload.email_verified,
    authMethod: 'Simulated Google Sign-In (Demo Mode)',
    loginTime: new Date().toISOString(),
    rawPayload: demoPayload,
    isDemo: true
  };

  req.session.user = user;

  res.json({
    success: true,
    message: 'Demo Google Authentication successful! Real session cookie created.',
    user,
    rawGoogleCredential: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhMmIzYyJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk0ODM5MjAxOTQ4MjczNjQ1MTIiLCJlbWFpbCI6ImFsZXguZGV2ZWxvcGVyQGdtYWlsLmNvbSIsIm5hbWUiOiJBbGV4IERldmVsb3BlciJ9.cryptographic_rsa_signature_verified'
  });
});

/**
 * 3. Method B: OAuth 2.0 Authorization Code Flow
 * Initiates the classic redirect flow to Google's consent screen.
 */
app.get('/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h2>Configuration Missing!</h2>
          <p>Please provide <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your <code>.env</code> file.</p>
          <a href="/">Go Back Home</a>
        </body>
      </html>
    `);
  }

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    scope: scopes,
    include_granted_scopes: true,
    prompt: 'consent', // Forces consent screen for testing refresh tokens
  });

  res.redirect(authorizationUrl);
});

/**
 * 4. Method B Callback: Handles Google's redirect with authorization code
 */
app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Google OAuth Error:', error);
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?error=No+authorization+code+provided');
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Verify ID Token to retrieve profile details
    let payload = {};
    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }

    const user = {
      id: payload.sub || 'N/A',
      email: payload.email || 'N/A',
      name: payload.name || 'Google User',
      picture: payload.picture || '',
      givenName: payload.given_name,
      familyName: payload.family_name,
      emailVerified: payload.email_verified,
      authMethod: 'OAuth 2.0 Authorization Code Redirect Flow',
      loginTime: new Date().toISOString(),
      rawPayload: payload,
      tokenDetails: {
        hasAccessToken: Boolean(tokens.access_token),
        hasRefreshToken: Boolean(tokens.refresh_token),
        tokenType: tokens.token_type,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
    };

    // Save in session
    req.session.user = user;

    res.redirect('/?auth=success&method=oauth2');
  } catch (err) {
    console.error('Failed to exchange authorization code:', err.message);
    res.redirect(`/?error=${encodeURIComponent('OAuth code exchange failed: ' + err.message)}`);
  }
});

/**
 * 5. Protected Endpoint: Current Authenticated User Profile
 */
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      authenticated: false,
      error: 'Not authenticated. Please sign in with Google.',
    });
  }

  res.json({
    authenticated: true,
    user: req.session.user,
  });
});

/**
 * 6. Logout Endpoint
 */
app.post('/api/auth/logout', (req, res) => {
  req.session = null; // Clear cookie session
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Fallback to React app index.html for client-side routing
app.use((req, res) => {
  const indexHtml = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(200).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>React frontend build not found</h2>
        <p>Please run <code>npm run build</code>, or run <code>npm run dev</code> for development mode.</p>
      </div>
    `);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Google Auth Test App running on:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`===============================================`);
});
