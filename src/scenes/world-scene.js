import Phaser from '../lib/phaser.js';
import { WORLD_ASSET_KEYS } from '../assets/asset-keys.js';
import { SCENE_KEYS } from './scene-keys.js';
import { Player } from '../world/characters/player.js';
import { DIRECTION } from '../common/direction.js';
import { DISABLE_WILD_ENCOUNTERS, TILED_COLLISION_LAYER_ALPHA, TILE_SIZE } from '../config.js';
import { NPC } from '../world/characters/npc.js';
import { DATA_MANAGER_STORE_KEYS, dataManager } from '../utils/data-manager.js';
import { getTargetPositionFromGameObjectPositionAndDirection } from '../utils/grid-utils.js';
import { CANNOT_READ_SIGN_TEXT, SAMPLE_TEXT } from '../utils/text-utils.js';
import { DialogUi } from '../world/dialog-ui.js';
import { Menu } from '../world/menu/menu.js';
import { createBuildingSceneTransition } from '../utils/scene-transition.js';
import { BaseScene } from './base-scene.js';
import { DataUtils } from '../utils/data-utils.js';

/**
 * @typedef WorldSceneData
 * @type {object}
 * @property {string} area
 * @property {boolean} isInterior
 */

/**
 * @typedef TiledObjectProperty
 * @type {object}
 * @property {string} name
 * @property {string} type
 * @property {any} value
 */

const CUSTOM_TILED_TYPES = Object.freeze({
  NPC: 'npc',
  NPC_PATH: 'npc_path',
});

const TILED_NPC_PROPERTY = Object.freeze({
  IS_SPAWN_POINT: 'is_spawn_point',
  MOVEMENT_PATTERN: 'movement_pattern',
  MESSAGES: 'messages',
  FRAME: 'frame',
});

const TILED_SIGN_PROPERTY = Object.freeze({
  MESSAGE: 'message',
});

/*
  Our scene will be 16 x 9 (1024 x 576 pixels)
  each grid size will be 64 x 64 pixels
*/

export class WorldScene extends BaseScene {
  /** @type {Player} */
  #player;
  /** @type {Phaser.Tilemaps.TilemapLayer} */
  #encounterLayer;
  /** @type {boolean} */
  #wildMonsterEncountered;
  /** @type {Phaser.Tilemaps.ObjectLayer} */
  #signLayer;
  /** @type {DialogUi} */
  #dialogUi;
  /** @type {NPC[]} */
  #npcs;
  /** @type {NPC | undefined} */
  #npcPlayerIsInteractingWith;
  /** @type {Menu} */
  #menu;
  /** @type {WorldSceneData} */
  #sceneData;
  /** @type {Phaser.Tilemaps.ObjectLayer} */
  #entranceLayer;

  constructor() {
    super({
      key: SCENE_KEYS.WORLD_SCENE,
    });
  }

  /**
   * @param {WorldSceneData} data
   * @returns {void}
   */
  init(data) {
    super.init(data);

    this.#wildMonsterEncountered = false;
    this.#sceneData = data;

    if (!this.#sceneData || !this.#sceneData.area) {
      /** @type {string} */
      const area = dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION).area;

      this.#sceneData = {
        area,
        isInterior: dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION).isInterior,
      };
    }
    dataManager.store.set(
      DATA_MANAGER_STORE_KEYS.PLAYER_LOCATION,
      /** @type {import('../utils/data-manager.js').PlayerLocation} */ ({
        area: this.#sceneData.area,
        isInterior: this.#sceneData.isInterior,
      })
    );
    this.#npcPlayerIsInteractingWith = undefined;
  }

  /**
   * @returns {void}
   */
  create() {
    super.create();

    // this value comes from the width of the level background image we are using
    // we set the max camera width to the size of our image in order to control what
    // is visible to the player, since the phaser game world is infinite.

    // create map and collision layer
    const map = this.make.tilemap({ key: `${this.#sceneData.area.toUpperCase()}_LEVEL` });
    // The first parameter is the name of the tileset in Tiled and the second parameter is the key
    // of the tileset image used when loading the file in preload.
    const collisionTiles = map.addTilesetImage('collision', WORLD_ASSET_KEYS.WORLD_COLLISION);
    if (!collisionTiles) {
      console.log(`[${WorldScene.name}:create] encountered error while creating collision tiles from tiled`);
      return;
    }
    const collisionLayer = map.createLayer('Collision', collisionTiles, 0, 0);
    if (!collisionLayer) {
      console.log(`[${WorldScene.name}:create] encountered error while creating collision layer using data from tiled`);
      return;
    }
    collisionLayer.setAlpha(TILED_COLLISION_LAYER_ALPHA).setDepth(2);

    // create interactive layer
    const hasSignLayer = map.getObjectLayer('Sign') !== null;
    if (hasSignLayer) {
      this.#signLayer = map.getObjectLayer('Sign');
      if (!this.#signLayer) {
        console.log(`[${WorldScene.name}:create] encountered error while creating sign layer using data from tiled`);
        return;
      }
    }

    // create layer for scene transitions entrances
    this.#entranceLayer = map.getObjectLayer('Scene-Transitions');
    if (!this.#entranceLayer) {
      console.log(
        `[${WorldScene.name}:create] encountered error while creating scene entrances layer using data from tiled`
      );
      return;
    }

    // create collision layer for encounters
    const hasEncounterLayer = map.tilesets.some((tileset) => tileset.name === 'encounter');
    if (hasEncounterLayer) {
      const encounterTiles = map.addTilesetImage('encounter', WORLD_ASSET_KEYS.WORLD_ENCOUNTER_ZONE);
      if (!encounterTiles) {
        console.log(`[${WorldScene.name}:create] encountered error while creating encounter tiles from tiled`);
        return;
      }
      this.#encounterLayer = map.createLayer('Encounter', encounterTiles, 0, 0);
      if (!this.#encounterLayer) {
        console.log(
          `[${WorldScene.name}:create] encountered error while creating encounter layer using data from tiled`
        );
        return;
      }
      this.#encounterLayer.setAlpha(TILED_COLLISION_LAYER_ALPHA).setDepth(2);
    }

    if (!this.#sceneData.isInterior) {
      this.cameras.main.setBounds(0, 0, 1280, 2176);
    }
    this.cameras.main.setZoom(0.8);

    const bgRect = this.add.rectangle(0, 0, 0, 0, 0x000000).setOrigin(0);
    this.add.image(0, 0, `${this.#sceneData.area.toUpperCase()}_BACKGROUND`, 0).setOrigin(0);

    // create npcs
    this.#createNPCs(map);

    // create player and have camera focus on the player
    this.#player = new Player({
      scene: this,
      position: dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION),
      collisionLayer: collisionLayer,
      direction: dataManager.store.get(DATA_MANAGER_STORE_KEYS.PLAYER_DIRECTION),
      spriteGridMovementFinishedCallback: () => {
        this.#handlePlayerMovementUpdate();
      },
      spriteChangedDirectionCallback: () => {
        this.#handlePlayerDirectionUpdate();
      },
      otherCharactersToCheckForCollisionsWith: this.#npcs,
      entranceLayer: this.#entranceLayer,
      enterEntranceCallback: (entranceName, entranceId, isBuildingEntrance) => {
        this.#handleOnEntranceEnteredCallback(entranceName, entranceId, isBuildingEntrance);
      },
    });
    this.cameras.main.startFollow(this.#player.sprite);

    // update our collisions with npcs
    this.#npcs.forEach((npc) => {
      npc.addCharacterToCheckForCollisionsWith(this.#player);
    });
    this.cameras.main.startFollow(this.#player.sprite);

    // create foreground for depth
    this.add.image(0, 0, `${this.#sceneData.area.toUpperCase()}_FOREGROUND`, 0).setOrigin(0);

    // create dialog ui
    this.#dialogUi = new DialogUi(this, 1280);
    // create menu
    this.#menu = new Menu(this);

    let isBgRectUpdated = false;
    this.cameras.main.fadeIn(1000, 0, 0, 0, () => {
      if (!isBgRectUpdated && this.cameras.main.worldView.width !== 0) {
        bgRect.setSize(this.cameras.main.worldView.width, this.cameras.main.worldView.height);
        bgRect.setPosition(this.cameras.main.worldView.x, this.cameras.main.worldView.y);
        isBgRectUpdated = true;
      }
    });
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.GAME_STARTED, true);
  }

  /**
   * @param {DOMHighResTimeStamp} time
   * @returns {void}
   */
  update(time) {
    super.update(time);

    if (this.#wildMonsterEncountered) {
      this.#player.update(time);
      return;
    }

    const wasSpaceKeyPressed = this._controls.wasSpaceKeyPressed();
    const selectedDirectionHeldDown = this._controls.getDirectionKeyPressedDown();
    const selectedDirectionPressedOnce = this._controls.getDirectionKeyJustPressed();
    if (selectedDirectionHeldDown !== DIRECTION.NONE && !this.#isPlayerInputLocked()) {
      this.#player.moveCharacter(selectedDirectionHeldDown);
    }

    if (wasSpaceKeyPressed && !this.#player.isMoving && !this.#menu.isVisible) {
      this.#handlePlayerInteraction();
    }

    if (this._controls.wasEnterKeyPressed() && !this.#player.isMoving) {
      if (this.#dialogUi.isVisible) {
        return;
      }

      if (this.#menu.isVisible) {
        this.#menu.hide();
        return;
      }

      this.#menu.show();
    }

    if (this.#menu.isVisible) {
      if (selectedDirectionPressedOnce !== DIRECTION.NONE) {
        this.#menu.handlePlayerInput(selectedDirectionPressedOnce);
      }
      if (wasSpaceKeyPressed) {
        this.#menu.handlePlayerInput('OK');
        if (this.#menu.selectedMenuOption === 'SAVE') {
          this.#dialogUi.showDialogModal(['Game progress has been saved.']);
        }

        if (this.#menu.selectedMenuOption === 'BAG') {
          // pause this scene and launch the inventory scene
          /** @type {import('./inventory-scene.js').InventorySceneData} */
          const sceneDataToPass = {
            previousSceneName: SCENE_KEYS.WORLD_SCENE,
          };
          this.scene.launch(SCENE_KEYS.INVENTORY_SCENE, sceneDataToPass);
          this.scene.pause(SCENE_KEYS.WORLD_SCENE);
        }

        if (this.#menu.selectedMenuOption === 'MONSTERS') {
          // pause this scene and launch the monster party scene
          /** @type {import('./monster-party-scene.js').MonsterPartySceneData} */
          const sceneDataToPass = {
            previousSceneName: SCENE_KEYS.WORLD_SCENE,
          };
          this.scene.launch(SCENE_KEYS.MONSTER_PARTY_SCENE, sceneDataToPass);
          this.scene.pause(SCENE_KEYS.WORLD_SCENE);
        }
      }

      if (this._controls.wasBackKeyPressed()) {
        this.#menu.handlePlayerInput('CANCEL');
      }
    }

    // TODO: see if this can be cleaned up
    // if (this._controls.wasSpaceKeyPressed() && !this.#player.isMoving) {
    //   this.#handlePlayerInteraction();
    // }

    this.#player.update(time);

    this.#npcs.forEach((npc) => {
      npc.update(time);
    });
  }

  /**
   * @returns {void}
   */
  #handlePlayerInteraction() {
    if (this.#dialogUi.isAnimationPlaying) {
      return;
    }

    if (this.#dialogUi.isVisible && !this.#dialogUi.moreMessagesToShow) {
      this.#dialogUi.hideDialogModal();
      if (this.#npcPlayerIsInteractingWith) {
        this.#npcPlayerIsInteractingWith.isTalkingToPlayer = false;
        this.#npcPlayerIsInteractingWith = undefined;
      }
      return;
    }

    if (this.#dialogUi.isVisible && this.#dialogUi.moreMessagesToShow) {
      this.#dialogUi.showNextMessage();
      return;
    }

    // get players current direction and check 1 tile over in that direction to see if there is an object that can be interacted with
    const { x, y } = this.#player.sprite;
    const targetPosition = getTargetPositionFromGameObjectPositionAndDirection({ x, y }, this.#player.direction);

    // check for sign, and display appropriate message if player is not facing up
    const nearbySign = this.#signLayer?.objects.find((object) => {
      if (!object.x || !object.y) {
        return false;
      }
      return object.x === targetPosition.x && object.y - TILE_SIZE === targetPosition.y;
    });

    if (nearbySign) {
      /** @type {TiledObjectProperty[]} */
      const props = nearbySign.properties;
      /** @type {string} */
      const msg = props.find((prop) => prop.name === TILED_SIGN_PROPERTY.MESSAGE)?.value;

      const usePlaceholderText = this.#player.direction !== DIRECTION.UP;
      let textToShow = CANNOT_READ_SIGN_TEXT;
      if (!usePlaceholderText) {
        textToShow = msg || SAMPLE_TEXT;
      }
      this.#dialogUi.showDialogModal([textToShow]);
      return;
    }

    const nearbyNpc = this.#npcs.find((npc) => {
      return npc.sprite.x === targetPosition.x && npc.sprite.y === targetPosition.y;
    });
    if (nearbyNpc) {
      nearbyNpc.facePlayer(this.#player.direction);
      nearbyNpc.isTalkingToPlayer = true;
      this.#npcPlayerIsInteractingWith = nearbyNpc;
      this.#dialogUi.showDialogModal(nearbyNpc.messages);
      return;
    }
  }

  /**
   * @returns {void}
   */
  #handlePlayerMovementUpdate() {
    // update player position on global data store
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
      x: this.#player.sprite.x,
      y: this.#player.sprite.y,
    });

    if (DISABLE_WILD_ENCOUNTERS) {
      return;
    }
    if (!this.#encounterLayer) {
      return;
    }
    const isInEncounterZone =
      this.#encounterLayer.getTileAtWorldXY(this.#player.sprite.x, this.#player.sprite.y, true).index !== -1;
    if (!isInEncounterZone) {
      return;
    }

    console.log(`[${WorldScene.name}:handlePlayerMovementUpdate] player is in an encounter zone`);
    this.#wildMonsterEncountered = Math.random() < 0.2;
    if (this.#wildMonsterEncountered) {
      console.log(`[${WorldScene.name}:handlePlayerMovementUpdate] player encountered a wild monster`);
      // TODO: add feature in a future update
      // add in a custom animation that is similar to the old games
      this.cameras.main.fadeOut(2000);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // TODO: add logic to determine monster that was encountered
        /** @type {import('./battle-scene.js').BattleSceneData} */
        const dataToPass = {
          enemyMonsters: [DataUtils.getCarnodusk(this)],
          playerMonsters: dataManager.store.get(DATA_MANAGER_STORE_KEYS.MONSTERS_IN_PARTY),
        };

        this.scene.start(SCENE_KEYS.BATTLE_SCENE, dataToPass);
      });
    }
  }

  /**
   * @returns {boolean}
   */
  #isPlayerInputLocked() {
    return this._controls.isInputLocked || this.#dialogUi.isVisible || this.#menu.isVisible;
  }

  /**
   * @param {Phaser.Tilemaps.Tilemap} map
   * @returns {void}
   */
  #createNPCs(map) {
    this.#npcs = [];

    const npcLayers = map.getObjectLayerNames().filter((layerName) => layerName.includes('NPC'));
    npcLayers.forEach((layerName) => {
      const layer = map.getObjectLayer(layerName);
      const npcObject = layer.objects.find((obj) => {
        return obj.type === CUSTOM_TILED_TYPES.NPC;
      });
      if (!npcObject || npcObject.x === undefined || npcObject.y === undefined) {
        return;
      }
      // get the path objects for this npc
      const pathObjects = layer.objects.filter((obj) => {
        return obj.type === CUSTOM_TILED_TYPES.NPC_PATH;
      });
      /** @type {import('../world/characters/npc.js').NPCPath} */
      const npcPath = {
        0: { x: npcObject.x, y: npcObject.y - TILE_SIZE },
      };
      pathObjects.forEach((obj) => {
        if (obj.x === undefined || obj.y === undefined) {
          return;
        }
        npcPath[parseInt(obj.name, 10)] = { x: obj.x, y: obj.y - TILE_SIZE };
      });

      /** @type {string} */
      const npcFrame =
        /** @type {TiledObjectProperty[]} */ (npcObject.properties).find(
          (property) => property.name === TILED_NPC_PROPERTY.FRAME
        )?.value || '0';
      /** @type {string} */
      const npcMessagesString =
        /** @type {TiledObjectProperty[]} */ (npcObject.properties).find(
          (property) => property.name === TILED_NPC_PROPERTY.MESSAGES
        )?.value || '';
      const npcMessages = npcMessagesString.split('::');
      /** @type {import('../world/characters/npc.js').NpcMovementPattern} */
      const npcMovement =
        /** @type {TiledObjectProperty[]} */ (npcObject.properties).find(
          (property) => property.name === TILED_NPC_PROPERTY.MOVEMENT_PATTERN
        )?.value || 'IDLE';

      // In Tiled, the x value is how far the object starts from the left, and the y is the bottom of tiled object that is being added
      const npc = new NPC({
        scene: this,
        position: { x: npcObject.x, y: npcObject.y - TILE_SIZE },
        direction: DIRECTION.DOWN,
        frame: parseInt(npcFrame, 10),
        messages: npcMessages,
        npcPath,
        movementPattern: npcMovement,
      });
      this.#npcs.push(npc);
    });
  }

  /**
   * @returns {void}
   */
  #handlePlayerDirectionUpdate() {
    // update player direction on global data store
    dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_DIRECTION, this.#player.direction);
  }

  /**
   * @param {string} entranceId
   * @param {string} entranceName
   * @param {boolean} isBuildingEntrance
   * @returns {void}
   */
  #handleOnEntranceEnteredCallback(entranceName, entranceId, isBuildingEntrance) {
    this._controls.lockInput = true;

    // update player position to match the new entrance data
    // create tilemap using the provided entrance data
    const map = this.make.tilemap({ key: `${entranceName.toUpperCase()}_LEVEL` });
    // get the position of the entrance object using the entrance id
    const entranceObjectLayer = map.getObjectLayer('Scene-Transitions');

    const entranceObject = entranceObjectLayer.objects.find((object) => {
      const tempEntranceName = object.properties.find((property) => property.name === 'connects_to').value;
      const tempEntranceId = object.properties.find((property) => property.name === 'entrance_id').value;

      return tempEntranceName === this.#sceneData.area && tempEntranceId === entranceId;
    });
    // create position player will be placed at and update based on players facing direction
    let x = entranceObject.x;
    let y = entranceObject.y - TILE_SIZE;
    if (this.#player.direction === DIRECTION.UP) {
      y -= TILE_SIZE;
    }
    if (this.#player.direction === DIRECTION.DOWN) {
      y += TILE_SIZE;
    }

    createBuildingSceneTransition(this, {
      callback: () => {
        dataManager.store.set(DATA_MANAGER_STORE_KEYS.PLAYER_POSITION, {
          x,
          y,
        });

        /** @type {WorldSceneData} */
        const dataToPass = {
          area: entranceName,
          isInterior: isBuildingEntrance,
        };
        this.scene.start(SCENE_KEYS.WORLD_SCENE, dataToPass);
      },
    });
  }
}
