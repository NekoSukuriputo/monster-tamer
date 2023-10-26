import Phaser from '../../lib/phaser.js';
import { HealthBar } from '../ui/health-bar.js';
import { BATTLE_ASSET_KEYS } from '../../assets/asset-keys.js';

export class BattleMonster {
  /** @protected @type {Phaser.Scene} */
  _scene;
  /** @protected @type {import('../../types/typedef.js').Monster} */
  _monsterDetails;
  /** @protected @type {HealthBar} */
  _healthBar;
  /** @protected @type {Phaser.GameObjects.Image} */
  _phaserGameObject;
  /** @protected @type {number} */
  _currentHealth;
  /** @protected @type {number} */
  _maxHealth;
  /** @protected @type {import('../../types/typedef.js').Attack[]} */
  _monsterAttacks;
  /** @protected @type {Phaser.GameObjects.Container} */
  _phaserHealthBarGameContainer;

  /**
   * @param {import('../../types/typedef.js').BattleMonsterConfig} config
   * @param {import('../../types/typedef.js').Coordinate} position
   */
  constructor(config, position) {
    if (this.constructor === BattleMonster) {
      throw new Error('BattleMonster is an abstract class and cannot be instantiated.');
    }
    this._scene = config.scene;
    this._monsterDetails = config.monsterDetails;
    this._currentHealth = this._monsterDetails.currentHp;
    this._maxHealth = this._monsterDetails.maxHp;
    this._monsterAttacks = [];

    this._phaserGameObject = this._scene.add.image(
      position.x,
      position.y,
      this._monsterDetails.assetKey,
      this._monsterDetails.assetFrame || 0
    );
    this.#createHealthBarComponents(config.scaleHealthBarBackgroundImageByY);
  }

  /** @type {boolean} */
  get isFainted() {
    return this._currentHealth <= 0;
  }

  /** @type {string} */
  get name() {
    return this._monsterDetails.name;
  }

  /** @type {import('../../types/typedef.js').Attack[]} */
  get attacks() {
    return [...this._monsterAttacks];
  }

  /** @type {number} */
  get baseAttack() {
    return this._monsterDetails.baseAttack;
  }

  /** @type {number} */
  get level() {
    return this._monsterDetails.currentLevel;
  }

  /**
   * @param {number} damage
   * @param {() => void} [callback]
   * @returns {void}
   */
  takeDamage(damage, callback) {
    // update current monster health and animate health bar
    this._currentHealth -= damage;
    if (this._currentHealth < 0) {
      this._currentHealth = 0;
    }
    this._healthBar.setMeterPercentageAnimated(this._currentHealth / this._maxHealth, { callback });
  }

  #createHealthBarComponents(scaleHealthBarBackgroundImageByY = 1) {
    this._healthBar = new HealthBar(this._scene, 34, 34);

    const monsterNameGameText = this._scene.add.text(30, 20, this.name, {
      color: '#7E3D3F',
      fontSize: '32px',
    });

    const healthBarBgImage = this._scene.add
      .image(0, 0, BATTLE_ASSET_KEYS.HEALTH_BAR_BACKGROUND)
      .setOrigin(0)
      .setScale(1, scaleHealthBarBackgroundImageByY);

    const monsterHealthBarLevelText = this._scene.add
      .text(monsterNameGameText.width + 35, 23, `L${this.level}`, {
        color: '#ED474B',
        fontSize: '28px',
      })
      .setOrigin(0);

    const monsterHpText = this._scene.add.text(30, 55, 'HP', {
      color: '#FF6505',
      fontSize: '24px',
      fontStyle: 'italic',
    });

    this._phaserHealthBarGameContainer = this._scene.add.container(0, 0, [
      healthBarBgImage,
      monsterNameGameText,
      this._healthBar.container,
      monsterHealthBarLevelText,
      monsterHpText,
    ]);
  }
}
