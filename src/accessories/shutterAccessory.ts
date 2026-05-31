import type {
  PlatformAccessory,
  Service,
  CharacteristicValue,
  Logger,
} from 'homebridge';
import type { NetatmoHomeControlPlatform } from '../platform';
import type { AccessoryContext } from '../platform';

export class ShutterAccessory {
  private readonly service: Service;
  private currentPosition = 0;   // 0=closed, 100=open
  private targetPosition = 0;
  private positionState: number;
  // step=100 means binary (0 or 100 only); step=1 means continuous
  private readonly positionStep: number;

  constructor(
    private readonly platform: NetatmoHomeControlPlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
    private readonly log: Logger,
  ) {
    const { Service, Characteristic } = this.platform.api.hap;
    const { module, homeId } = accessory.context;

    // Read step from context if available (populated by first poll), default 1
    this.positionStep = module['target_position:step'] ?? 1;
    this.positionState = Characteristic.PositionState.STOPPED;

    accessory.getService(Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, 'Legrand / Netatmo')
      .setCharacteristic(Characteristic.Model, module.type)
      .setCharacteristic(Characteristic.SerialNumber, module.id);

    this.service = accessory.getService(Service.WindowCovering)
      ?? accessory.addService(Service.WindowCovering);

    this.service.setCharacteristic(Characteristic.Name, module.name);

    this.service.getCharacteristic(Characteristic.CurrentPosition)
      .onGet(() => this.currentPosition);

    this.service.getCharacteristic(Characteristic.TargetPosition)
      .onGet(() => this.targetPosition)
      .onSet(async (value: CharacteristicValue) => {
        let pos = value as number;

        // Snap to valid step (e.g. step=100 → only 0 or 100)
        if (this.positionStep >= 100) {
          pos = pos >= 50 ? 100 : 0;
        }

        await this.platform.client.setState(homeId, {
          id: module.id,
          bridge: module.bridge,
          target_position: pos,
        });

        this.targetPosition = pos;

        const moving = pos > this.currentPosition
          ? Characteristic.PositionState.INCREASING
          : pos < this.currentPosition
            ? Characteristic.PositionState.DECREASING
            : Characteristic.PositionState.STOPPED;

        this.positionState = moving;
        this.service.updateCharacteristic(Characteristic.PositionState, moving);
        this.log.debug(`[${module.name}] set target_position=${pos} (step=${this.positionStep})`);
      });

    this.service.getCharacteristic(Characteristic.PositionState)
      .onGet(() => this.positionState);
  }

  updatePosition(currentPosition: number, targetPosition?: number): void {
    const { Characteristic } = this.platform.api.hap;

    if (this.currentPosition !== currentPosition) {
      this.currentPosition = currentPosition;
      this.service.updateCharacteristic(Characteristic.CurrentPosition, currentPosition);
    }

    const newTarget = targetPosition ?? currentPosition;
    if (this.targetPosition !== newTarget) {
      this.targetPosition = newTarget;
      this.service.updateCharacteristic(Characteristic.TargetPosition, newTarget);
    }

    // Mark stopped when current reached target
    if (this.currentPosition === this.targetPosition && this.positionState !== Characteristic.PositionState.STOPPED) {
      this.positionState = Characteristic.PositionState.STOPPED;
      this.service.updateCharacteristic(Characteristic.PositionState, Characteristic.PositionState.STOPPED);
    }
  }
}
