import axios, { AxiosError } from 'axios';
import type { NetatmoAuth } from './auth';
import type { HomesDataResponse, HomeStatusResponse, SetStateModule } from './types';

const BASE = 'https://api.netatmo.com/api';

function extractApiError(err: unknown): string {
  if (err instanceof AxiosError && err.response) {
    const body = JSON.stringify(err.response.data);
    return `HTTP ${err.response.status} — ${body}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export class NetatmoClient {
  constructor(private readonly auth: NetatmoAuth) {}

  async getHomesData(): Promise<HomesDataResponse> {
    const token = await this.auth.getAccessToken();
    try {
      // Netatmo accepts Bearer header; also pass gateway_types to include Home+Control (NLG)
      const resp = await axios.get<HomesDataResponse>(`${BASE}/homesdata`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { gateway_types: 'NLG' },
      });
      return resp.data;
    } catch (err) {
      throw new Error(`homesdata failed: ${extractApiError(err)}`);
    }
  }

  async getHomeStatus(homeId: string): Promise<HomeStatusResponse> {
    const token = await this.auth.getAccessToken();
    try {
      const resp = await axios.get<HomeStatusResponse>(`${BASE}/homestatus`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { home_id: homeId, device_types: 'NLG' },
      });
      return resp.data;
    } catch (err) {
      throw new Error(`homestatus failed: ${extractApiError(err)}`);
    }
  }

  async setState(homeId: string, module: SetStateModule): Promise<void> {
    const token = await this.auth.getAccessToken();
    try {
      await axios.post(
        `${BASE}/setstate`,
        { home: { id: homeId, modules: [module] } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      throw new Error(`setstate failed: ${extractApiError(err)}`);
    }
  }
}
