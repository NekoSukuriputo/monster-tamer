import { MONSTER_ASSET_KEYS } from '../../assets/asset-keys.js';
import Phaser from '../../lib/phaser.js';

const BATTLE_MENU_OPTIONS = Object.freeze({
  FIGHT: 'FIGHT',
  SWITCH: 'SWITCH',
  ITEM: 'ITEM',
  FLEE: 'FLEE',
});

/**
 * @type {Phaser.Types.GameObjects.Text.TextStyle}
 */
const battleUiTextStyle = {
  color: 'black',
  fontSize: '30px',
};

export class BattleMenu {
  /** @type {Phaser.Scene} */
  #scene;
  /** @type {Phaser.GameObjects.Container} */
  #mainBattleMenuPhaserContainerGameObject;
  /** @type {Phaser.GameObjects.Container} */
  #moveSelectionSubBattleMenuPhaserContainerGameObject;
  /** @type {Phaser.GameObjects.Text} */
  #battleTextGameObjectLine1;
  /** @type {Phaser.GameObjects.Text} */
  #battleTextGameObjectLine2;

  /**
   * @param {Phaser.Scene} scene the Phaser 3 Scene the battle menu will be added to
   */
  constructor(scene) {
    this.#scene = scene;
    this.#createMainInfoPane();
    this.#createMainBattleMenu();
    this.#createMonsterAttackSubMenu();
  }

  showMainBattleMenu() {
    this.#battleTextGameObjectLine1.setText('what should');
    this.#mainBattleMenuPhaserContainerGameObject.setAlpha(1);
    this.#battleTextGameObjectLine1.setAlpha(1);
    this.#battleTextGameObjectLine2.setAlpha(1);
  }

  hideMainBattleMenu() {
    this.#mainBattleMenuPhaserContainerGameObject.setAlpha(0);
    this.#battleTextGameObjectLine1.setAlpha(0);
    this.#battleTextGameObjectLine2.setAlpha(0);
  }

  showMonsterAttackSubMenu() {
    this.#moveSelectionSubBattleMenuPhaserContainerGameObject.setAlpha(1);
  }

  hideMonsterAttackSubMenu() {
    this.#moveSelectionSubBattleMenuPhaserContainerGameObject.setAlpha(0);
  }

  /**
   *
   * @param {import('../../common/direction.js').Direction | 'OK' | 'CANCEL'} input
   */
  handlePlayerInput(input) {
    console.log(input);
    if (input === 'CANCEL') {
      this.hideMonsterAttackSubMenu();
      this.showMainBattleMenu();
      return;
    }
    if (input === 'OK') {
      this.hideMainBattleMenu();
      this.showMonsterAttackSubMenu();
    }
  }

  #createMainBattleMenu() {
    this.#battleTextGameObjectLine1 = this.#scene.add.text(20, 468, 'what should', battleUiTextStyle);
    // TODO: update to use monster data that is passed into this class instance
    this.#battleTextGameObjectLine2 = this.#scene.add.text(
      20,
      512,
      `${MONSTER_ASSET_KEYS.IGUANIGNITE} do next?`,
      battleUiTextStyle
    );
    this.#battleTextGameObjectLine1.setAlpha(0);
    this.#battleTextGameObjectLine2.setAlpha(0);

    this.#mainBattleMenuPhaserContainerGameObject = this.#scene.add.container(520, 448, [
      this.#createMainInfoSubPane(),
      this.#scene.add.text(55, 22, BATTLE_MENU_OPTIONS.FIGHT, battleUiTextStyle),
      this.#scene.add.text(240, 22, BATTLE_MENU_OPTIONS.SWITCH, battleUiTextStyle),
      this.#scene.add.text(55, 70, BATTLE_MENU_OPTIONS.ITEM, battleUiTextStyle),
      this.#scene.add.text(240, 70, BATTLE_MENU_OPTIONS.FLEE, battleUiTextStyle),
    ]);

    this.#mainBattleMenuPhaserContainerGameObject.setAlpha(0);
  }

  #createMonsterAttackSubMenu() {
    this.#moveSelectionSubBattleMenuPhaserContainerGameObject = this.#scene.add.container(0, 448, [
      this.#scene.add.text(55, 22, 'slash', battleUiTextStyle),
      this.#scene.add.text(240, 22, 'growl', battleUiTextStyle),
      this.#scene.add.text(55, 70, '-', battleUiTextStyle),
      this.#scene.add.text(240, 70, '-', battleUiTextStyle),
    ]);
    this.#moveSelectionSubBattleMenuPhaserContainerGameObject.setAlpha(0);
  }

  #createMainInfoPane() {
    const padding = 4;
    const rectHeight = 124;

    return this.#scene.add
      .rectangle(
        padding,
        this.#scene.scale.height - rectHeight - padding,
        this.#scene.scale.width - padding * 2,
        rectHeight,
        0xede4f3,
        1
      )
      .setOrigin(0)
      .setStrokeStyle(8, 0xe4434a, 1);
  }

  #createMainInfoSubPane() {
    const rectWidth = 500;
    const rectHeight = 124;

    return this.#scene.add
      .rectangle(0, 0, rectWidth, rectHeight, 0xede4f3, 1)
      .setOrigin(0)
      .setStrokeStyle(8, 0x905ac2, 1);
  }
}
