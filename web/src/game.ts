import Phaser from "phaser";

// ─── Virtual resolution ────────────────────────────────────────────────────
const VW = 480;
const VH = 640;

// ─── Colours ───────────────────────────────────────────────────────────────
const COL_BG       = 0x0a0a1a;
const COL_PLAYER   = 0x00ffcc;
const COL_GLOW     = 0x00ffcc;
const COL_OBSTACLE = 0xff2060;
const COL_GRID     = 0x1a1a3a;
const COL_PARTICLE = [0x00ffcc, 0x00ccff, 0xcc00ff, 0xffcc00];

// ─── Game constants ────────────────────────────────────────────────────────
const PLAYER_X     = 80;
const PLAYER_SIZE  = 24;
const BAR_WIDTH    = 18;
const GAP_MIN      = 140;
const GAP_MAX      = 200;
const SPEED_START  = 220;
const SPEED_INC    = 18;   // per second of survival
const SPAWN_START  = 1600; // ms between bars
const SPAWN_MIN    = 600;
const LS_KEY       = "neonrunner_highscore";

// ─── Types ─────────────────────────────────────────────────────────────────
interface Bar {
  top: Phaser.GameObjects.Rectangle;
  bot: Phaser.GameObjects.Rectangle;
  topBody: Phaser.Physics.Arcade.Body;
  botBody: Phaser.Physics.Arcade.Body;
  scored: boolean;
}

interface Particle {
  obj: Phaser.GameObjects.Rectangle;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

// ══════════════════════════════════════════════════════════════════════════
// MENU SCENE
// ══════════════════════════════════════════════════════════════════════════
class MenuScene extends Phaser.Scene {
  constructor() { super("menu"); }

  create(): void {
    // Background
    this.add.rectangle(VW / 2, VH / 2, VW, VH, COL_BG);
    this.drawGrid();

    // Title glow layers
    this.add.text(VW / 2, VH / 2 - 130, "NEON", {
      fontFamily: "Fraunces, serif",
      fontSize: "80px",
      color: "#00ffcc",
      stroke: "#00ffcc",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 0, color: "#00ffcc", blur: 30, fill: true },
    }).setOrigin(0.5);

    this.add.text(VW / 2, VH / 2 - 50, "RUNNER", {
      fontFamily: "Fraunces, serif",
      fontSize: "56px",
      color: "#ff2060",
      stroke: "#ff2060",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 0, color: "#ff2060", blur: 30, fill: true },
    }).setOrigin(0.5);

    // Animated demo player square
    const demo = this.add.rectangle(VW / 2, VH / 2 + 60, PLAYER_SIZE, PLAYER_SIZE, COL_PLAYER);
    this.tweens.add({
      targets: demo,
      y: VH / 2 + 100,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Instructions
    this.add.text(VW / 2, VH / 2 + 160, "Move UP / DOWN to dodge bars", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "16px",
      color: "#8888bb",
    }).setOrigin(0.5);

    this.add.text(VW / 2, VH / 2 + 190, "Arrow Keys  ·  Mouse  ·  Touch", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "14px",
      color: "#555588",
    }).setOrigin(0.5);

    // High score
    const hs = localStorage.getItem(LS_KEY) ? parseInt(localStorage.getItem(LS_KEY)!, 10) : 0;
    if (hs > 0) {
      this.add.text(VW / 2, VH / 2 + 230, `Best: ${hs}s`, {
        fontFamily: "Manrope, sans-serif",
        fontSize: "18px",
        color: "#ffcc00",
        shadow: { offsetX: 0, offsetY: 0, color: "#ffcc00", blur: 12, fill: true },
      }).setOrigin(0.5);
    }

    // Pulsing start prompt
    const startTxt = this.add.text(VW / 2, VH - 90, "TAP TO START", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "22px",
      color: "#ffffff",
      stroke: "#00ffcc",
      strokeThickness: 1,
    }).setOrigin(0.5);
    this.tweens.add({ targets: startTxt, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });

    // Start on any input
    this.input.once("pointerdown", () => this.scene.start("play"));
    this.input.keyboard?.once("keydown", () => this.scene.start("play"));
  }

  private drawGrid(): void {
    const g = this.add.graphics();
    g.lineStyle(1, COL_GRID, 0.5);
    for (let x = 0; x <= VW; x += 40) { g.moveTo(x, 0); g.lineTo(x, VH); }
    for (let y = 0; y <= VH; y += 40) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.strokePath();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PLAY SCENE
// ══════════════════════════════════════════════════════════════════════════
class PlayScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;

  private player!: Phaser.GameObjects.Rectangle;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private bars: Bar[] = [];
  private particles: Particle[] = [];

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private targetY = VH / 2;
  private elapsed = 0;        // seconds survived
  private score = 0;          // integer seconds shown
  private speed = SPEED_START;
  private spawnDelay = SPAWN_START;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private over = false;
  private scoreText!: Phaser.GameObjects.Text;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private barGroup!: Phaser.Physics.Arcade.Group;

  constructor(onScore: (n: number) => void) {
    super("play");
    this.onScore = onScore;
  }

  create(): void {
    this.elapsed = 0;
    this.score = 0;
    this.speed = SPEED_START;
    this.spawnDelay = SPAWN_START;
    this.over = false;
    this.bars = [];
    this.particles = [];
    this.onScore(0);

    // Background
    this.add.rectangle(VW / 2, VH / 2, VW, VH, COL_BG);

    // Scrolling grid
    this.gridGraphics = this.add.graphics();
    this.drawScrollGrid(0);

    // Physics group for bar pieces
    this.barGroup = this.physics.add.group();

    // Player
    this.targetY = VH / 2;
    this.player = this.add.rectangle(PLAYER_X, VH / 2, PLAYER_SIZE, PLAYER_SIZE, COL_PLAYER);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setAllowGravity(false);
    this.playerBody.setImmovable(true);

    // Keyboard
    this.cursors = this.input.keyboard?.createCursorKeys();

    // Pointer / touch: follow Y
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.targetY = Phaser.Math.Clamp(p.y, PLAYER_SIZE / 2, VH - PLAYER_SIZE / 2);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.targetY = Phaser.Math.Clamp(p.y, PLAYER_SIZE / 2, VH - PLAYER_SIZE / 2);
    });

    // HUD
    this.scoreText = this.add.text(VW / 2, 20, "0s", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "22px",
      color: "#00ffcc",
      shadow: { offsetX: 0, offsetY: 0, color: "#00ffcc", blur: 10, fill: true },
    }).setOrigin(0.5, 0).setDepth(10);

    // Collision
    this.physics.add.overlap(this.player, this.barGroup, () => {
      if (!this.over) this.endGame();
    });

    // Spawn first bar quickly, then on timer
    this.time.delayedCall(400, () => this.spawnBar());
    this.scheduleSpawn();
  }

  private scheduleSpawn(): void {
    this.spawnTimer?.remove();
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: () => {
        if (this.over) return;
        this.spawnBar();
        // Gradually tighten spawn interval
        this.spawnDelay = Math.max(SPAWN_MIN, this.spawnDelay - 20);
        this.scheduleSpawn();
      },
    });
  }

  private spawnBar(): void {
    const gapH = Phaser.Math.Between(GAP_MIN, GAP_MAX);
    const gapY = Phaser.Math.Between(gapH / 2 + 10, VH - gapH / 2 - 10);

    const topH = gapY - gapH / 2;
    const botH = VH - (gapY + gapH / 2);

    const topRect = this.add.rectangle(VW + BAR_WIDTH / 2, topH / 2, BAR_WIDTH, topH, COL_OBSTACLE);
    const botRect = this.add.rectangle(VW + BAR_WIDTH / 2, VH - botH / 2, BAR_WIDTH, botH, COL_OBSTACLE);

    // Glow tint — add a slightly wider, dimmer rectangle behind each bar
    const topGlow = this.add.rectangle(VW + BAR_WIDTH / 2, topH / 2, BAR_WIDTH + 6, topH, COL_OBSTACLE, 0.25);
    const botGlow = this.add.rectangle(VW + BAR_WIDTH / 2, VH - botH / 2, BAR_WIDTH + 6, botH, COL_OBSTACLE, 0.25);
    topGlow.setDepth(1);
    botGlow.setDepth(1);
    topRect.setDepth(2);
    botRect.setDepth(2);

    this.physics.add.existing(topRect);
    this.physics.add.existing(botRect);

    const tb = topRect.body as Phaser.Physics.Arcade.Body;
    const bb = botRect.body as Phaser.Physics.Arcade.Body;
    tb.setAllowGravity(false);
    bb.setAllowGravity(false);
    tb.setImmovable(true);
    bb.setImmovable(true);
    tb.setVelocityX(-this.speed);
    bb.setVelocityX(-this.speed);

    this.barGroup.add(topRect);
    this.barGroup.add(botRect);

    this.bars.push({ top: topRect, bot: botRect, topBody: tb, botBody: bb, scored: false });

    // Keep glow rects in sync manually (no physics needed)
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!topRect.active) return;
        topGlow.x = topRect.x;
        botGlow.x = botRect.x;
      },
    });
  }

  update(time: number, delta: number): void {
    if (this.over) return;

    const dt = delta / 1000;
    this.elapsed += dt;

    // Score = whole seconds survived
    const newScore = Math.floor(this.elapsed);
    if (newScore !== this.score) {
      this.score = newScore;
      this.onScore(this.score);
      this.scoreText.setText(`${this.score}s`);
    }

    // Ramp speed
    this.speed = SPEED_START + SPEED_INC * this.elapsed;

    // Sync bar velocities to current speed
    for (const bar of this.bars) {
      if (bar.top.active) {
        bar.topBody.setVelocityX(-this.speed);
        bar.botBody.setVelocityX(-this.speed);
      }
    }

    // Scrolling grid
    this.drawScrollGrid(this.elapsed);

    // ── Player movement ────────────────────────────────────────────────
    const KB_SPEED = 320;
    if (this.cursors?.up.isDown) {
      this.targetY = Math.max(PLAYER_SIZE / 2, this.targetY - KB_SPEED * dt);
    }
    if (this.cursors?.down.isDown) {
      this.targetY = Math.min(VH - PLAYER_SIZE / 2, this.targetY + KB_SPEED * dt);
    }

    // Smooth lerp toward target
    this.player.y = Phaser.Math.Linear(this.player.y, this.targetY, 0.18);
    this.playerBody.reset(PLAYER_X, this.player.y);

    // ── Particle trail ────────────────────────────────────────────────
    this.spawnTrailParticle();
    this.updateParticles(dt);

    // ── Clean up off-screen bars ──────────────────────────────────────
    this.bars = this.bars.filter((bar) => {
      if (bar.top.x < -BAR_WIDTH * 2) {
        bar.top.destroy();
        bar.bot.destroy();
        return false;
      }
      return true;
    });
  }

  private spawnTrailParticle(): void {
    if (Math.random() > 0.6) return; // ~60% chance per frame
    const color = COL_PARTICLE[Math.floor(Math.random() * COL_PARTICLE.length)]!;
    const size = Phaser.Math.Between(3, 8);
    const px = this.player.x - PLAYER_SIZE / 2 + Phaser.Math.Between(-4, 4);
    const py = this.player.y + Phaser.Math.Between(-PLAYER_SIZE / 2, PLAYER_SIZE / 2);
    const rect = this.add.rectangle(px, py, size, size, color, 0.85);
    rect.setDepth(3);
    this.particles.push({
      obj: rect,
      life: 0,
      maxLife: Phaser.Math.Between(18, 35) / 60,
      vx: Phaser.Math.Between(-60, -20),
      vy: Phaser.Math.Between(-30, 30),
    });
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        p.obj.destroy();
        return false;
      }
      p.obj.x += p.vx * dt;
      p.obj.y += p.vy * dt;
      p.obj.alpha = 0.85 * (1 - t);
      const s = (1 - t) * p.obj.width;
      p.obj.setSize(s, s);
      return true;
    });
  }

  private drawScrollGrid(t: number): void {
    const g = this.gridGraphics;
    g.clear();
    g.lineStyle(1, COL_GRID, 0.4);
    const spacing = 40;
    const offset = (t * this.speed * 0.15) % spacing;
    for (let x = -offset; x <= VW; x += spacing) { g.moveTo(x, 0); g.lineTo(x, VH); }
    for (let y = 0; y <= VH; y += spacing) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.strokePath();
  }

  private endGame(): void {
    this.over = true;
    this.spawnTimer?.remove();
    this.playerBody.setVelocity(0, 0);

    // Flash player red
    this.player.setFillStyle(0xff2060);
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      duration: 400,
      ease: "Power2",
    });

    // Save high score
    const prev = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10) || 0;
    const isNew = this.score > prev;
    if (isNew) localStorage.setItem(LS_KEY, String(this.score));
    const best = Math.max(this.score, prev);

    // Overlay
    this.time.delayedCall(350, () => this.showGameOver(best, isNew));
  }

  private showGameOver(best: number, isNew: boolean): void {
    // Dim overlay
    const overlay = this.add.rectangle(VW / 2, VH / 2, VW, VH, 0x000000, 0.7).setDepth(20);
    overlay; // used

    const cx = VW / 2;
    const cy = VH / 2;

    this.add.text(cx, cy - 120, "GAME OVER", {
      fontFamily: "Fraunces, serif",
      fontSize: "52px",
      color: "#ff2060",
      stroke: "#ff2060",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 0, color: "#ff2060", blur: 30, fill: true },
    }).setOrigin(0.5).setDepth(21);

    this.add.text(cx, cy - 40, `Time: ${this.score}s`, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "30px",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(21);

    const bestColor = isNew ? "#ffcc00" : "#8888bb";
    const bestLabel = isNew ? `★ New Best: ${best}s` : `Best: ${best}s`;
    this.add.text(cx, cy + 10, bestLabel, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "20px",
      color: bestColor,
      shadow: { offsetX: 0, offsetY: 0, color: bestColor, blur: 12, fill: true },
    }).setOrigin(0.5).setDepth(21);

    // Restart button
    const btnBg = this.add.rectangle(cx, cy + 80, 180, 50, 0x00ffcc, 1).setDepth(21);
    const btnTxt = this.add.text(cx, cy + 80, "PLAY AGAIN", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "18px",
      color: "#0a0a1a",
    }).setOrigin(0.5).setDepth(22);

    btnBg.setInteractive({ useHandCursor: true });
    btnTxt.setInteractive({ useHandCursor: true });

    const restart = (): void => this.scene.start("play");
    btnBg.on("pointerdown", restart);
    btnTxt.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-SPACE", restart);
    this.input.keyboard?.once("keydown-ENTER", restart);

    // Pulse the button
    this.tweens.add({ targets: [btnBg, btnTxt], scaleX: 1.06, scaleY: 1.06, duration: 600, yoyo: true, repeat: -1 });

    // Menu link
    const menuTxt = this.add.text(cx, cy + 150, "← Main Menu", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "15px",
      color: "#555588",
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
    menuTxt.on("pointerdown", () => this.scene.start("menu"));
    menuTxt.on("pointerover", () => menuTxt.setColor("#8888bb"));
    menuTxt.on("pointerout", () => menuTxt.setColor("#555588"));
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ══════════════════════════════════════════════════════════════════════════
export function startGame(parent: HTMLElement, onScore: (n: number) => void): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VW,
    height: VH,
    backgroundColor: "#0a0a1a",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [MenuScene, new PlayScene(onScore)],
    banner: false,
  });

  return () => game.destroy(true);
}
