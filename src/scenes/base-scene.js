import Phaser from '../lib/phaser.js';
import { Controls } from '../utils/controls.js';

export class BaseScene extends Phaser.Scene {
  /** @protected @type {Controls} */
  _controls;

  /**
   * @param {string | Phaser.Types.Scenes.SettingsConfig} [config]
   */
  constructor(config) {
    super(config);
    if (this.constructor === BaseScene) {
      throw new Error('BaseScene is an abstract class and cannot be instantiated.');
    }
  }

  /**
   * @param {any | undefined} [data]
   * @returns {void}
   */
  init(data) {
    if (data) {
      this._log(`[${this.constructor.name}:init] invoked, data provided: ${JSON.stringify(data)}`);
      return;
    }
    this._log(`[${this.constructor.name}:init] invoked`);
  }

  /**
   * @returns {void}
   */
  preload() {
    this._log(`[${this.constructor.name}:preload] invoked`);
  }

  /**
   * @returns {void}
   */
  create() {
    this._log(`[${this.constructor.name}:create] invoked`);

    this._controls = new Controls(this);
  }

  /**
   * @param {DOMHighResTimeStamp} [time]
   * @returns {void}
   */
  update(time) {
    if (!this._controls.wasEKeyPressed()) {
      return;
    }

    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }

    this.scale.startFullscreen();
  }

  /**
   * @protected
   * @param {string} message
   */
  _log(message) {
    console.log(`%c${message}`, 'color: orange; background: black;');
  }
}
