import type {
  PlatformAccessory,
  Service,
  CharacteristicValue,
  Logger,
} from 'homebridge';
import type { NetatmoHomeControlPlatform } from '../platform';
import type { AccessoryContext } from '../platform';

export class SwitchAccessory {
  private readonly service: Service;
  private isOn = false;

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

    this.service = accessory.getService(Service.Switch)
      ?? accessory.addService(Service.Switch);

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
  }

  updateState(on: boolean): void {
    if (this.isOn !== on) {
      this.isOn = on;
      const { Characteristic } = this.platform.api.hap;
      this.service.updateCharacteristic(Characteristic.On, on);
    }
  }
}
