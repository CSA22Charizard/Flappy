/* global Phaser, lucide */
(() => {
  'use strict';
  const element = (id) => document.getElementById(id);
  const icons = () => globalThis.lucide?.createIcons();
  icons();
  if (!globalThis.Phaser) {
    element('load-error').hidden = false;
    element('overlay').hidden = true;
    return;
  }

  let best = 0;
  let sound = true;
  let audio;
  const sounds = {};
  const PIPE_SPACING = 240;
  const PIPE_SPEED = 220;
  const MEDALS = [
    { score: 1, name: 'Easy' },
    { score: 10, name: 'Medium' },
    { score: 20, name: 'Hard' },
    { score: 30, name: 'Expert' },
    { score: 40, name: 'Master' },
  ];
  try {
    const stored = Number(localStorage.getItem('flappy-best'));
    if (Number.isSafeInteger(stored) && stored > 0) best = stored;
  } catch {}
  try { sound = localStorage.getItem('flappy-sound') !== 'off'; } catch {}
  element('best').textContent = String(best).padStart(2, '0');

  function saveBest(score) {
    if (score <= best) return;
    best = score;
    try { localStorage.setItem('flappy-best', String(best)); } catch {}
  }

  function wakeAudio() {
    if (audio && audio.state !== 'running') audio.resume().catch(() => {});
  }

  // Sounds are calculated once at load, so a flap only has to start a ready-made buffer.
  function renderSound(duration, frequencyAt, levelAt, wave = Math.sin) {
    const buffer = audio.createBuffer(1, Math.ceil(duration * audio.sampleRate), audio.sampleRate);
    const samples = buffer.getChannelData(0);
    let phase = 0;
    for (let index = 0; index < samples.length; index++) {
      const time = index / audio.sampleRate;
      phase += 2 * Math.PI * frequencyAt(time) / audio.sampleRate;
      samples[index] = wave(phase) * levelAt(time);
    }
    return buffer;
  }

  function renderTone(frequency, duration, endFrequency) {
    return renderSound(
      duration,
      (time) => frequency * (endFrequency / frequency) ** (time / duration),
      (time) => 0.055 * (0.001 / 0.055) ** (time / duration),
    );
  }

  function prepareAudio() {
    if (audio) return;
    try {
      audio = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      sounds.flap = renderTone(520, 0.08, 850);
      sounds.die = renderTone(220, 0.22, 65);
      sounds.coin = renderSound(
        0.25,
        (time) => (time < 0.065 ? 988 : 1319),
        (time) => (time < 0.005 ? 0.035 * time / 0.005 : 0.035 * (0.001 / 0.035) ** ((time - 0.005) / 0.235)),
        (phase) => Math.sign(Math.sin(phase)),
      );
    } catch {}
  }

  function playSound(buffer) {
    if (!sound || !buffer) return;
    try {
      wakeAudio();
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start();
    } catch {}
  }

  // iOS only allows audio to start from touchend or click, not from the touch that begins a tap.
  for (const type of ['touchend', 'click']) document.addEventListener(type, wakeAudio, { passive: true });

  class Flight extends Phaser.Scene {
    constructor() { super('Flight'); }

    create() {
      this.cameras.main.setRoundPixels(false);
      this.width = this.scale.width;
      this.height = this.scale.height;
      this.floor = this.height - 43;
      this.state = 'ready';
      this.score = 0;
      this.pairs = [];
      this.lastSpawn = 0;
      this.makeTextures();
      if (!this.anims.exists('wing-flap')) {
        this.anims.create({
          key: 'wing-flap',
          frames: [{ key: 'bird-up' }, { key: 'bird' }, { key: 'bird-down' }, { key: 'bird' }],
          frameRate: 12,
          repeat: -1,
        });
      }
      this.drawLandscape();
      this.pipes = this.physics.add.group({ allowGravity: false, immovable: true });
      this.bird = this.physics.add.sprite(Math.min(200, this.width * 0.26), this.height * 0.26, 'bird').setDepth(5);
      this.bird.body.setSize(27, 23).setOffset(5, 4);
      this.bird.body.allowGravity = false;
      this.bird.play('wing-flap');
      // Creating an AudioContext can block for many frames on phones, so do it before the first flap.
      prepareAudio();
      this.physics.add.overlap(this.bird, this.pipes, () => this.die());
      const physicsWorld = this.physics.world;
      physicsWorld.on('worldstep', this.updateFlight, this);
      this.pointerHandler = () => this.act();
      element('stage').addEventListener('pointerdown', this.pointerHandler, { passive: true });
      this.keyHandler = (event) => {
        if (['Space', 'ArrowUp'].includes(event.code)) {
          if (event.target.closest('button,a') && event.code === 'Space') return;
          event.preventDefault();
          if (!event.repeat) this.act();
        }
        if (['KeyP', 'Escape'].includes(event.code) && !event.repeat) this.togglePause();
      };
      this.visibilityHandler = () => { if (document.hidden && this.state === 'playing') this.togglePause(); };
      this.blurHandler = () => { if (this.state === 'playing') this.togglePause(); };
      this.pageHideHandler = () => saveBest(this.score);
      document.addEventListener('keydown', this.keyHandler);
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('blur', this.blurHandler);
      window.addEventListener('pagehide', this.pageHideHandler);
      const resizeObserver = new ResizeObserver(() => {
        this.scale.getParentBounds();
        this.scale.refresh();
      });
      resizeObserver.observe(element('stage'));
      this.events.once('shutdown', () => {
        resizeObserver.disconnect();
        physicsWorld.off('worldstep', this.updateFlight, this);
        document.removeEventListener('keydown', this.keyHandler);
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        window.removeEventListener('blur', this.blurHandler);
        window.removeEventListener('pagehide', this.pageHideHandler);
        element('stage').removeEventListener('pointerdown', this.pointerHandler);
      });
      element('start').onclick = () => {
        if (this.state === 'over') this.reset();
        this.act();
        element('stage').focus({ preventScroll: true });
      };
      element('restart').onclick = () => { this.reset(); this.flap(); element('stage').focus({ preventScroll: true }); };
      element('pause').onclick = () => { this.togglePause(); element('stage').focus({ preventScroll: true }); };
      this.syncUI();
    }

    makeTextures() {
      if (this.textures.exists('bird')) return;
      const art = this.make.graphics({ x: 0, y: 0, add: false });
      const block = (color, x, y, width, height) => art.fillStyle(color).fillRect(x, y, width, height);
      for (const [key, wingY] of [['bird-up', 4], ['bird', 12], ['bird-down', 20]]) {
        block(0x324c3f, 8, 0, 24, 4); block(0x324c3f, 4, 4, 32, 24); block(0x324c3f, 8, 28, 24, 4);
        block(0xffdb00, 8, 4, 24, 24); block(0xfff38a, 8, 4, 16, 8); block(0xf5a400, 8, 24, 23, 4);
        block(0xffffff, 24, 4, 12, 16); block(0x324c3f, 32, 8, 4, 8);
        block(0x324c3f, 24, 20, 20, 8); block(0xff651a, 28, 20, 16, 4);
        block(0x324c3f, 0, wingY, 20, 12); block(0xffef63, 0, wingY, 16, 8); block(0xf5a400, 4, wingY + 8, 12, 4);
        art.generateTexture(key, 44, 32); art.clear();
      }
      block(0x07522a, 0, 0, 70, 2); block(0x25df24, 4, 0, 62, 2);
      block(0xb0ff47, 8, 0, 8, 2); block(0x5af22b, 16, 0, 11, 2); block(0x07952e, 56, 0, 10, 2);
      art.generateTexture('pipe', 70, 2); art.clear();
      block(0x07522a, 0, 0, 78, 26); block(0x3ff02c, 4, 4, 70, 18);
      block(0xb0ff47, 8, 4, 10, 18); block(0x07952e, 62, 4, 12, 18);
      block(0xb0ff47, 4, 4, 58, 3); block(0x067a36, 4, 19, 70, 3);
      art.generateTexture('cap', 78, 26); art.clear();
      block(0x07522a, 0, 0, 48, 43); block(0x7af52c, 0, 4, 48, 8); block(0x24b82d, 0, 12, 48, 5);
      block(0xf6d46b, 0, 17, 48, 26); block(0xd2ad42, 8, 24, 12, 4); block(0xd2ad42, 32, 34, 12, 4);
      art.generateTexture('ground', 48, 43); art.clear();
      art.fillStyle(0xffffff).fillRect(0, 22, 120, 18).fillRect(15, 10, 82, 22).fillRect(34, 0, 42, 15);
      art.generateTexture('cloud', 120, 40); art.clear();
      art.fillStyle(0x39c8ff).fillRect(0, 0, this.width, this.height);
      art.fillStyle(0xffe531).fillCircle(this.width * 0.79, this.height * 0.24, 31);
      art.generateTexture('sky', this.width, this.height); art.clear();
      for (let index = -1; index < this.width / 90 + 1; index++) {
        const top = this.floor - 90 - Math.sin(index * 1.7) * 30;
        art.fillStyle(0x58dc5d).fillRect(index * 90, top, 95, this.floor - top);
        art.fillStyle(0x58dc5d).fillRect(index * 90 + 18, top - 18, 59, 20);
      }
      for (let index = -1; index < this.width / 55 + 1; index++) {
        const top = this.floor - 37 - Math.sin(index * 2.3) * 14;
        art.fillStyle(0x1ca94d).fillRect(index * 55, top, 58, this.floor - top);
        art.fillStyle(0x1ca94d).fillRect(index * 55 + 10, top - 13, 35, 15);
        art.fillStyle(0x79ef54).fillRect(index * 55 + 12, top - 9, 18, 5);
      }
      art.generateTexture('hills', this.width, this.floor); art.destroy();
    }

    drawLandscape() {
      this.add.image(0, 0, 'sky').setOrigin(0);
      this.clouds = [];
      for (let index = 0; index < 7; index++) {
        const cloud = this.add.image(index * 210 + 40, 100 + (index % 3) * 65, 'cloud').setAlpha(0.85).setScale(0.7 + (index % 3) * 0.3);
        this.clouds.push(cloud);
      }
      this.add.image(0, 0, 'hills').setOrigin(0);
      this.ground = this.add.tileSprite(0, this.floor, this.width, 43, 'ground').setOrigin(0).setDepth(7);
    }

    act() {
      if (this.state === 'paused') { this.togglePause(); return; }
      if (this.state === 'over') {
        if (this.time.now - this.diedAt < 350) return;
        this.reset();
      }
      this.flap();
    }

    flap() {
      if (!['ready', 'playing'].includes(this.state)) return;
      if (this.state === 'ready') {
        this.state = 'playing';
        this.bird.body.reset(this.bird.x, this.bird.y);
        this.bird.body.allowGravity = true;
        this.lastSpawn = this.time.now;
        this.spawnPair();
        this.syncUI();
      }
      this.bird.setVelocityY(-350).setGravityY(-400).setAngle(-22);
      playSound(sounds.flap);
    }

    updateFlight(delta) {
      if (this.state !== 'playing') return;
      const velocity = this.bird.body.velocity.y;
      this.bird.setGravityY(velocity < 0 ? -400 : 0);
      if (velocity <= 0) {
        this.bird.setAngle(-22);
      } else {
        const fallSpeed = Math.min(velocity * Math.exp(2.5 * delta), 900);
        this.bird.setVelocityY(fallSpeed);
        const targetAngle = Math.min(fallSpeed * 0.16, 75);
        this.bird.setAngle(Phaser.Math.Linear(this.bird.angle, targetAngle, 1 - Math.exp(-10 * delta)));
      }
    }

    spawnPair() {
      const tier = Math.min(Math.floor(this.score / 10), 4);
      const [minimumGap, maximumGap] = [[150, 160], [134, 144], [118, 128], [106, 116], [96, 104]][tier];
      const difficulty = tier / 4;
      const gap = Phaser.Math.Between(minimumGap, maximumGap);
      const previousCenter = this.pairs.at(-1)?.center ?? this.bird.y;
      const highest = Math.max(Math.ceil(115 - 75 * difficulty + gap / 2), Math.ceil(previousCenter - 140));
      const lowest = Math.min(Math.floor(this.floor - (65 - 25 * difficulty) - gap / 2), Math.floor(previousCenter + 140));
      const placement = Phaser.Math.Between(0, 99);
      const center = difficulty > 0 && placement < 25 ? highest
        : difficulty > 0 && placement >= 75 ? lowest : Phaser.Math.Between(highest, lowest);
      const upperEnd = center - gap / 2;
      const lowerStart = center + gap / 2;
      const horizontal = this.width + 45;
      const top = this.pipes.create(horizontal, (upperEnd - 26) / 2, 'pipe').setDisplaySize(70, upperEnd - 26);
      const bottom = this.pipes.create(horizontal, (lowerStart + 26 + this.floor) / 2, 'pipe').setDisplaySize(70, this.floor - lowerStart - 26);
      const topCap = this.pipes.create(horizontal, upperEnd - 13, 'cap').setFlipY(true);
      const bottomCap = this.pipes.create(horizontal, lowerStart + 13, 'cap');
      const bodies = [top, bottom, topCap, bottomCap];
      bodies.forEach((pipe) => {
        pipe.body.updateFromGameObject();
        pipe.body.reset(pipe.x, pipe.y);
        pipe.setDepth(4);
        pipe.setVelocityX(-PIPE_SPEED);
      });
      this.pairs.push({ bodies, passed: false, center, gap });
    }

    die() {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.diedAt = this.time.now;
      this.physics.pause();
      this.bird.anims.pause();
      playSound(sounds.die);
      saveBest(this.score);
      this.syncUI();
      element('announcement').textContent = `Gameover. Score ${this.score}. Best ${best}.`;
    }

    reset() {
      saveBest(this.score);
      element('announcement').textContent = '';
      this.pipes.clear(true, true);
      this.pairs = [];
      this.score = 0;
      this.state = 'ready';
      this.bird.setPosition(Math.min(200, this.width * 0.26), this.height * 0.26).setAngle(0);
      this.bird.body.reset(this.bird.x, this.bird.y);
      this.bird.setGravityY(0);
      this.bird.body.allowGravity = false;
      this.bird.play('wing-flap');
      this.physics.resume();
      this.syncUI();
    }

    togglePause() {
      if (this.state === 'playing') {
        this.spawnProgress = this.time.now - this.lastSpawn;
        saveBest(this.score);
        this.state = 'paused';
        this.physics.pause();
        this.bird.anims.pause();
      }
      else if (this.state === 'paused') {
        this.state = 'playing';
        this.physics.resume();
        this.bird.anims.resume();
        this.lastSpawn = this.time.now - this.spawnProgress;
      }
      else return;
      this.syncUI();
    }

    syncUI() {
      document.body.dataset.state = this.state;
      element('score').textContent = this.score;
      element('best').textContent = String(best).padStart(2, '0');
      element('overlay').hidden = this.state === 'playing';
      element('pause').disabled = !['playing', 'paused'].includes(this.state);
      element('pause').setAttribute('aria-label', this.state === 'paused' ? 'Hervatten' : 'Pauzeren');
      element('pause').title = this.state === 'paused' ? 'Hervatten (P)' : 'Pauzeren (P)';
      element('pause').innerHTML = `<i data-lucide="${this.state === 'paused' ? 'play' : 'pause'}"></i>`;
      element('result').hidden = this.state !== 'over';
      const medal = MEDALS.findLast(medal => this.score >= medal.score);
      element('medals').hidden = this.state !== 'over' || !medal;
      element('medals').innerHTML = this.state === 'over' && medal
        ? `<li data-level="${medal.name}" aria-label="Medaille ${medal.name} behaald">
          <i data-lucide="medal" aria-hidden="true"></i><span>${medal.name}</span></li>` : '';
      const labels = {
        ready: ['KLAAR VOOR DE START?', 'Vleugels uit.<br>Daar gaan we.', 'Spelen', 'Klaar voor vertrek'],
        playing: ['', '', '', 'Lekker aan het vliegen'],
        paused: ['EVEN OP ADEM KOMEN', 'Kleine vliegpauze.', 'Verder spelen', 'Gepauzeerd'],
        over: ['', 'Gameover', 'Opnieuw spelen', 'Klaar voor een nieuwe poging'],
      };
      const [tag, title, button, status] = labels[this.state];
      element('overlay-tag').hidden = !tag;
      element('overlay-tag').textContent = tag;
      element('overlay-title').innerHTML = title;
      element('start').innerHTML = `<i data-lucide="${this.state === 'over' ? 'rotate-ccw' : 'play'}"></i><span>${button}</span>`;
      element('status').textContent = status;
      element('final-score').textContent = this.score;
      element('final-best').textContent = best;
      icons();
    }

    update(time, delta) {
      if (this.state === 'paused' || this.state === 'over') return;
      this.clouds.forEach((cloud) => {
        cloud.x -= delta * 0.009;
        if (cloud.x < -120) cloud.x = this.width + 120;
      });
      this.ground.tilePositionX += delta * (this.state === 'playing' ? PIPE_SPEED / 1000 : 0.025);
      if (this.state === 'ready') {
        this.bird.body.reset(Math.min(200, this.width * 0.26), this.height * 0.26 + Math.sin(time / 240) * 7);
        return;
      }
      if (this.bird.body.bottom >= this.floor || this.bird.body.top <= 0) { this.die(); return; }
      this.spawnProgress = time - this.lastSpawn;
      const previousPair = this.pairs.at(-1);
      const spaceForPipe = !previousPair || previousPair.bodies[0].x <= this.width + 45 - PIPE_SPACING;
      if (this.spawnProgress >= PIPE_SPACING / PIPE_SPEED * 1000 && spaceForPipe) { this.spawnPair(); this.lastSpawn = time; }
      this.pairs = this.pairs.filter((pair) => {
        if (!pair.passed && pair.bodies[0].x + 39 < this.bird.body.left) {
          pair.passed = true;
          this.score++;
          element('score').textContent = this.score;
          playSound(sounds.coin);
        }
        if (pair.bodies[0].x < -60) { pair.bodies.forEach((pipe) => pipe.destroy()); return false; }
        return true;
      });
    }
  }

  function syncSound() {
    element('sound').setAttribute('aria-pressed', String(sound));
    element('sound').setAttribute('aria-label', sound ? 'Geluid uitschakelen' : 'Geluid inschakelen');
    element('sound').title = sound ? 'Geluid uitschakelen' : 'Geluid inschakelen';
    element('sound').innerHTML = `<i data-lucide="${sound ? 'volume-2' : 'volume-x'}"></i>`;
    icons();
  }
  syncSound();

  element('sound').onclick = () => {
    sound = !sound;
    try { localStorage.setItem('flappy-sound', sound ? 'on' : 'off'); } catch {}
    syncSound();
    element('stage').focus({ preventScroll: true });
  };

  window.flappyGame = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'stage',
    pixelArt: true,
    backgroundColor: '#bce4dc',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 440, height: 540 },
    physics: { default: 'arcade', arcade: { gravity: { y: 1500 }, fixedStep: false, debug: false } },
    scene: Flight,
    audio: { noAudio: true },
    // Taps are read directly on the stage; Phaser's own touch handlers would block the browser on every tap.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    // Phaser's default caps frame time for the first 120 frames, which runs slow devices in slow motion.
    fps: { panicMax: 0 },
  });
})();