#!/usr/bin/env node
/**
 * Interactive OAuth2 helper — run once to obtain a refresh_token.
 * Usage: npx ts-node src/auth-helper.ts
 *   or after build: node dist/auth-helper.js
 */

import http from 'http';
import { URL } from 'url';
import axios from 'axios';
import readline from 'readline';

const REDIRECT_URI = 'http://localhost:3001/callback';
const AUTHORIZE_URL = 'https://api.netatmo.com/oauth2/authorize';
const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const SCOPES = 'read_magellan write_magellan read_bubendorff write_bubendorff';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:3001`);
      const code = url.searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Done! You can close this tab and return to the terminal.</h2>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end('Missing code parameter.');
        reject(new Error('No code in callback'));
      }
    });
    server.listen(3001);
    server.on('error', reject);
    console.log('Listening on http://localhost:3001/callback');
  });
}

async function main(): Promise<void> {
  console.log('\n=== Netatmo Home + Control — OAuth2 setup ===\n');
  console.log('Create your app at: https://dev.netatmo.com/apps/createanapp');
  console.log(`Set the redirect URI to: ${REDIRECT_URI}\n`);

  const clientId = await prompt('Enter your client_id: ');
  const clientSecret = await prompt('Enter your client_secret: ');

  const authUrl =
    `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for callback on http://localhost:3001/callback …\n');

  const code = await waitForCode();
  console.log('Authorization code received. Exchanging for tokens…');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await axios.post(TOKEN_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token } = resp.data as {
    access_token: string;
    refresh_token: string;
  };

  console.log('\n✅ Success! Add this to your Homebridge config.json:\n');
  console.log(JSON.stringify({
    platform: 'NetatmoHomeControl',
    name: 'Netatmo Home + Control',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token,
  }, null, 2));
  console.log('\naccess_token (valid 3h, for testing only):', access_token);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
