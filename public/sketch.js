/* 
  Barrel Bash! — a Donkey Kong–like, built from scratch with p5.js + p5.sound
  - Programmatic art (no external images)
  - Synth audio (SFX + light background arps)
  - Responsive via virtual canvas scaling
  - Mobile controls (left/right/jump), keyboard, HUD
*/

let VIRTUAL_W = 480;   // virtual design width
let VIRTUAL_H = 270;   // virtual design height (16:9)

let scaleFactor = 1;
let g; // graphics buffer for crisp scaling

// Game state
let game;
let hudEls = {};
let controls;
let soundMgr;

function setup() {
  const { w, h } = fitToScreen();
  const cnv = createCanvas(w, h);
  cnv.parent('game-root');

  g = createGraphics(VIRTUAL_W, VIRTUAL_H);

  controls = new Controls();
  soundMgr = new SoundManager();

  queryHud();
  game = new Game();

  windowResized();
}

function draw() {
  background('#060912');

  // Update scale factor every frame (in case of orientation changes)
  fitToScreen();

  game.update();
  game.render(g);

  // Draw buffer scaled to canvas
  image(g, 0, 0, width, height);

  // HUD updates
  updateHud(game);
}

function mousePressed() {
  // First interaction can resume the AudioContext for mobile policies
  soundMgr.unlock();
}

function touchStarted() {
  soundMgr.unlock();
  return false;
}

function windowResized() {
  const { w, h } = fitToScreen();
  resizeCanvas(w, h);
  // Show/hide mobile controls if needed
  const mc = document.getElementById('mobile-controls');
  if (isMobile()) mc.classList.remove('hidden'); else mc.classList.add('hidden');
}

function fitToScreen() {
  const root = document.getElementById('game-root');
  const rect = root.getBoundingClientRect();
  const targetW = rect.width;
  const targetH = rect.height - 120; // reserve space for HUD/controls
  const aspect = 16 / 9;
  let w = targetW;
  let h = w / aspect;
  if (h > targetH) {
    h = targetH;
    w = h * aspect;
  }
  scaleFactor = min(w / VIRTUAL_W, h / VIRTUAL_H);
  return { w: floor(w), h: floor(h) };
}

function queryHud() {
  hudEls.score = document.getElementById('score');
  hudEls.level = document.getElementById('level');
  hudEls.lives = document.getElementById('lives');

  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  muteBtn.onclick = () => soundMgr.toggleMute();
  pauseBtn.onclick = () => game.togglePause();

  // Mobile buttons
  const left = document.getElementById('btn-left');
  const right = document.getElementById('btn-right');
  const jump = document.getElementById('btn-jump');

  left.addEventListener('touchstart', e => { e.preventDefault(); controls.left = true; }, {passive:false});
  left.addEventListener('touchend',   e => { e.preventDefault(); controls.left = false; }, {passive:false});
  right.addEventListener('touchstart', e => { e.preventDefault(); controls.right = true; }, {passive:false});
  right.addEventListener('touchend',   e => { e.preventDefault(); controls.right = false; }, {passive:false});
  jump.addEventListener('touchstart', e => { e.preventDefault(); controls.jumpPress(); }, {passive:false});
}

function updateHud(game) {
  hudEls.score.textContent = `Score: ${game.score}`;
  hudEls.level.textContent = `Level: ${game.level}`;
  hudEls.lives.textContent = `Lives: ${game.lives}`;
}

/* -----------------------------
   Controls
------------------------------*/
class Controls {
  constructor() {
    this.left = false;
    this.right = false;
    this.jump = false;

    this._jumpBuffered = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft','a','A'].includes(e.key)) this.left = true;
      if (['ArrowRight','d','D'].includes(e.key)) this.right = true;
      if ([' ','ArrowUp','w','W'].includes(e.key)) this.jumpPress();
      if (e.key === 'm' || e.key === 'M') soundMgr.toggleMute();
      if (e.key === 'p' || e.key === 'P') game.togglePause();
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft','a','A'].includes(e.key)) this.left = false;
      if (['ArrowRight','d','D'].includes(e.key)) this.right = false;
    });
  }

  jumpPress() {
    this._jumpBuffered = true;
    setTimeout(() => (this._jumpBuffered = false), 160);
  }

  consumeJumpBuffer() {
    if (this._jumpBuffered) {
      this._jumpBuffered = false;
      return true;
    }
    return false;
  }
}

/* -----------------------------
   Sound Manager (synth SFX + light arp)
------------------------------*/
class SoundManager {
  constructor() {
    this.enabled = true;
    this.started = false;

    this.masterGain = new p5.Gain();
    this.masterGain.connect();
    this.masterGain.amp(0.7);

    this.fxGain = new p5.Gain();
    this.fxGain.connect(this.masterGain);

    // Simple background arpeggio
    this.arpOsc = new p5.Oscillator('triangle');
    this.arpOsc.disconnect();
    this.arpOsc.connect(this.masterGain);
    this.arpOn = false;
    this.lastArp = 0;
    this.arpIdx = 0;
    this.arpNotes = [220, 277, 330, 440, 330, 277]; // A minor-ish vibe
  }

  unlock() {
    if (!this.started) {
      try {
        getAudioContext().resume();
        this.started = true;
        document.getElementById('tip').style.display = 'none';
      } catch (_) {}
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    this.masterGain.amp(this.enabled ? 0.7 : 0.0, 0.05);
    document.getElementById('muteBtn').textContent = this.enabled ? '🔊' : '🔇';
  }

  startArp() {
    if (!this.arpOn) {
      this.arpOsc.start();
      this.arpOn = true;
    }
  }

  stopArp() {
    if (this.arpOn) {
      this.arpOsc.stop();
      this.arpOn = false;
    }
  }

  update() {
    if (!this.enabled || !this.arpOn) return;
    if (millis() - this.lastArp > 220) {
      this.lastArp = millis();
      const f = this.arpNotes[this.arpIdx % this.arpNotes.length];
      this.arpIdx++;
      this.arpOsc.freq(f);
      this.arpOsc.amp(0.12, 0.02);
      setTimeout(() => this.arpOsc.amp(0.02, 0.18), 40);
    }
  }

  playJump() {
    if (!this.enabled) return;
    const o = new p5.Oscillator('square');
    const e = new p5.Envelope();
    e.setADSR(0.005, 0.04, 0.0, 0.02);
    e.setRange(0.3, 0);
    o.disconnect(); o.connect(this.fxGain);
    o.freq(160);
    o.start();
    e.play(o, 0, 0.05);
    setTimeout(()=>o.stop(), 120);
  }

  playHit() {
    if (!this.enabled) return;
    const n = new p5.Noise('pink');
    const e = new p5.Envelope();
    const f = new p5.Filter('bandpass');
    f.freq(400);
    n.disconnect(); n.connect(f); f.connect(this.fxGain);
    e.setADSR(0.002, 0.08, 0.0, 0.02);
    e.setRange(0.5, 0);
    n.start();
    e.play(n);
    setTimeout(()=>n.stop(), 120);
  }

  playCoin() {
    if (!this.enabled) return;
    const o = new p5.Oscillator('sine');
    const e = new p5.Envelope();
    e.setADSR(0.002, 0.1, 0.0, 0.05);
    e.setRange(0.4, 0);
    o.disconnect(); o.connect(this.fxGain);
    o.freq(880);
    o.start();
    e.play(o);
    setTimeout(()=>o.stop(), 150);
  }

  playWin() {
    if (!this.enabled) return;
    [660, 880, 990, 1320].forEach((f, i) => {
      setTimeout(() => {
        const o = new p5.Oscillator('triangle');
        const e = new p5.Envelope();
        e.setADSR(0.002, 0.08, 0.0, 0.05);
        e.setRange(0.35, 0);
        o.disconnect(); o.connect(this.fxGain);
        o.freq(f);
        o.start();
        e.play(o);
        setTimeout(() => o.stop(), 160);
      }, i * 120);
    });
  }
}

/* -----------------------------
   Game entities
------------------------------*/
class Game {
  constructor() {
    this.reset(true);
    this.highScore = int(localStorage.getItem('bbash_high') || 0);
  }

  reset(fresh=false) {
    this.level = fresh ? 1 : this.level;
    this.score = fresh ? 0 : this.score;
    this.lives = fresh ? 3 : this.lives;

    this.state = 'playing'; // 'playing' | 'dead' | 'win' | 'paused'
    this.stateTimer = 0;

    this.gravity = 0.35;
    this.platforms = this.buildLevel(this.level);
    this.ladders = this.buildLadders(this.level);
    this.decor = this.buildDecor();

    this.player = new Player(30, VIRTUAL_H - 40);
    this.barrels = [];
    this.barrelTimer = 0;
    this.barrelInterval = max(1700 - (this.level-1)*150, 800);

    this.princess = { x: VIRTUAL_W - 44, y: 32, w: 20, h: 26 };
    this.gorilla  = { x: 40, y: 28, w: 28, h: 30, drum: 0 };

    soundMgr.startArp();
  }

  nextLevel() {
    this.level++;
    this.score += 1000;
    soundMgr.playWin();
    this.reset(false);
  }

  loseLife() {
    if (this.lives > 1) {
      this.lives--;
      this.state = 'dead';
      this.stateTimer = millis();
      soundMgr.playHit();
      setTimeout(() => {
        this.state = 'playing';
        this.player = new Player(30, VIRTUAL_H - 40);
        this.barrels = [];
      }, 900);
    } else {
      this.gameOver();
    }
  }

  gameOver() {
    this.state = 'dead';
    this.lives = 0;
    this.stateTimer = millis();
    soundMgr.stopArp();
    setTimeout(() => {
      this.highScore = max(this.highScore, this.score);
      localStorage.setItem('bbash_high', this.highScore);
      this.reset(true);
    }, 1400);
  }

  togglePause() {
    if (this.state === 'paused') {
      this.state = 'playing';
      soundMgr.startArp();
    } else if (this.state === 'playing') {
      this.state = 'paused';
      soundMgr.stopArp();
    }
  }

  update() {
    soundMgr.update();
    if (this.state !== 'playing') return;

    // Spawn barrels
    if (millis() - this.barrelTimer > this.barrelInterval) {
      this.barrelTimer = millis();
      const b = new Barrel(this.gorilla.x + 6, this.gorilla.y + 18, 1.6 + random(0.5));
      this.barrels.push(b);
    }

    // Animate gorilla "drumming"
    this.gorilla.drum = (sin(millis() * 0.01) + 1) * 0.5;

    // Update player
    this.player.update(this);

    // Update barrels
    for (let b of this.barrels) b.update(this);

    // Collisions: player vs barrels
    for (let b of this.barrels) {
      if (rectOverlap(this.player.bounds(), b.bounds())) {
        this.loseLife();
        break;
      }
    }

    // Win condition: reach princess
    if (rectOverlap(this.player.bounds(), {x:this.princess.x-6, y:this.princess.y-4, w:this.princess.w+12, h:this.princess.h+8})) {
      this.nextLevel();
    }

    // Cull barrels that fell off
    this.barrels = this.barrels.filter(b => b.y < VIRTUAL_H + 40);
  }

  render(pg) {
    pg.push();
    // Night sky gradient
    pg.noStroke();
    for (let i = 0; i < VIRTUAL_H; i++) {
      const c = lerpColor(color('#081022'), color('#05070e'), i / VIRTUAL_H);
      pg.stroke(c);
      pg.line(0, i, VIRTUAL_W, i);
    }

    // City skyline silhouettes
    this.drawSkyline(pg);

    // Platforms
    for (let p of this.platforms) p.render(pg);

    // Ladders
    for (let l of this.ladders) l.render(pg);

    // Princess platform glow
    pg.noStroke();
    pg.fill(255, 220, 220, 20);
    pg.ellipse(this.princess.x + this.princess.w/2, this.princess.y + this.princess.h, 48, 18);

    // Princess (simple pixel doll)
    drawPrincess(pg, this.princess.x, this.princess.y);

    // Gorilla
    drawGorilla(pg, this.gorilla.x, this.gorilla.y, this.gorilla.drum);

    // Barrels
    for (let b of this.barrels) b.render(pg);

    // Player
    this.player.render(pg);

    // Foreground vignette
    pg.noFill();
    pg.stroke(0, 120);
    pg.rect(0.5, 0.5, VIRTUAL_W-1, VIRTUAL_H-1, 6);

    // UI overlays
    pg.fill(255, 240);
    pg.textFont('monospace');
    pg.textSize(8);
    pg.textAlign(LEFT, TOP);
    pg.text(`HI ${this.highScore}`, 6, 6);
    pg.textAlign(RIGHT, TOP);
    pg.text(`SCORE ${this.score}`, VIRTUAL_W - 6, 6);

    if (this.state === 'paused') {
      overlay(pg, "PAUSED\nPress P to resume");
    }
    pg.pop();
  }

  buildLevel(level) {
    // slanted ramps
    const ramps = [];
    const rows = 5;
    const pad = 14;
    const gap = 44;
    for (let r = 0; r < rows; r++) {
      const y = VIRTUAL_H - 30 - r * 44;
      const leftToRight = r % 2 === 0;
      const x = leftToRight ? pad : pad;
      const w = VIRTUAL_W - pad*2;
      const slope = (leftToRight ? -1 : 1) * (0.08 + r*0.005);
      ramps.push(new Platform(x, y, w, 8, slope));
    }
    // top platform for princess + gorilla
    ramps.push(new Platform(16, 28, VIRTUAL_W - 32, 8, 0));
    return ramps;
  }

  buildLadders(level) {
    const ladders = [];
    const rows = 5;
    const pad = 16;
    for (let r = 0; r < rows; r++) {
      const yTop = VIRTUAL_H - 30 - r * 44;
      const leftToRight = r % 2 === 0;
      const x = leftToRight ? VIRTUAL_W - pad - 40 : pad + 40;
      ladders.push(new Ladder(x, yTop - 36, 36));
    }
    // a couple extra
    ladders.push(new Ladder(VIRTUAL_W/2 - 10, VIRTUAL_H - 30 - 44*2 - 36, 36));
    ladders.push(new Ladder(VIRTUAL_W/2 + 40, VIRTUAL_H - 30 - 44*3 - 36, 36));
    return ladders;
  }

  buildDecor() {
    // optional: lanterns, signs — kept simple for clarity
    return [];
  }

  groundY(x) {
    // returns ground y at x based on platforms under that x
    let gy = VIRTUAL_H + 999;
    for (let p of this.platforms) {
      if (x >= p.x && x <= p.x + p.w) {
        const py = p.surfaceYAt(x);
        if (py < gy) gy = py;
      }
    }
    return gy;
  }
}

class Platform {
  constructor(x, y, w, h, slope=0) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.slope = slope;
    this.color = color('#2b3555');
    this.rail = color('#7aa2ff');
  }
  surfaceYAt(x) {
    const t = (x - this.x) / this.w;
    const dy = this.slope * this.w * t;
    return this.y + dy;
  }
  render(pg) {
    // rail
    pg.noStroke();
    pg.fill(this.color);
    pg.rect(this.x, this.y, this.w, this.h, 3);

    // studs
    pg.fill(255, 50);
    for (let i = 0; i < this.w; i += 16) {
      pg.rect(this.x + i + 3, this.y + 2, 8, 2, 1);
    }

    // accent line
    pg.stroke(this.rail);
    pg.line(this.x, this.y, this.x + this.w, this.y + this.h * 0.1);
  }
}

class Ladder {
  constructor(x, y, h) {
    this.x = x; this.y = y; this.h = h;
  }
  render(pg) {
    pg.push();
    pg.stroke('#9cc2ff');
    pg.strokeWeight(2);
    pg.line(this.x, this.y, this.x, this.y + this.h);
    pg.line(this.x + 10, this.y, this.x + 10, this.y + this.h);
    for (let y = this.y + 3; y < this.y + this.h - 2; y += 6) {
      pg.line(this.x, y, this.x + 10, y);
    }
    pg.pop();
  }
  contains(px, py) {
    return px >= this.x - 2 && px <= this.x + 12 && py >= this.y && py <= this.y + this.h;
  }
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.speed = 1.1;
    this.air = true;
    this.climbing = false;
    this.facing = 1;
    this.width = 10; this.height = 14;
    this.jumpPower = 5.6;
    this.onPlatform = null;
    this.invuln = 0;
  }

  bounds() {
    return { x: this.x - this.width/2, y: this.y - this.height, w: this.width, h: this.height };
  }

  update(game) {
    // Horizontal
    if (!this.climbing) {
      const ax = (controls.left ? -1 : 0) + (controls.right ? 1 : 0);
      this.vx = lerp(this.vx, ax * this.speed, 0.4);
      if (ax !== 0) this.facing = ax;
    } else {
      this.vx = 0;
    }

    // Ladder check
    const onLadder = game.ladders.some(l => l.contains(this.x, this.y - this.height/2));
    if (onLadder && (controls.consumeJumpBuffer() || keyIsDown(UP_ARROW) || keyIsDown(87))) {
      this.climbing = true;
      soundMgr.playCoin(); // little "grab" tick
    }
    if (this.climbing) {
      this.vy = (keyIsDown(UP_ARROW) || keyIsDown(87)) ? -1 :
                (keyIsDown(DOWN_ARROW) || keyIsDown(83)) ? 1 : 0;
      // exit ladder if feet hit platform
      const ground = game.groundY(this.x);
      if (this.y >= ground) {
        this.y = ground;
        this.climbing = false;
      }
      // allow small lateral shimmy
      if (controls.left) this.x -= 0.4;
      if (controls.right) this.x += 0.4;
    } else {
      // Gravity
      this.vy += game.gravity;
      const ground = game.groundY(this.x);
      if (this.y + this.vy >= ground) {
        // landed
        if (this.air && this.vy > 1.2) soundMgr.playHit();
        this.y = ground;
        this.vy = 0;
        this.air = false;

        // Jump?
        if (controls.consumeJumpBuffer()) {
          this.vy = -this.jumpPower;
          this.air = true;
          soundMgr.playJump();
        }
      } else {
        // in air
        if (controls.consumeJumpBuffer() && !this.air) {
          this.vy = -this.jumpPower;
          this.air = true;
          soundMgr.playJump();
        }
        this.y += this.vy;
        this.air = true;
      }
    }

    // Apply horizontal
    this.x += this.vx;

    // Bounds
    this.x = constrain(this.x, 8, VIRTUAL_W - 8);
    this.y = min(this.y, VIRTUAL_H + 50); // allow some fall

    if (this.invuln > 0) this.invuln--;
  }

  render(pg) {
    const b = this.bounds();
    pg.push();
    pg.translate(this.x, this.y - this.height);

    // shadow
    pg.noStroke();
    pg.fill(0, 80);
    pg.ellipse(0, this.height + 2, 10, 3);

    // body
    const flip = this.facing < 0 ? -1 : 1;
    pg.scale(flip, 1);

    // legs
    const legSwing = sin(millis() * 0.03 + this.x * 0.05) * (abs(this.vx) > 0.05 ? 2 : 0);
    pg.fill('#ffd4a8'); // skin
    pg.rect(-3 + legSwing, 8, 3, 6, 1);
    pg.rect(0 - legSwing, 8, 3, 6, 1);

    // torso
    pg.fill('#6cc6ff');
    pg.rect(-5, 2, 10, 8, 2);

    // head
    pg.fill('#ffd4a8');
    pg.rect(-4, -4, 8, 6, 2);

    // hair/hat
    pg.fill('#224a8f');
    pg.rect(-4, -5, 8, 3, 1);

    // eyes
    pg.fill(255);
    pg.rect(0, -3, 2, 2, 1);
    pg.fill(0);
    pg.rect(0, -3, 1, 1, 1);

    // arm
    pg.fill('#ffd4a8');
    const armSwing = sin(millis() * 0.03 + this.x * 0.05) * (abs(this.vx) > 0.05 ? 2 : 0);
    pg.rect(-6, 3 + armSwing, 3, 6, 1);

    // invulnerability blink
    if (this.invuln > 0 && frameCount % 6 < 3) {
      pg.fill(0, 120);
      pg.rect(-7, -6, 14, 22, 3);
    }

    pg.pop();
  }
}

class Barrel {
  constructor(x, y, speed=1.6) {
    this.x = x; this.y = y;
    this.vx = speed;
    this.vy = 0;
    this.r = 6;
    this.spin = random(TWO_PI);
    this.color = color('#c86a3a');
  }

  bounds() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 };
  }

  update(game) {
    // Follow ramps slope: move horizontally with slight roll
    this.vy += game.gravity * 0.6;

    // Ground follow
    const ground = game.groundY(this.x);
    if (this.y + this.vy >= ground) {
      this.y = ground;
      this.vy = 0;
      // drift along slope direction
      const p = game.platforms.find(pl => this.x >= pl.x && this.x <= pl.x + pl.w && abs(pl.surfaceYAt(this.x) - this.y) < 2);
      if (p) {
        this.x += (p.slope >= 0 ? 1 : -1) * this.vx;
        this.spin += 0.2 * (p.slope >= 0 ? 1 : -1);
      }
    } else {
      this.y += this.vy;
    }

    // Bounce off walls
    if (this.x < 8) { this.x = 8; this.vx *= -1; }
    if (this.x > VIRTUAL_W - 8) { this.x = VIRTUAL_W - 8; this.vx *= -1; }

    // Occasional ladder drop
    if (random() < 0.003) {
      const touching = game.ladders.find(l => l.contains(this.x, this.y-4));
      if (touching) {
        this.y += 1.6; // begin to drop
      }
    }
  }

  render(pg) {
    pg.push();
    pg.translate(this.x, this.y);
    pg.rotate(this.spin);
    pg.noStroke();
    pg.fill(this.color);
    pg.ellipse(0, 0, this.r*2+2, this.r*2);
    // hoops
    pg.stroke(60, 40, 20, 200);
    pg.noFill();
    pg.ellipse(0, 0, this.r*2-2, this.r*2-4);
    // slats
    pg.line(-this.r+1, -2, this.r-1, -2);
    pg.line(-this.r+1, 2, this.r-1, 2);
    pg.pop();
  }
}

/* -----------------------------
   Helpers / Art
------------------------------*/
function drawPrincess(pg, x, y) {
  pg.push();
  pg.translate(x, y);
  // dress
  pg.noStroke();
  pg.fill('#ffb3d1');
  pg.rect(0, 8, 20, 14, 4);
  // head
  pg.fill('#ffd4a8');
  pg.rect(6, 0, 8, 8, 2);
  // hair crown
  pg.fill('#f7d54e');
  pg.rect(5, -2, 10, 3, 1);
  // sparkle
  if (frameCount % 30 < 10) {
    pg.fill(255, 200);
    pg.rect(18, 6, 2, 2, 1);
  }
  pg.pop();
}

function drawGorilla(pg, x, y, drum=0) {
  pg.push();
  pg.translate(x, y);
  pg.noStroke();
  pg.fill('#5b3b2a');
  pg.rect(0, 8, 28, 20, 4); // body
  pg.rect(8, 0, 12, 10, 2); // head
  pg.fill('#3b251b');
  pg.rect(2, 18, 8, 10, 2); // leg
  pg.rect(18, 18, 8, 10, 2); // leg
  // arms drumming
  pg.push();
  pg.translate(4, 14);
  pg.rotate(-0.4 + drum*0.2);
  pg.rect(-6, 0, 8, 6, 2);
  pg.pop();
  pg.push();
  pg.translate(24, 14);
  pg.rotate(0.4 - drum*0.2);
  pg.rect(-2, 0, 8, 6, 2);
  pg.pop();
  // barrel stand
  pg.fill('#2b3555');
  pg.rect(-6, 24, 40, 6, 2);
  pg.pop();
}

function overlay(pg, textStr) {
  pg.push();
  pg.fill(0, 160);
  pg.rect(0, 0, VIRTUAL_W, VIRTUAL_H);
  pg.fill(255);
  pg.textAlign(CENTER, CENTER);
  pg.textSize(12);
  pg.text(textStr, VIRTUAL_W/2, VIRTUAL_H/2);
  pg.pop();
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

/* -----------------------------
   Utility: UA Mobile detection
------------------------------*/
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
