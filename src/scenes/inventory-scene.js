import Phaser from '../lib/phaser.js';
import { INVENTORY_ASSET_KEYS, UI_ASSET_KEYS } from '../assets/asset-keys.js';
import { SCENE_KEYS } from './scene-keys.js';
import { BaseScene } from './base-scene.js';
import { NineSlice } from '../utils/nine-slice.js';
import { KENNEY_FUTURE_NARROW_FONT_NAME } from '../assets/font-keys.js';
import { DIRECTION } from '../common/direction.js';
import { exhaustiveGuard } from '../utils/guard.js';
import { dataManager } from '../utils/data-manager.js';

/** @type {Phaser.Types.GameObjects.Text.TextStyle} */
const INVENTORY_TEXT_STYLE = {
  fontFamily: KENNEY_FUTURE_NARROW_FONT_NAME,
  color: '#000000',
  fontSize: '30px',
};

const INVENTORY_ITEM_POSITION = Object.freeze({
  x: 50,
  y: 14,
  space: 50,
});

const CANCEL_TEXT_DESCRIPTION = 'Close your bag, and go back to adventuring!';

/**
 * @typedef InventorySceneData
 * @type {object}
 * @property {string} previousSceneName
 */

/**
 * @typedef InventoryItemGameObjects
 * @type {object}
 * @property {Phaser.GameObjects.Text} [itemName]
 * @property {Phaser.GameObjects.Text} [quantitySign]
 * @property {Phaser.GameObjects.Text} [quantity]
 */

/**
 * @typedef {import('../types/typedef.js').InventoryItem & { gameObjects: InventoryItemGameObjects }} InventoryItemWithGameObjects
 */

/**
 * @typedef CustomInventory
 * @type {InventoryItemWithGameObjects[]}
 */

export class InventoryScene extends BaseScene {
  /** @type {Phaser.GameObjects.Image} */
  #userInputCursor;
  /** @type {Phaser.GameObjects.Text} */
  #selectedInventoryDescriptionText;
  /** @type {CustomInventory} */
  #inventory;
  /** @type {number} */
  #selectedInventoryOptionIndex;
  /** @type {InventorySceneData} */
  #sceneData;
  /** @type {NineSlice} */
  #nineSliceMainContainer;

  constructor() {
    super({ key: SCENE_KEYS.INVENTORY_SCENE });
  }

  /**
   * @param {InventorySceneData} data
   * @returns {void}
   */
  init(data) {
    super.init(data);

    this.#sceneData = data;
    this.#selectedInventoryOptionIndex = 0;
    const inventory = dataManager.getInventory(this);
    this.#inventory = inventory.map((inventoryItem) => {
      return {
        item: inventoryItem.item,
        quantity: inventoryItem.quantity,
        gameObjects: {},
      };
    });
    this.#nineSliceMainContainer = new NineSlice({
      cornerCutSize: 32,
      textureManager: this.sys.textures,
      assetKeys: [UI_ASSET_KEYS.MENU_BACKGROUND],
    });
  }

  /**
   * @returns {void}
   */
  create() {
    super.create();

    this.add.image(0, 0, INVENTORY_ASSET_KEYS.INVENTORY_BACKGROUND).setOrigin(0);
    this.add.image(40, 120, INVENTORY_ASSET_KEYS.INVENTORY_BAG).setOrigin(0).setScale(0.5);

    const container = this.#nineSliceMainContainer
      .createNineSliceContainer(this, 700, 360, UI_ASSET_KEYS.MENU_BACKGROUND)
      .setPosition(300, 20);
    const containerBackground = this.add.rectangle(4, 4, 692, 352, 0xffff88).setOrigin(0).setAlpha(0.6);
    container.add(containerBackground);

    const titleContainer = this.#nineSliceMainContainer
      .createNineSliceContainer(this, 240, 64, UI_ASSET_KEYS.MENU_BACKGROUND)
      .setPosition(64, 20);
    const titleContainerBackground = this.add.rectangle(4, 4, 232, 56, 0xffff88).setOrigin(0).setAlpha(0.6);
    titleContainer.add(titleContainerBackground);

    const textTitle = this.add.text(116, 28, 'Items', INVENTORY_TEXT_STYLE).setOrigin(0.5);
    titleContainer.add(textTitle);

    // create inventory text from available items
    this.#inventory.forEach((inventoryItem, index) => {
      const itemText = this.add.text(
        INVENTORY_ITEM_POSITION.x,
        INVENTORY_ITEM_POSITION.y + index * INVENTORY_ITEM_POSITION.space,
        inventoryItem.item.name,
        INVENTORY_TEXT_STYLE
      );
      const qtyText1 = this.add.text(620, INVENTORY_ITEM_POSITION.y + 2 + index * INVENTORY_ITEM_POSITION.space, 'x', {
        color: '#000000',
        fontSize: '30px',
      });
      const qtyText2 = this.add.text(
        650,
        INVENTORY_ITEM_POSITION.y + index * INVENTORY_ITEM_POSITION.space,
        `${inventoryItem.quantity}`,
        INVENTORY_TEXT_STYLE
      );
      container.add([itemText, qtyText1, qtyText2]);
      inventoryItem.gameObjects = {
        itemName: itemText,
        quantity: qtyText2,
        quantitySign: qtyText1,
      };
    });

    // create cancel text
    const cancelText = this.add.text(
      INVENTORY_ITEM_POSITION.x,
      INVENTORY_ITEM_POSITION.y + INVENTORY_ITEM_POSITION.space * this.#inventory.length,
      'Cancel',
      INVENTORY_TEXT_STYLE
    );
    container.add(cancelText);

    // create player input cursor
    this.#userInputCursor = this.add.image(30, 30, UI_ASSET_KEYS.CURSOR).setScale(3);
    container.add(this.#userInputCursor);

    // create inventory description text
    this.#selectedInventoryDescriptionText = this.add.text(25, 420, '', {
      ...INVENTORY_TEXT_STYLE,
      ...{ wordWrap: { width: this.scale.width - 18 }, color: '#ffffff' },
    });
    this.#updateItemDescriptionText();

    this.events.on(Phaser.Scenes.Events.RESUME, this.#handleSceneResume, this);
  }

  /**
   * @returns {void}
   */
  cleanup() {
    super.cleanup();
    this.events.off(Phaser.Scenes.Events.RESUME, this.#handleSceneResume, this);
  }

  /**
   * @returns {void}
   */
  update() {
    super.update();

    if (this._controls.isInputLocked) {
      return;
    }

    if (this._controls.wasBackKeyPressed()) {
      this.#goBackToPreviousScene();
      return;
    }

    const spaceKeyPressed = this._controls.wasSpaceKeyPressed();
    if (spaceKeyPressed && this.#isCancelButtonSelected()) {
      this.#goBackToPreviousScene();
      return;
    }

    if (spaceKeyPressed) {
      this._controls.lockInput = true;
      // pause this scene and launch the monster party scene
      /** @type {import('./monster-party-scene.js').MonsterPartySceneData} */
      const sceneDataToPass = {
        previousSceneName: SCENE_KEYS.INVENTORY_SCENE,
      };
      this.scene.launch(SCENE_KEYS.MONSTER_PARTY_SCENE, sceneDataToPass);
      this.scene.pause(SCENE_KEYS.INVENTORY_SCENE);

      // in a future update
      // TODO: add submenu for accept/cancel after picking an item
      return;
    }

    const selectedDirection = this._controls.getDirectionKeyJustPressed();
    if (selectedDirection !== DIRECTION.NONE) {
      this.#movePlayerInputCursor(selectedDirection);
      this.#updateItemDescriptionText();
    }
  }

  /**
   * @returns {void}
   */
  #updateItemDescriptionText() {
    if (this.#isCancelButtonSelected()) {
      this.#selectedInventoryDescriptionText.setText(CANCEL_TEXT_DESCRIPTION);
      return;
    }

    this.#selectedInventoryDescriptionText.setText(
      this.#inventory[this.#selectedInventoryOptionIndex].item.description
    );
  }

  /**
   * @returns {boolean}
   */
  #isCancelButtonSelected() {
    return this.#selectedInventoryOptionIndex === this.#inventory.length;
  }

  /**
   * @param {import('../common/direction.js').Direction} direction
   * @returns {void}
   */
  #movePlayerInputCursor(direction) {
    switch (direction) {
      case DIRECTION.UP:
        this.#selectedInventoryOptionIndex -= 1;
        if (this.#selectedInventoryOptionIndex < 0) {
          this.#selectedInventoryOptionIndex = this.#inventory.length;
        }
        break;
      case DIRECTION.DOWN:
        this.#selectedInventoryOptionIndex += 1;
        if (this.#selectedInventoryOptionIndex > this.#inventory.length) {
          this.#selectedInventoryOptionIndex = 0;
        }
        break;
      case DIRECTION.LEFT:
      case DIRECTION.RIGHT:
        return;
      case DIRECTION.NONE:
        break;
      default:
        exhaustiveGuard(direction);
    }
    const y = 30 + this.#selectedInventoryOptionIndex * 50;

    this.#userInputCursor.setY(y);
  }

  /**
   * @returns {void}
   */
  #goBackToPreviousScene() {
    this._controls.lockInput = true;
    this.scene.stop(SCENE_KEYS.INVENTORY_SCENE);
    this.scene.resume(this.#sceneData.previousSceneName);
  }

  /**
   * @param {Phaser.Scenes.Systems} sys
   * @param {object} data
   * @returns {void}
   */
  #handleSceneResume(sys, data) {
    console.log(
      `[${InventoryScene.name}:handleSceneResume] scene has been resumed, data provided: ${JSON.stringify(data)}`
    );
    this._controls.lockInput = false;
  }
}
