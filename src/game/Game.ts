import { Application, Container, Graphics, type Ticker } from 'pixi.js';
import { Audio } from './audio';

export interface GameCallbacks {
  onScore: (score: number) => void;
  onWave: (wave: number) => void;
  onLives: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

type PowerType = 'rapid' | 'spread' | 'shield';

interface Bullet {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Enemy {
  g: Graphics;
  x: number;
  y: number;
  vy: number;
  r: number;
  hp: number;
  kind: 'grunt' | 'brute';
  swayPhase: number;
  swayAmp: number;
  baseX: number;
  fireCd: number;
  score: number;
}

interface PowerUp {
  g: Graphics;
  x: number;
  y: number;
  r: number;
  type: PowerType;
}

interface Particle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Star {
  g: Graphics;
  x: number;
  y: number;
  speed: number;
  size: number;
}

const COLORS = {
  cyan: 0x38f6ff,
  magenta: 0xff3ea5,
  yellow: 0xffe14d,
  white: 0xffffff,
};

export class Game {
  private app = new Application();
  private cb: GameCallbacks;
  private audio = new Audio();

  private world = new Container();
  private starsLayer = new Container();
  private entities = new Container();
  private fx = new Container();

  private player!: Graphics;
  private shieldRing!: Graphics;
  private playerX = 0;
  private playerY = 0;

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private enemyBullets: Bullet[] = [];
  private powerups: PowerUp[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];

  // input
  private keys = new Set<string>();
  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;

  // run state
  private ready = false;
  private disposed = false;
  private running = false;
  private score = 0;
  private wave = 0;
  private lives = 3;

  // timers (ms)
  private fireTimer = 0;
  private fireInterval = 220;
  private rapidTimer = 0;
  private spreadTimer = 0;
  private shieldTimer = 0;
  private invulnTimer = 0;

  // wave control
  private waveSize = 0;
  private spawnedThisWave = 0;
  private spawnTimer = 0;
  private spawnInterval = 900;
  private betweenWaves = 0;

  private shake = 0;

  constructor(cb: GameCallbacks) {
    this.cb = cb;
  }

  async init(container: HTMLElement) {
    await this.app.init({
      resizeTo: container,
      background: 0x05030f,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    // React StrictMode may unmount us while app.init() was still pending.
    // If so, tear the freshly-created renderer down and never touch the DOM.
    if (this.disposed) {
      this.app.destroy(true);
      return;
    }

    container.appendChild(this.app.canvas);

    this.fx.blendMode = 'add';
    this.world.addChild(this.starsLayer, this.entities, this.fx);
    this.app.stage.addChild(this.world);

    this.buildStars();
    this.buildPlayer();
    this.playerX = this.app.screen.width / 2;
    this.playerY = this.app.screen.height * 0.82;
    this.player.visible = false;

    this.bindInput();
    this.app.ticker.add(this.update);
    this.ready = true;
  }

  start() {
    // reset run
    this.clearArray(this.bullets);
    this.clearArray(this.enemies);
    this.clearArray(this.enemyBullets);
    this.clearArray(this.powerups);
    this.clearArray(this.particles);

    this.score = 0;
    this.wave = 0;
    this.lives = 3;
    this.fireInterval = 220;
    this.rapidTimer = 0;
    this.spreadTimer = 0;
    this.shieldTimer = 0;
    this.invulnTimer = 0;
    this.fireTimer = 0;
    this.betweenWaves = 0;
    this.spawnedThisWave = 0;
    this.shake = 0;

    this.playerX = this.app.screen.width / 2;
    this.playerY = this.app.screen.height * 0.82;
    this.player.visible = true;
    this.player.alpha = 1;

    this.cb.onScore(0);
    this.cb.onLives(this.lives);

    this.audio.resume();
    this.running = true;
    this.nextWave();
  }

  destroy() {
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    // `init()` is async; a StrictMode unmount can call destroy() before it
    // finished. If the renderer isn't up yet, init() will self-destroy on
    // seeing `disposed`; here we only tear down once it actually exists.
    if (!this.ready) return;
    this.ready = false;
    this.running = false;
    this.app.ticker.remove(this.update);
    const c = this.app.canvas;
    if (c) {
      c.removeEventListener('pointermove', this.onPointerMove);
      c.removeEventListener('pointerdown', this.onPointerMove);
    }
    this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------- build

  private buildStars() {
    const { width, height } = this.app.screen;
    const count = Math.round((width * height) / 6000);
    for (let i = 0; i < count; i++) {
      const far = Math.random() < 0.6;
      const size = far ? 1 : 2;
      const g = new Graphics().circle(0, 0, size).fill({
        color: COLORS.white,
        alpha: far ? 0.35 : 0.7,
      });
      const star: Star = {
        g,
        x: Math.random() * width,
        y: Math.random() * height,
        speed: far ? 0.03 + Math.random() * 0.03 : 0.08 + Math.random() * 0.08,
        size,
      };
      g.position.set(star.x, star.y);
      this.starsLayer.addChild(g);
      this.stars.push(star);
    }
  }

  private buildPlayer() {
    const g = new Graphics();
    // hull
    g.poly([0, -18, 14, 16, 0, 9, -14, 16]).fill(COLORS.cyan);
    g.poly([0, -18, 6, 8, 0, 4, -6, 8]).fill(COLORS.white);
    // engine glow
    g.circle(0, 14, 4).fill({ color: COLORS.yellow, alpha: 0.9 });
    this.player = g;
    this.entities.addChild(g);

    const ring = new Graphics().circle(0, 0, 26).stroke({ width: 3, color: COLORS.magenta });
    ring.blendMode = 'add';
    ring.visible = false;
    this.shieldRing = ring;
    this.entities.addChild(ring);
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const c = this.app.canvas;
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerdown', this.onPointerMove);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.app.canvas.getBoundingClientRect();
    this.pointerX = (e.clientX - rect.left) * (this.app.screen.width / rect.width);
    this.pointerY = (e.clientY - rect.top) * (this.app.screen.height / rect.height);
    this.pointerActive = true;
  };

  // ---------------------------------------------------------------- loop

  private update = (ticker: Ticker) => {
    const dt = Math.min(ticker.deltaMS, 40);

    this.updateStars(dt);
    if (!this.running) {
      this.updateParticles(dt);
      return;
    }

    this.updatePlayer(dt);
    this.updateFire(dt);
    this.updateBullets(dt);
    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.updateEnemyBullets(dt);
    this.updatePowerups(dt);
    this.updateParticles(dt);
    this.updateTimers(dt);
    this.collide();
    this.applyShake(dt);
  };

  private updateStars(dt: number) {
    const h = this.app.screen.height;
    const w = this.app.screen.width;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * w;
      }
      s.g.position.set(s.x, s.y);
    }
  }

  private updatePlayer(dt: number) {
    const speed = 0.62;
    let kx = 0;
    let ky = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) kx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) ky -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      this.pointerActive = false;
      const len = Math.hypot(kx, ky) || 1;
      this.playerX += (kx / len) * speed * dt;
      this.playerY += (ky / len) * speed * dt;
    } else if (this.pointerActive) {
      const ease = Math.min(1, dt * 0.02);
      this.playerX += (this.pointerX - this.playerX) * ease;
      this.playerY += (this.pointerY - this.playerY) * ease;
    }

    const m = 22;
    this.playerX = Math.max(m, Math.min(this.app.screen.width - m, this.playerX));
    this.playerY = Math.max(m, Math.min(this.app.screen.height - m, this.playerY));
    this.player.position.set(this.playerX, this.playerY);

    // shield ring follows the player while active
    if (this.shieldTimer > 0) {
      this.shieldRing.visible = true;
      this.shieldRing.position.set(this.playerX, this.playerY);
      this.shieldRing.alpha = 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 200));
    } else {
      this.shieldRing.visible = false;
    }

    // blink while invulnerable (but not while shielded — shield draws a ring)
    if (this.invulnTimer > 0 && this.shieldTimer <= 0) {
      this.player.alpha = Math.sin(performance.now() / 60) > 0 ? 1 : 0.35;
    } else {
      this.player.alpha = 1;
    }
  }

  private updateFire(dt: number) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = this.rapidTimer > 0 ? this.fireInterval * 0.5 : this.fireInterval;

    const spread = this.spreadTimer > 0;
    const angles = spread ? [-0.22, 0, 0.22] : [0];
    for (const a of angles) {
      this.spawnBullet(this.playerX, this.playerY - 18, Math.sin(a) * 0.9, -Math.cos(a) * 0.9);
    }
    this.audio.play('shoot');
  }

  private spawnBullet(x: number, y: number, vx: number, vy: number) {
    const g = new Graphics().roundRect(-2.5, -8, 5, 16, 2.5).fill(COLORS.yellow);
    g.blendMode = 'add';
    g.position.set(x, y);
    this.fx.addChild(g);
    this.bullets.push({ g, x, y, vx, vy, r: 5 });
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.position.set(b.x, b.y);
      if (b.y < -20 || b.x < -20 || b.x > this.app.screen.width + 20) {
        this.removeFrom(this.bullets, i, this.fx);
      }
    }
  }

  // ---------------------------------------------------------------- waves

  private nextWave() {
    this.wave += 1;
    this.cb.onWave(this.wave);
    this.waveSize = Math.min(22, 5 + this.wave * 2);
    this.spawnedThisWave = 0;
    this.spawnInterval = Math.max(260, 900 - this.wave * 55);
    this.spawnTimer = 0;
  }

  private updateWaves(dt: number) {
    if (this.betweenWaves > 0) {
      this.betweenWaves -= dt;
      if (this.betweenWaves <= 0) this.nextWave();
      return;
    }

    if (this.spawnedThisWave < this.waveSize) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this.spawnEnemy();
        this.spawnedThisWave += 1;
      }
    } else if (this.enemies.length === 0) {
      this.betweenWaves = 1600;
    }
  }

  private spawnEnemy() {
    const w = this.app.screen.width;
    const bruteChance = this.wave >= 3 ? Math.min(0.4, 0.12 + this.wave * 0.03) : 0;
    const isBrute = Math.random() < bruteChance;
    const r = isBrute ? 22 : 15;
    const x = r + Math.random() * (w - r * 2);

    const g = new Graphics();
    if (isBrute) {
      g.poly(hexagon(r)).fill(COLORS.cyan);
      g.poly(hexagon(r * 0.55)).fill({ color: 0x0c2a30, alpha: 1 });
      g.poly(hexagon(r * 0.55)).stroke({ width: 2, color: COLORS.cyan });
    } else {
      g.poly([0, -r, r, 0, 0, r, -r, 0]).fill(COLORS.magenta);
      g.circle(0, 0, r * 0.35).fill({ color: 0x2a0c1e });
    }
    g.position.set(x, -r);
    this.entities.addChild(g);

    this.enemies.push({
      g,
      x,
      y: -r,
      baseX: x,
      vy: (isBrute ? 0.07 : 0.11) + this.wave * 0.006,
      r,
      hp: isBrute ? 3 : 1,
      kind: isBrute ? 'brute' : 'grunt',
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: isBrute ? 20 : 40 + Math.random() * 30,
      fireCd: 1200 + Math.random() * 1200,
      score: isBrute ? 300 : 100,
    });
  }

  private updateEnemies(dt: number) {
    const h = this.app.screen.height;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.y += e.vy * dt;
      e.swayPhase += dt * 0.004;
      e.x = e.baseX + Math.sin(e.swayPhase) * e.swayAmp;
      // brutes drift toward the player
      if (e.kind === 'brute') {
        e.baseX += Math.sign(this.playerX - e.baseX) * 0.03 * dt;
      }
      e.g.position.set(e.x, e.y);
      e.g.rotation += dt * (e.kind === 'brute' ? 0.001 : 0.003);

      // brute fire
      if (e.kind === 'brute' && this.running) {
        e.fireCd -= dt;
        if (e.fireCd <= 0 && e.y > 0 && e.y < h * 0.6) {
          e.fireCd = 1600 + Math.random() * 1400;
          const dx = this.playerX - e.x;
          const dy = this.playerY - e.y;
          const d = Math.hypot(dx, dy) || 1;
          this.spawnEnemyBullet(e.x, e.y, (dx / d) * 0.35, (dy / d) * 0.35);
        }
      }

      if (e.y > h + e.r + 10) {
        this.removeFrom(this.enemies, i, this.entities);
      }
    }
  }

  private spawnEnemyBullet(x: number, y: number, vx: number, vy: number) {
    const g = new Graphics().circle(0, 0, 5).fill(COLORS.magenta);
    g.blendMode = 'add';
    g.position.set(x, y);
    this.fx.addChild(g);
    this.enemyBullets.push({ g, x, y, vx, vy, r: 5 });
  }

  private updateEnemyBullets(dt: number) {
    const h = this.app.screen.height;
    const w = this.app.screen.width;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.g.position.set(b.x, b.y);
      if (b.y > h + 20 || b.y < -20 || b.x < -20 || b.x > w + 20) {
        this.removeFrom(this.enemyBullets, i, this.fx);
      }
    }
  }

  // ---------------------------------------------------------------- powerups

  private maybeDropPowerUp(x: number, y: number) {
    if (Math.random() > 0.16) return;
    const types: PowerType[] = ['rapid', 'spread', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    const color =
      type === 'rapid' ? COLORS.yellow : type === 'spread' ? COLORS.cyan : COLORS.magenta;
    const r = 12;
    const g = new Graphics();
    g.circle(0, 0, r).stroke({ width: 3, color });
    g.circle(0, 0, r * 0.45).fill(color);
    g.position.set(x, y);
    this.entities.addChild(g);
    this.powerups.push({ g, x, y, r, type });
  }

  private updatePowerups(dt: number) {
    const h = this.app.screen.height;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 0.12 * dt;
      p.g.position.set(p.x, p.y);
      p.g.rotation += dt * 0.004;
      if (p.y > h + p.r) this.removeFrom(this.powerups, i, this.entities);
    }
  }

  private applyPowerUp(type: PowerType) {
    if (type === 'rapid') this.rapidTimer = 8000;
    else if (type === 'spread') this.spreadTimer = 8000;
    else this.shieldTimer = this.invulnTimer = 6000;
    this.audio.play('powerup');
  }

  // ---------------------------------------------------------------- particles

  private burst(x: number, y: number, color: number, amount: number) {
    if (this.particles.length > 220) return;
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.1 + Math.random() * 0.35;
      const g = new Graphics().circle(0, 0, 1 + Math.random() * 2.5).fill(color);
      g.blendMode = 'add';
      g.position.set(x, y);
      this.fx.addChild(g);
      const life = 350 + Math.random() * 350;
      this.particles.push({
        g,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.removeFrom(this.particles, i, this.fx);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.g.position.set(p.x, p.y);
      p.g.alpha = p.life / p.maxLife;
    }
  }

  // ---------------------------------------------------------------- timers

  private updateTimers(dt: number) {
    if (this.rapidTimer > 0) this.rapidTimer -= dt;
    if (this.spreadTimer > 0) this.spreadTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
  }

  // ---------------------------------------------------------------- collisions

  private collide() {
    // player bullets vs enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (dist2(e.x, e.y, b.x, b.y) <= (e.r + b.r) ** 2) {
          this.removeFrom(this.bullets, j, this.fx);
          e.hp -= 1;
          if (e.hp <= 0) {
            this.killEnemy(i);
          } else {
            this.burst(b.x, b.y, COLORS.white, 4);
            this.audio.play('hit');
          }
          break;
        }
      }
    }

    if (this.invulnTimer <= 0) {
      // enemies vs player
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (dist2(e.x, e.y, this.playerX, this.playerY) <= (e.r + 14) ** 2) {
          this.killEnemy(i, false);
          this.damagePlayer();
          break;
        }
      }
    }

    if (this.invulnTimer <= 0) {
      // enemy bullets vs player
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (dist2(b.x, b.y, this.playerX, this.playerY) <= (b.r + 13) ** 2) {
          this.removeFrom(this.enemyBullets, i, this.fx);
          this.damagePlayer();
          break;
        }
      }
    }

    // powerups vs player
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (dist2(p.x, p.y, this.playerX, this.playerY) <= (p.r + 16) ** 2) {
        this.applyPowerUp(p.type);
        this.removeFrom(this.powerups, i, this.entities);
      }
    }
  }

  private killEnemy(index: number, award = true) {
    const e = this.enemies[index];
    const color = e.kind === 'brute' ? COLORS.cyan : COLORS.magenta;
    this.burst(e.x, e.y, color, e.kind === 'brute' ? 22 : 12);
    if (award) {
      this.score += e.score;
      this.cb.onScore(this.score);
      this.maybeDropPowerUp(e.x, e.y);
    }
    this.audio.play('explosion');
    this.removeFrom(this.enemies, index, this.entities);
  }

  private damagePlayer() {
    this.lives -= 1;
    this.cb.onLives(this.lives);
    this.burst(this.playerX, this.playerY, COLORS.yellow, 26);
    this.audio.play('hit');
    this.shake = 12;
    this.invulnTimer = Math.max(this.invulnTimer, 1500);
    if (this.lives <= 0) this.gameOver();
  }

  private gameOver() {
    this.running = false;
    this.player.visible = false;
    this.shieldRing.visible = false;
    this.audio.play('gameover');
    this.cb.onGameOver(this.score);
  }

  // ---------------------------------------------------------------- misc

  private applyShake(dt: number) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 0.05);
      this.world.position.set(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    } else {
      this.world.position.set(0, 0);
    }
  }

  private removeFrom(arr: { g: Graphics }[], index: number, layer: Container) {
    const item = arr[index];
    layer.removeChild(item.g);
    item.g.destroy();
    arr.splice(index, 1);
  }

  private clearArray(arr: { g: Graphics }[]) {
    for (const item of arr) {
      item.g.parent?.removeChild(item.g);
      item.g.destroy();
    }
    arr.length = 0;
  }
}

// ---------------------------------------------------------------- helpers

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function hexagon(r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}
