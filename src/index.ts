import type { API } from 'homebridge';
import { NetatmoHomeControlPlatform } from './platform';

const PLATFORM_NAME = 'NetatmoHomeControl';

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, NetatmoHomeControlPlatform);
};
