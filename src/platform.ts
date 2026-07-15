import type {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';
import { NetatmoAuth } from './api/auth';
import { NetatmoClient } from './api/client';
import type { NetatmoModule } from './api/types';
import { LIGHT_TYPES, SHUTTER_TYPES, SWITCH_TYPES } from './api/types';
import { LightAccessory } from './accessories/lightAccessory';
import { ShutterAccessory } from './accessories/shutterAccessory';
import { SwitchAccessory } from './accessories/switchAccessory';

export interface AccessoryContext {
  module: NetatmoModule;
  homeId: string;
}

type Handler = SwitchAccessory | LightAccessory | ShutterAccessory;

const PLUGIN_NAME = 'homebridge-netatmo-home-control';
const PLATFORM_NAME = 'NetatmoHomeControl';

export class NetatmoHomeControlPlatform implements DynamicPlatformPlugin {
  readonly client: NetatmoClient;
  private readonly accessories = new Map<string, PlatformAccessory<AccessoryContext>>();
  private readonly handlers = new Map<string, Handler>();
  // Track which home each module belongs to for polling
  private readonly moduleHomes = new Map<string, string>();
  private homeIds: string[] = [];

  constructor(
    private readonly log: Logger,
    private readonly config: PlatformConfig,
    readonly api: API,
  ) {
    const auth = new NetatmoAuth(
      config['client_id'] as string,
      config['client_secret'] as string,
      config['refresh_token'] as string,
      api.user.storagePath(),
    );

    // Optional gateway/device type filter. Accepts a comma-separated string or an
    // array (e.g. "NLG" for Legrand only). When unset, no filter is applied so all
    // gateway families are discovered — including BTicino MyHome (MyHomeServer1).
    const rawGatewayTypes = config['gateway_types'] as string | string[] | undefined;
    const gatewayTypes = Array.isArray(rawGatewayTypes)
      ? rawGatewayTypes.join(',')
      : (rawGatewayTypes?.trim() || undefined);
    if (gatewayTypes) {
      this.log.info(`Restricting discovery to gateway/device types: ${gatewayTypes}`);
    }
    this.client = new NetatmoClient(auth, gatewayTypes);

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices().catch((err) => {
        this.log.error('Discovery failed:', err instanceof Error ? err.message : String(err));
      });
    });
  }

  // Called by Homebridge for accessories restored from cache
  configureAccessory(accessory: PlatformAccessory<AccessoryContext>): void {
    this.accessories.set(accessory.UUID, accessory);
  }

  private async discoverDevices(): Promise<void> {
    this.log.info('Discovering Netatmo Home + Control devices…');

    const data = await this.client.getHomesData();
    const homes = data.body.homes;

    const filterHomeId = this.config['home_id'] as string | undefined;
    const targetHomes = filterHomeId
      ? homes.filter((h) => h.id === filterHomeId)
      : homes;

    if (targetHomes.length === 0) {
      this.log.warn('No homes found. Check your credentials and home_id config.');
      return;
    }

    this.homeIds = targetHomes.map((h) => h.id);

    const activeUUIDs = new Set<string>();

    for (const home of targetHomes) {
      this.log.info(`Home: "${home.name}" (${home.id})`);

      if (!Array.isArray(home.modules) || home.modules.length === 0) {
        this.log.debug(`No modules in home "${home.name}", skipping.`);
        continue;
      }

      for (const module of home.modules) {
        const category = this.categorize(module.type);
        if (!category) {
          continue;
        }

        // Skip modules without a name (Netatmo returns undefined for some remotes)
        if (!module.name) {
          this.log.debug(`Skipping unnamed module ${module.id} (${module.type})`);
          continue;
        }

        const uuid = this.api.hap.uuid.generate(`${home.id}:${module.id}`);
        activeUUIDs.add(uuid);
        this.moduleHomes.set(module.id, home.id);

        const cached = this.accessories.get(uuid);
        if (cached) {
          cached.context.module = module; // refresh static data
          this.api.updatePlatformAccessories([cached]);
          this.registerHandler(category, cached);
          this.log.debug(`Restored: ${module.name} (${module.type})`);
        } else {
          const accessory = new this.api.platformAccessory<AccessoryContext>(
            module.name,
            uuid,
          );
          accessory.context = { module, homeId: home.id };
          this.registerHandler(category, accessory);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.set(uuid, accessory);
          this.log.info(`Added: ${module.name} (${module.type}) in ${home.name}`);
        }
      }
    }

    // Remove accessories for devices no longer in the account
    for (const [uuid, accessory] of this.accessories) {
      if (!activeUUIDs.has(uuid)) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
        this.log.info(`Removed stale accessory: ${accessory.displayName}`);
      }
    }

    const pollInterval = ((this.config['poll_interval'] as number | undefined) ?? 30) * 1000;
    this.startPolling(pollInterval);
  }

  private categorize(type: string): 'switch' | 'light' | 'shutter' | null {
    if (SWITCH_TYPES.has(type)) return 'switch';
    if (LIGHT_TYPES.has(type)) return 'light';
    if (SHUTTER_TYPES.has(type)) return 'shutter';
    return null;
  }

  private registerHandler(
    category: 'switch' | 'light' | 'shutter',
    accessory: PlatformAccessory<AccessoryContext>,
  ): void {
    let handler: Handler;
    switch (category) {
      case 'switch':
        handler = new SwitchAccessory(this, accessory, this.log);
        break;
      case 'light':
        handler = new LightAccessory(this, accessory, this.log);
        break;
      case 'shutter':
        handler = new ShutterAccessory(this, accessory, this.log);
        break;
    }
    this.handlers.set(accessory.UUID, handler);
  }

  private startPolling(intervalMs: number): void {
    this.log.info(`Polling every ${intervalMs / 1000}s`);
    setInterval(() => {
      for (const homeId of this.homeIds) {
        this.pollHome(homeId).catch((err) => {
          this.log.warn(`Poll failed for home ${homeId}:`, err instanceof Error ? err.message : String(err));
        });
      }
    }, intervalMs);
  }

  private async pollHome(homeId: string): Promise<void> {
    const status = await this.client.getHomeStatus(homeId);
    const modules = status.body?.home?.modules;
    if (!Array.isArray(modules)) {
      // Netatmo occasionally returns a 200 with a degraded body (no home/modules)
      // during partial outages. Skip this cycle instead of throwing.
      this.log.debug(`Skipping poll for home ${homeId}: no modules in homestatus response.`);
      return;
    }
    for (const mod of modules) {
      const uuid = this.api.hap.uuid.generate(`${homeId}:${mod.id}`);
      const handler = this.handlers.get(uuid);
      if (!handler) continue;

      if (handler instanceof SwitchAccessory) {
        handler.updateState(mod.on ?? false);
      } else if (handler instanceof LightAccessory) {
        handler.updateState(mod.on ?? false, mod.brightness);
      } else if (handler instanceof ShutterAccessory) {
        handler.updatePosition(
          mod.current_position ?? 0,
          mod.target_position,
        );
      }
    }
  }
}
