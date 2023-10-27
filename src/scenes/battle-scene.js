import Phaser from '../lib/phaser.js';
import { BATTLE_BACKGROUND_ASSET_KEYS, MONSTER_ASSET_KEYS } from '../assets/asset-keys.js';
import { BattleMenu } from '../battle/ui/menu/battle-menu.js';
import { SCENE_KEYS } from './scene-keys.js';
import { DIRECTION } from '../common/direction.js';
import { EnemyBattleMonster } from '../battle/monsters/enemy-battle-monster.js';
import { PlayerBattleMonster } from '../battle/monsters/player-battle-monster.js';

export class BattleScene extends Phaser.Scene {
  /** @type {BattleMenu} */
  #battleMenu;
  /** @type {Phaser.Types.Input.Keyboard.CursorKeys} */
  #cursorKeys;
  /** @type {EnemyBattleMonster} */
  #activeEnemyMonster;
  /** @type {PlayerBattleMonster} */
  #activePlayerMonster;
  /** @type {number} */
  #activePlayerAttackIndex;

  constructor() {
    super({
      key: SCENE_KEYS.BATTLE_SCENE,
    });
  }

  init() {
    this.#activePlayerAttackIndex = -1;
  }

  create() {
    console.log(`[${BattleScene.name}:create] invoked`);
    // create main background
    this.add.image(0, 0, BATTLE_BACKGROUND_ASSET_KEYS.FOREST).setOrigin(0);

    // create the player and enemy monsters
    this.#activeEnemyMonster = new EnemyBattleMonster({
      scene: this,
      monsterDetails: {
        name: MONSTER_ASSET_KEYS.CARNODUSK,
        assetKey: MONSTER_ASSET_KEYS.CARNODUSK,
        assetFrame: 0,
        currentHp: 25,
        maxHp: 25,
        attackIds: [1],
        baseAttack: 5,
        currentLevel: 5,
      },
    });
    this.#activePlayerMonster = new PlayerBattleMonster({
      scene: this,
      monsterDetails: {
        name: MONSTER_ASSET_KEYS.IGUANIGNITE,
        assetKey: MONSTER_ASSET_KEYS.IGUANIGNITE,
        assetFrame: 0,
        currentHp: 25,
        maxHp: 25,
        attackIds: [2],
        baseAttack: 5,
        currentLevel: 5,
      },
    });

    // render out the main info and sub info panes
    this.#battleMenu = new BattleMenu(this, this.#activePlayerMonster);
    this.#battleMenu.showMainBattleMenu();

    this.#cursorKeys = this.input.keyboard.createCursorKeys();
  }

  update() {
    const wasSpaceKeyPressed = Phaser.Input.Keyboard.JustDown(this.#cursorKeys.space);
    if (wasSpaceKeyPressed) {
      this.#battleMenu.handlePlayerInput('OK');

      //check if the player selected an attack, and start battle sequence for the fight
      if (this.#battleMenu.selectedAttack === undefined) {
        return;
      }
      this.#activePlayerAttackIndex = this.#battleMenu.selectedAttack;

      if (!this.#activePlayerMonster.attacks[this.#activePlayerAttackIndex]) {
        return;
      }

      console.log(
        `Player selected the following move: ${this.#activePlayerMonster.attacks[this.#activePlayerAttackIndex].name}`
      );
      this.#battleMenu.hideMonsterAttackSubMenu();
      this.#handleBattleSequence();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.#cursorKeys.shift)) {
      this.#battleMenu.handlePlayerInput('CANCEL');
      return;
    }

    /** @type {import('../common/direction.js').Direction} */
    let selectedDirection = DIRECTION.NONE;
    if (this.#cursorKeys.left.isDown) {
      selectedDirection = DIRECTION.LEFT;
    } else if (this.#cursorKeys.right.isDown) {
      selectedDirection = DIRECTION.RIGHT;
    } else if (this.#cursorKeys.up.isDown) {
      selectedDirection = DIRECTION.UP;
    } else if (this.#cursorKeys.down.isDown) {
      selectedDirection = DIRECTION.DOWN;
    }

    if (selectedDirection !== DIRECTION.NONE) {
      this.#battleMenu.handlePlayerInput(selectedDirection);
    }
  }

  #handleBattleSequence() {
    // general battle flow
    // show attack used, brief pause
    // then play attack animation, brief pause
    // then play damage animation, brief pause
    // then play health bar animation, brief pause
    // then repeat the steps above for the other monster

    this.#playerAttack();
  }

  #playerAttack() {
    this.#battleMenu.updateInfoPaneMessagesAndWaitForInput(
      [
        `${this.#activePlayerMonster.name} used ${
          this.#activePlayerMonster.attacks[this.#activePlayerAttackIndex].name
        }`,
      ],
      () => {
        this.time.delayedCall(500, () => {
          this.#activeEnemyMonster.takeDamage(this.#activePlayerMonster.baseAttack, () => {
            this.#enemyAttack();
          });
        });
      }
    );
  }

  #enemyAttack() {
    this.#battleMenu.updateInfoPaneMessagesAndWaitForInput(
      [`foe ${this.#activeEnemyMonster.name} used ${this.#activeEnemyMonster.attacks[0].name}`],
      () => {
        this.time.delayedCall(500, () => {
          this.#activePlayerMonster.takeDamage(this.#activeEnemyMonster.baseAttack, () => {
            this.#postBattleSequenceCheck();
          });
        });
      }
    );
  }

  #postBattleSequenceCheck() {
    if (this.#activeEnemyMonster.isFainted) {
      this.#battleMenu.updateInfoPaneMessagesAndWaitForInput(
        [`Wild ${this.#activeEnemyMonster.name} fainted`, 'You have gained some experience'],
        () => {
          this.#transitionToNextScene();
        }
      );
      return;
    }

    if (this.#activePlayerMonster.isFainted) {
      this.#battleMenu.updateInfoPaneMessagesAndWaitForInput(
        [`${this.#activePlayerMonster.name} fainted.`, 'You have no more monsters, escaping to safety...'],
        () => {
          this.#transitionToNextScene();
        }
      );
      return;
    }

    this.#battleMenu.showMainBattleMenu();
  }

  #transitionToNextScene() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.BATTLE_SCENE);
    });
  }
}
