export interface NetatmoTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface NetatmoModule {
  id: string;
  name: string;
  type: string;
  bridge?: string;
  // State (from homestatus)
  on?: boolean;
  brightness?: number;           // 0–100
  current_position?: number;     // 0=closed, 100=open
  target_position?: number;
  'target_position:step'?: number; // 1=continuous, 100=binary open/close
}

export interface NetatmoRoom {
  id: string;
  name: string;
  module_ids: string[];
}

export interface NetatmoHome {
  id: string;
  name: string;
  modules: NetatmoModule[];
  rooms: NetatmoRoom[];
}

export interface HomesDataResponse {
  body: { homes: NetatmoHome[] };
  status: string;
}

export interface HomeStatusResponse {
  body: { home: { id: string; modules: NetatmoModule[] } };
  status: string;
}

export interface SetStateModule {
  id: string;
  bridge?: string;
  on?: boolean;
  brightness?: number;
  target_position?: number;
}

// Module type classifications
export const SWITCH_TYPES = new Set([
  'NLP',   // Power outlet
  'NLPM',  // Mobile socket
  'NLL',   // On/Off toggle
  'NLM',   // Micromodule
  'NLC',   // Cable outlet (radiateurs, sèche-serviettes…)
  'NLPO',  // Outdoor/special power outlet (chauffe-eau…)
  'NLPT',  // Outlet with timer (lumières escaliers…)
  'NLIS',  // Micromodule with sensor (lumières cuisine…)
  'BNCS',  // BTicino socket
]);

export const LIGHT_TYPES = new Set([
  'NLF',   // Dimmer switch
  'NLFN',  // Dimmer (new gen)
  'NLFE',  // Dimmer light
]);

export const SHUTTER_TYPES = new Set([
  'NLV',   // Shutter (no position feedback)
  'NLLV',  // Shutter with position
  'NBR',   // Bubendorff roller shutter
  'NLJ',   // BTicino shutter/garage
]);

