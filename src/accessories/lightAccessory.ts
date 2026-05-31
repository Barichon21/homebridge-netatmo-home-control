import type {
  PlatformAccessory,
  Service,
  CharacteristicValue,
  Logger,
} from 'homebridge';
import type { NetatmoHomeControlPlatform } from '../platform';
import type { AccessoryContext } from '../platform';

// Both Netatmo and HomeKit Brightness use 0–100
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export class LightAccessory {
  private readonly service: Service;
  private isOn = false;
  private brightness = 100; // Netatmo 0–100

  constructor(
    private readonly platform: NetatmoHomeControlPlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
    private readonly log: Logger,
  ) {
    const { Service, Characteristic } = this.platform.api.hap;
    const { module, homeId } = accessory.context;

    accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Legrand / Netatmo')
      .setCharacteristic(Characteristic.Model, module.type)
      .setCharacteristic(Characteristic.SerialNumber, module.id);

    this.service = accessory.getService(Service.Lightbulb)
      ?? accessory.addService(Service.Lightbulb);

    this.service.setCharacteristic(Characteristic.Name, module.name);

    this.service.getCharacteristic(Characteristic.On)
      .onGet(() => this.isOn)
      .onSet(async (value: CharacteristicValue) => {
        const on = value as boolean;
        await this.platform.client.setState(homeId, {
          id: module.id,
          bridge: module.bridge,
          on,
        });
        this.isOn = on;
        this.log.debug(`[${module.name}] set on=${on}`);
      });

    this.service.getCharacteristic(Characteristic.Brightness)
      .onGet(() => this.brightness)
      .onSet(async (value: CharacteristicValue) => {
        const brightness = clamp(value as number);
        await this.platform.client.setState(homeId, {
          id: module.id,
          bridge: module.bridge,
          brightness,
        });
        this.brightness = brightness;
        this.log.debug(`[${module.name}] set brightness=${brightness}%`);
      });
  }

  updateState(on: boolean, brightness?: number): void {
    const { Characteristic } = this.platform.api.hap;
    if (this.isOn !== on) {
      this.isOn = on;
      this.service.updateCharacteristic(Characteristic.On, on);
    }
    if (brightness !== undefined && this.brightness !== brightness) {
      this.brightness = clamp(brightness);
      this.service.updateCharacteristic(Characteristic.Brightness, this.brightness);
    }
  }
}
