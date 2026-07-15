import fs from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import type { NetatmoTokenResponse } from './types';

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const TOKEN_CACHE_FILE = 'netatmo-home-control-token.json';

interface TokenCache {
  refresh_token: string;
}

export class NetatmoAuth {
  private accessToken = '';
  private tokenExpiry = 0;
  private refreshToken: string;
  // Cache file inside the Homebridge storage directory — survives plugin
  // reinstalls and works regardless of how Homebridge is installed (hb-service,
  // custom -U path, etc.).
  private readonly tokenCache: string;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    configRefreshToken: string,
    storagePath: string,
  ) {
    this.tokenCache = path.join(storagePath, TOKEN_CACHE_FILE);
    // Prefer the cached token (more recent) over the one in config.json
    this.refreshToken = this.loadCachedToken() ?? configRefreshToken;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }
    await this.refresh();
    return this.accessToken;
  }

  private async refresh(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    try {
      const resp = await axios.post<NetatmoTokenResponse>(TOKEN_URL, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.accessToken = resp.data.access_token;
      this.tokenExpiry = Date.now() + resp.data.expires_in * 1000;

      // Persist the new refresh_token immediately
      if (resp.data.refresh_token) {
        this.refreshToken = resp.data.refresh_token;
        this.saveCachedToken(resp.data.refresh_token);
      }
    } catch (err) {
      const body = err instanceof AxiosError && err.response
        ? JSON.stringify(err.response.data)
        : String(err);
      throw new Error(
        `Token refresh failed (${err instanceof AxiosError ? err.response?.status : '?'}): ${body}\n` +
        `→ Run "node dist/auth-helper.js" to re-authenticate and update config.json`,
      );
    }
  }

  private loadCachedToken(): string | null {
    try {
      const raw = fs.readFileSync(this.tokenCache, 'utf8');
      const data = JSON.parse(raw) as TokenCache;
      return data.refresh_token ?? null;
    } catch {
      return null;
    }
  }

  private saveCachedToken(token: string): void {
    try {
      fs.writeFileSync(this.tokenCache, JSON.stringify({ refresh_token: token }, null, 2));
    } catch {
      // Non-fatal — token will be re-read from config.json next restart
    }
  }
}
