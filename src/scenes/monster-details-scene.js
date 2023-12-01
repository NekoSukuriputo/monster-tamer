import Phaser from '../lib/phaser.js';
import { MONSTER_ASSET_KEYS, MONSTER_PARTY_ASSET_KEYS } from '../assets/asset-keys.js';
import { SCENE_KEYS } from './scene-keys.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { DataUtils } from '../utils/data-utils.js';
import { Controls } from '../utils/controls.js';

/** @type {Phaser.Types.GameObjects.Text.TextStyle} */
const UI_TEXT_STYLE = {
  fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
  color: '#FFFFFF',
  fontSize: '24px',
};

/** @type {Phaser.Types.GameObjects.Text.TextStyle} */
const MONSTER_MOVE_TEXT_STYLE = {
  fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
  color: '#000000',
  fontSize: '40px',
};

/**
 * @typedef MonsterDetailsSceneData
 * @type {object}
 * @property {import('../types/typedef.js').Monster} monster
 */

export class MonsterDetailsScene extends Phaser.Scene {
  /** @type {import('../types/typedef.js').Monster} */
  #monsterDetails;
  /** @type {import('../types/typedef.js').Attack[]} */
  #monsterAttacks;
  /** @type {Controls} */
  #controls;

  constructor() {
    super({ key: SCENE_KEYS.MONSTER_DETAILS_SCENE });
  }

  /**
   * @param {MonsterDetailsSceneData} data
   * @returns {void}
   */
  init(data) {
    console.log(`[${MonsterDetailsScene.name}:init] invoked, data provided: ${JSON.stringify(data)}`);

    this.#monsterDetails = data.monster;
    // added for testing from preload scene directly
    if (this.#monsterDetails === undefined) {
      this.#monsterDetails = DataUtils.getIguanignite(this);
    }

    this.#monsterAttacks = [];
    this.#monsterDetails.attackIds.forEach((attackId) => {
      const monsterAttack = DataUtils.getMonsterAttack(this, attackId);
      if (monsterAttack !== undefined) {
        this.#monsterAttacks.push(monsterAttack);
      }
    });
  }

  /**
   * @returns {void}
   */
  create() {
    console.log(`[${MonsterDetailsScene.name}:create] invoked`);

    // create main background and title
    this.add.image(0, 0, MONSTER_PARTY_ASSET_KEYS.MONSTER_DETAILS_BACKGROUND).setOrigin(0);
    this.add.text(10, 0, 'Monster Details', {
      ...UI_TEXT_STYLE,
      fontSize: '48px',
    });

    // add monster details
    this.add.text(20, 60, `Lv. ${this.#monsterDetails.currentLevel}`, {
      ...UI_TEXT_STYLE,
      fontSize: '40px',
    });
    this.add.text(200, 60, this.#monsterDetails.name, {
      ...UI_TEXT_STYLE,
      fontSize: '40px',
    });
    this.add.image(160, 310, this.#monsterDetails.assetKey).setOrigin(0, 1).setScale(0.7);

    if (this.#monsterAttacks[0] !== undefined) {
      this.add.text(560, 82, this.#monsterAttacks[0].name, MONSTER_MOVE_TEXT_STYLE);
    }

    if (this.#monsterAttacks[1] !== undefined) {
      this.add.text(560, 162, this.#monsterAttacks[1].name, MONSTER_MOVE_TEXT_STYLE);
    }

    if (this.#monsterAttacks[2] !== undefined) {
      this.add.text(560, 242, this.#monsterAttacks[2].name, MONSTER_MOVE_TEXT_STYLE);
    }

    if (this.#monsterAttacks[3] !== undefined) {
      this.add.text(560, 322, this.#monsterAttacks[3].name, MONSTER_MOVE_TEXT_STYLE);
    }

    this.#controls = new Controls(this);
  }

  /**
   * @returns {void}
   */
  update() {
    if (this.#controls.isInputLocked) {
      return;
    }

    if (this.#controls.wasBackKeyPressed()) {
      this.#goBackToPreviousScene();
    }
    if (this.#controls.wasSpaceKeyPressed()) {
      this.#goBackToPreviousScene();
    }
  }

  /**
   * @returns {void}
   */
  #goBackToPreviousScene() {
    this.#controls.lockInput = true;
    this.scene.stop(SCENE_KEYS.MONSTER_DETAILS_SCENE);
    this.scene.resume(SCENE_KEYS.MONSTER_PARTY_SCENE);
  }
}
