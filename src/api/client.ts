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
  /**
   * @param gatewayTypes Optional comma-separated Netatmo gateway/device types to
   *   restrict discovery to (e.g. "NLG" for Legrand Home+Control). When empty,
   *   no filter is sent so all gateway families are returned — including BTicino
   *   MyHome (MyHomeServer1) whose gateway type is not "NLG".
   */
  constructor(
    private readonly auth: NetatmoAuth,
    private readonly gatewayTypes?: string,
  ) {}

  async getHomesData(): Promise<HomesDataResponse> {
    const token = await this.auth.getAccessToken();
    try {
      const params = this.gatewayTypes ? { gateway_types: this.gatewayTypes } : {};
      const resp = await axios.get<HomesDataResponse>(`${BASE}/homesdata`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return resp.data;
    } catch (err) {
      throw new Error(`homesdata failed: ${extractApiError(err)}`);
    }
  }

  async getHomeStatus(homeId: string): Promise<HomeStatusResponse> {
    const token = await this.auth.getAccessToken();
    try {
      const params: Record<string, string> = { home_id: homeId };
      if (this.gatewayTypes) {
        params.device_types = this.gatewayTypes;
      }
      const resp = await axios.get<HomeStatusResponse>(`${BASE}/homestatus`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
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
