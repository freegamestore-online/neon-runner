import Phaser from "phaser";

// A complete, playable game built on Phaser 4 — the most widely-used browser game
// engine. Phaser gives you a scene lifecycle (preload/create/update), arcade
// physics, groups, input and a scaler for free, so you write game logic, not a
// render loop. Replace the body of PlayScene to build your own game; keep
// `startGame`'s signature so App.tsx can mount it.
//
// Catch: move the basket to catch falling fruit. Miss three and it's game over.

const VW = 400; // virtual width  (Phaser's Scale.FIT letterboxes this to the canvas)
const VH = 600; // virtual height

const FRUIT_COLORS = [0xef4444, 0xfacc15, 0x3b82f6, 0xf472b6];

class PlayScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;
  private score = 0;
  private lives = 3;
  private over = false;
  private basket!: Phaser.GameObjects.Rectangle;
  private fruit!: Phaser.Physics.Arcade.Group;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor(onScore: (n: number) => void) {
    super("play");
    this.onScore = onScore;
  }

  create(): void {
    this.score = 0;
    this.lives = 3;
    this.over = false;
    this.onScore(0);

    // The basket: a rectangle with an immovable arcade body that follows the pointer.
    this.basket = this.add.rectangle(VW / 2, VH - 48, 72, 20, 0x10b981); // brand emerald
    this.physics.add.existing(this.basket);
    const body = this.basket.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);

    // Whole control scheme: move the basket to the pointer (touch or mouse).
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.basket.x = Phaser.Math.Clamp(p.x, 36, VW - 36);
    });
    // Keyboard fallback for desktop.
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.fruit = this.physics.add.group();

    // Catch a fruit → score up, remove it.
    this.physics.add.overlap(this.basket, this.fruit, (_basket, f) => {
      (f as Phaser.GameObjects.Arc).destroy();
      this.score += 1;
      this.onScore(this.score);
    });

    // Spawn a piece of fruit on a repeating timer.
    this.spawnTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => this.spawnFruit(),
    });
  }

  private spawnFruit(): void {
    const x = Phaser.Math.Between(24, VW - 24);
    const radius = Phaser.Math.Between(8, 13);
    const color = Phaser.Utils.Array.GetRandom(FRUIT_COLORS) as number;
    const drop = this.add.circle(x, -20, radius, color);
    this.physics.add.existing(drop);
    const body = drop.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(radius);
    body.setVelocityY(Phaser.Math.Between(120, 220));
    this.fruit.add(drop);
  }

  update(): void {
    if (this.over) return;

    // Keyboard movement.
    if (this.cursors?.left.isDown) this.basket.x = Math.max(36, this.basket.x - 6);
    if (this.cursors?.right.isDown) this.basket.x = Math.min(VW - 36, this.basket.x + 6);

    // A fruit that falls past the bottom costs a life. Iterate a SNAPSHOT:
    // drop.destroy() synchronously removes the child from the group's live array,
    // which would make a plain for-of skip the next element in the same frame.
    for (const obj of [...this.fruit.getChildren()]) {
      const drop = obj as Phaser.GameObjects.Arc;
      if (drop.y > VH + 20) {
        drop.destroy();
        this.lives -= 1;
        if (this.lives <= 0) {
          this.gameOver();
          return;
        }
      }
    }
  }

  private gameOver(): void {
    this.over = true;
    this.spawnTimer?.remove();
    this.fruit.clear(true, true);

    const title = this.add
      .text(0, -30, "Game Over", { fontFamily: "Manrope, sans-serif", fontSize: "40px", color: "#ffffff" })
      .setOrigin(0.5);
    const scoreText = this.add
      .text(0, 16, `Score: ${this.score}`, { fontFamily: "Manrope, sans-serif", fontSize: "24px", color: "#10b981" })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 56, "tap to play again", { fontFamily: "Manrope, sans-serif", fontSize: "16px", color: "#a0a0a0" })
      .setOrigin(0.5);
    this.add.container(VW / 2, VH / 2, [title, scoreText, hint]);

    this.input.once("pointerdown", () => this.scene.restart());
    this.input.keyboard?.once("keydown-SPACE", () => this.scene.restart());
  }
}

export function startGame(parent: HTMLElement, onScore: (n: number) => void): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VW,
    height: VH,
    backgroundColor: "#18181b",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: new PlayScene(onScore),
    // Silence Phaser's console banner in production builds.
    banner: false,
  });

  // Phaser owns the RAF loop; return a teardown so React can unmount cleanly.
  return () => game.destroy(true);
}
