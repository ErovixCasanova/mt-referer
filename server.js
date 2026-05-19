import { createServer } from 'node:http';
import { parse } from 'node:url';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const PORT = process.env.PORT || 3000;
// Railway sets SECRET_KEY - make sure we read it correctly
const SECRET_KEY = process.env.SECRET_KEY;

console.log('🔍 Debug: Checking environment...');
console.log(`PORT: ${PORT}`);
console.log(`SECRET_KEY exists: ${SECRET_KEY ? 'YES' : 'NO'}`);
console.log(`SECRET_KEY length: ${SECRET_KEY ? SECRET_KEY.length : 0}`);

if (!SECRET_KEY) {
  console.error('❌ SECRET_KEY environment variable is required!');
  console.error('💡 Generate one with: node -e "console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))"');
  process.exit(1);
}

// Check if SECRET_KEY is valid hex (should be 64 chars)
const isHex = /^[0-9a-fA-F]+$/.test(SECRET_KEY);
console.log(`SECRET_KEY is valid hex: ${isHex ? 'YES' : 'NO'}`);

if (!isHex) {
  console.error('❌ SECRET_KEY must contain only hex characters (0-9, a-f)');
  console.error(`Current value starts with: ${SECRET_KEY.substring(0, 10)}...`);
  process.exit(1);
}

let key;
try {
  key = Buffer.from(SECRET_KEY, 'hex');
  if (key.length !== 32) {
    console.error(`❌ SECRET_KEY must be 32 bytes (64 hex chars). Got ${key.length} bytes`);
    process.exit(1);
  }
  console.log('✅ SECRET_KEY is valid!');
} catch (err) {
  console.error('❌ Failed to create buffer from SECRET_KEY:', err.message);
  process.exit(1);
}

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64url');
}

function decrypt(encryptedBase64Url) {
  const buffer = Buffer.from(encryptedBase64Url, 'base64url');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

const warningPage = (targetUrl) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MT Referrer • External Link</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      max-width: 600px;
      width: 100%;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 28px;
      border: 1px solid rgba(56, 189, 248, 0.2);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .icon { text-align: center; font-size: 64px; padding: 40px 32px 0; }
    h1 {
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      margin: 16px 32px 4px;
    }
    .tagline { text-align: center; color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 3px solid #ef4444;
      margin: 20px 32px;
      padding: 14px;
      border-radius: 12px;
    }
    .warning-text { color: #fca5a5; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
    .url-box {
      background: rgba(30, 41, 59, 0.8);
      padding: 16px;
      margin: 0 32px;
      border-radius: 16px;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .url-label { font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
    .target-url { font-family: monospace; font-size: 13px; color: #e2e8f0; word-break: break-all; }
    .buttons { display: flex; gap: 12px; padding: 28px 32px 24px; }
    .btn {
      flex: 1;
      padding: 12px 20px;
      border-radius: 40px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: white;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -5px rgba(56,189,248,0.4); }
    .btn-secondary {
      background: rgba(51, 65, 85, 0.8);
      color: #cbd5e1;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .btn-secondary:hover { background: rgba(71, 85, 105, 0.8); }
    .countdown { text-align: center; padding: 0 32px 28px; font-size: 12px; color: #64748b; }
    .countdown span { font-weight: 700; color: #38bdf8; font-size: 15px; }
    .footer {
      background: rgba(0, 0, 0, 0.3);
      padding: 20px 32px;
      text-align: center;
      font-size: 10px;
      color: #475569;
      border-top: 1px solid rgba(56, 189, 248, 0.1);
    }
    .footer a { color: #64748b; text-decoration: none; margin: 0 8px; }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 10px;
      margin-top: 12px;
    }
  </style>
</head>
<body>
<div class="card">
  <div class="icon">🔐</div>
  <h1>MT Referrer</h1>
  <div class="tagline">secure • encrypted • permanent links</div>
  <div class="warning">
    <div class="warning-text">⚠️ You are about to leave MT Referrer</div>
  </div>
  <div class="url-box">
    <div class="url-label">🔗 DESTINATION URL</div>
    <div class="target-url">${targetUrl}</div>
  </div>
  <div class="buttons">
    <a href="${targetUrl}" class="btn btn-primary">Continue →</a>
    <button class="btn btn-secondary" onclick="history.back()">Cancel</button>
  </div>
  <div class="countdown">Redirecting in <span id="countdown">3</span> seconds...</div>
  <div class="footer">
    <span>🔒 AES-256-GCM encrypted</span> • <span>♾️ Never expires</span> • <span>🛡️ Tamper-proof</span>
    <div class="badge">🔐 Military-grade encryption</div>
    <div style="margin-top: 12px;"><a href="/">Home</a> | <a href="#">Privacy</a> | <a href="#">Terms</a></div>
    <div style="margin-top: 8px;">© 2026 MT Referrer. All rights reserved.</div>
  </div>
</div>
<script>
  let seconds = 3;
  const countdownEl = document.getElementById('countdown');
  const timer = setInterval(() => {
    seconds--;
    countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      window.location.href = '${targetUrl}';
    }
  }, 1000);
</script>
</body>
</html>`;

const homePage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MT Referrer • Secure Link Generator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .card {
      max-width: 580px;
      width: 100%;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 32px;
      border: 1px solid rgba(56, 189, 248, 0.2);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a, #1e1b4b);
      padding: 48px 32px;
      text-align: center;
      border-bottom: 1px solid rgba(56, 189, 248, 0.2);
    }
    .header h1 { color: white; font-size: 36px; margin-bottom: 8px; }
    .header .accent {
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .header p { color: #94a3b8; font-size: 14px; }
    .form-container { padding: 32px; }
    .form-group { margin-bottom: 24px; }
    label {
      display: block;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 8px;
      font-size: 13px;
      letter-spacing: 0.3px;
    }
    input {
      width: 100%;
      padding: 14px 18px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 16px;
      font-size: 15px;
      color: white;
      font-family: inherit;
      transition: all 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #38bdf8;
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
    }
    input::placeholder { color: #475569; }
    .btn-generate {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      color: white;
      border: none;
      border-radius: 40px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    }
    .btn-generate:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -5px rgba(56, 189, 248, 0.4);
    }
    .result {
      margin-top: 28px;
      padding: 20px;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 20px;
      display: none;
      border: 1px solid rgba(56, 189, 248, 0.15);
    }
    .result.show { display: block; animation: slideUp 0.3s ease-out; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .result-label {
      font-size: 11px;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .result-url {
      font-family: monospace;
      word-break: break-all;
      background: rgba(0, 0, 0, 0.3);
      padding: 12px;
      border-radius: 12px;
      font-size: 12px;
      color: #cbd5e1;
      margin-bottom: 14px;
    }
    .copy-btn {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 8px 18px;
      border-radius: 40px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #38bdf8;
      transition: all 0.2s;
    }
    .copy-btn:hover { background: rgba(56, 189, 248, 0.25); }
    .features {
      display: flex;
      gap: 16px;
      padding: 24px 32px 32px;
      border-top: 1px solid rgba(56, 189, 248, 0.1);
    }
    .feature {
      flex: 1;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    .feature span { display: block; font-size: 24px; margin-bottom: 6px; }
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🔐 <span class="accent">MT</span> Referrer</h1>
    <p>Create encrypted, permanent referral links</p>
  </div>
  <div class="form-container">
    <div class="form-group">
      <label>🔗 Destination URL</label>
      <input type="url" id="targetUrl" placeholder="https://example.com/page" autocomplete="off">
    </div>
    <button class="btn-generate" onclick="generateLink()">✨ Generate Secure Link</button>
    <div id="result" class="result">
      <div class="result-label">✅ YOUR ENCRYPTED LINK (NEVER EXPIRES)</div>
      <div class="result-url" id="resultUrl"></div>
      <button class="copy-btn" onclick="copyToClipboard()">📋 Copy Link</button>
    </div>
  </div>
  <div class="features">
    <div class="feature"><span>🔒</span>AES-256-GCM</div>
    <div class="feature"><span>♾️</span>Never expires</div>
    <div class="feature"><span>🛡️</span>Tamper-proof</div>
  </div>
</div>
<script>
  async function generateLink() {
    const url = document.getElementById('targetUrl').value;
    if (!url || !url.startsWith('http')) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }
    const res = await fetch(\`/create?url=\${encodeURIComponent(url)}\`);
    const data = await res.json();
    if (data.link) {
      const resultDiv = document.getElementById('result');
      const resultUrl = document.getElementById('resultUrl');
      resultUrl.textContent = data.link;
      resultDiv.classList.add('show');
    } else {
      alert('Error generating link');
    }
  }
  async function copyToClipboard() {
    const url = document.getElementById('resultUrl').textContent;
    await navigator.clipboard.writeText(url);
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = originalText, 2000);
  }
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const { pathname, query } = parse(req.url, true);
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${protocol}://${req.headers.host}`;
  
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(homePage);
    return;
  }
  
  if (pathname === '/create' && req.method === 'GET') {
    const targetUrl = query.url;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid URL required' }));
      return;
    }
    const encryptedToken = encrypt(targetUrl);
    const secureLink = `${baseUrl}/url/${encryptedToken}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ link: secureLink }));
    return;
  }
  
  if (pathname.startsWith('/url/')) {
    const token = pathname.slice(5);
    try {
      const originalUrl = decrypt(token);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(warningPage(originalUrl));
    } catch (err) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><head><title>Invalid Link</title><style>
body{font-family:system-ui;background:#0a0a0a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;text-align:center}
a{color:#38bdf8}
</style></head>
<body><div><h1>🔒 Invalid Link</h1><p>This referral link has been tampered with or is invalid.</p><a href="/">← Generate new link</a></div></body></html>`);
    }
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<h1>404 - Not Found</h1>');
});

server.listen(PORT, () => {
  console.log(`\n🔐 MT Referrer running on port ${PORT}`);
  console.log(`⚡ AES-256-GCM encryption enabled`);
  console.log(`♾️ Links never expire - permanent storage`);
  console.log(`📝 Generate your first secure link now!\n`);
});
