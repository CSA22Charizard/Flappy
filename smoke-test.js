/* global Phaser */
window.runFlappySmokeTest = () => {
  const scene = window.flappyGame.scene.getScene('Flight');
  const results = [];
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
    results.push(label);
  };
  const savedBest = localStorage.getItem('flappy-best');
  const savedSound = localStorage.getItem('flappy-sound');
  const savedRandom = Phaser.Math.RND.state();
  try {
    scene.reset();
    scene.update(scene.time.now, 0);
    const idlePosition = { x: scene.bird.x, y: scene.bird.y };
    scene.flap();
    check(scene.bird.x === idlePosition.x && scene.bird.y === idlePosition.y, 'Start preserves the visible idle position');
    scene.physics.world.update(scene.time.now, 1000 / 60);
    scene.physics.world.postUpdate();
    check(scene.bird.x === idlePosition.x && scene.bird.y < idlePosition.y && scene.bird.y > idlePosition.y - 6, 'First flight frame moves immediately without a teleport');
    check(scene.state === 'playing' && scene.bird.body.velocity.y < 0, 'Start and upward flap');
    check(scene.pairs.length === 1 && scene.pipes.countActive() === 4, 'Initial pipe pair');
    const wingFrames = new Set([scene.bird.texture.key]);
    for (let frame = 0; frame < 4; frame++) {
      scene.bird.anims.update(scene.time.now + frame * 100, 100);
      wingFrames.add(scene.bird.texture.key);
    }
    check(wingFrames.size === 3, 'Wing animation cycles through three poses');
    check(scene.bird.displayWidth === 44 && scene.bird.displayHeight === 32
      && scene.bird.body.width === 27 && scene.bird.body.height === 23, 'Wing animation preserves sprite size and hitbox');
    check(scene.textures.getPixel(2, 6, 'bird-up').alpha === 255
      && scene.textures.getPixel(2, 6, 'bird').alpha === 0
      && scene.textures.getPixel(2, 25, 'bird-down').alpha === 255, 'Wing poses contain different pixels');
    const startingBird = scene.bird;
    const startingPair = scene.pairs[0];
    scene.scale.refresh();
    window.flappyGame.scene.processQueue();
    check(scene.state === 'playing' && scene.bird === startingBird && scene.pairs[0] === startingPair, 'Resizing preserves the running round');
    check(scene.width === 440 && scene.height === 540, 'Fixed logical playfield across screen sizes');
    scene.spawnProgress = undefined;
    scene.togglePause();
    check(scene.state === 'paused' && scene.physics.world.isPaused, 'Pause physics');
    const pausedWing = scene.bird.texture.key;
    scene.bird.anims.update(scene.time.now, 250);
    check(scene.bird.anims.isPaused && scene.bird.texture.key === pausedWing, 'Pause freezes wing animation');
    scene.togglePause();
    check(scene.state === 'playing' && Number.isFinite(scene.lastSpawn), 'Immediate resume preserves timer');
    check(!scene.bird.anims.isPaused && scene.bird.anims.isPlaying, 'Resume continues wing animation');

    const pair = scene.pairs[0];
    pair.bodies.forEach((pipe) => { pipe.x = scene.bird.body.left - 45; });
    scene.update(scene.time.now, 0);
    check(scene.score === 1, 'Passed pipe adds one point');
    scene.update(scene.time.now, 0);
    check(scene.score === 1, 'Pipe cannot score twice');
    check(document.getElementById('score').textContent === '1', 'Visible score');

    scene.bird.body.reset(scene.bird.x, scene.floor + 5);
    scene.update(scene.time.now, 0);
    check(scene.state === 'over' && scene.physics.world.isPaused, 'Ground collision ends round');
    check(scene.bird.anims.isPaused, 'Gameover freezes wing animation');
    check(Number(localStorage.getItem('flappy-best')) >= 1, 'Record persisted');
    check(!document.getElementById('result').hidden, 'Results shown');
    check(document.getElementById('overlay-title').textContent === 'Gameover', 'Gameover heading');
    check(document.getElementById('final-score').textContent === '1'
      && document.getElementById('final-best').textContent === document.getElementById('best').textContent.replace(/^0+(?=\d)/, '')
      && document.getElementById('result').textContent.includes('Best'), 'Score and Best shown on death');

    document.getElementById('start').click();
    check(scene.state === 'playing' && scene.score === 0 && scene.bird.body.velocity.y === -350, 'Gameover button restarts immediately without cooldown');

    scene.reset(); scene.flap();
    scene.bird.body.reset(scene.bird.x, -30);
    scene.update(scene.time.now, 0);
    check(scene.state === 'over', 'Ceiling collision ends round');

    scene.reset(); scene.flap();
    const pipe = scene.pairs[0].bodies[0];
    pipe.setPosition(scene.bird.x, scene.bird.y);
    pipe.body.updateFromGameObject();
    scene.physics.world.step(1 / 60);
    check(scene.state === 'over', 'Arcade pipe overlap ends round');

    scene.reset();
    check(scene.state === 'ready' && scene.score === 0 && scene.pairs.length === 0 && scene.pipes.countActive() === 0, 'Restart clears round');
    check(!scene.physics.world.isPaused, 'Restart resumes physics');
    check(scene.bird.anims.isPlaying && !scene.bird.anims.isPaused, 'Restart resumes wing animation');

    scene.reset();
    const canvas = document.querySelector('#stage canvas');
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    check(scene.state === 'playing' && scene.bird.body.velocity.y === -350, 'Tap on the playfield flaps');
    check(!window.flappyGame.input.touch && !window.flappyGame.input.mouse, 'No blocking Phaser touch handlers');
    scene.bird.anims.update(scene.time.now, 100);
    const wingFrame = scene.bird.anims.currentFrame.index;
    const audioPrototype = globalThis.BaseAudioContext?.prototype ?? {};
    const createOscillator = audioPrototype.createOscillator;
    let oscillators = 0;
    audioPrototype.createOscillator = function (...args) { oscillators++; return createOscillator.apply(this, args); };
    try { canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } finally { audioPrototype.createOscillator = createOscillator; }
    check(wingFrame !== 1 && scene.bird.anims.currentFrame.index === wingFrame, 'Flap keeps the wing animation running');
    check(oscillators === 0, 'Flap sound uses a prepared buffer');
    scene.reset();

    const record = Number(document.getElementById('final-best').textContent) + 5;
    scene.flap();
    scene.score = record;
    document.getElementById('restart').click();
    check(Number(localStorage.getItem('flappy-best')) === record && document.getElementById('final-best').textContent === String(record), 'Restarting mid-round keeps a new record');
    scene.reset(); scene.flap();
    scene.score = record + 1;
    scene.togglePause();
    check(Number(localStorage.getItem('flappy-best')) === record + 1, 'Pausing saves a new record');
    scene.togglePause();
    scene.score = record + 2;
    window.dispatchEvent(new Event('pagehide'));
    check(Number(localStorage.getItem('flappy-best')) === record + 2, 'Leaving the page saves a new record');
    scene.die();
    check(document.getElementById('announcement').textContent !== '', 'Gameover is announced');
    scene.reset();
    check(document.getElementById('announcement').textContent === '', 'Reset clears the announcement so the next Gameover is read again');

    const soundButton = document.getElementById('sound');
    const soundBefore = soundButton.getAttribute('aria-pressed');
    soundButton.focus();
    soundButton.click();
    check(document.activeElement === document.getElementById('stage'), 'Sound button returns focus to the playfield');
    check(soundButton.getAttribute('aria-pressed') !== soundBefore && localStorage.getItem('flappy-sound') === (soundBefore === 'true' ? 'off' : 'on'), 'Sound setting is remembered');
    soundButton.click();
    check(soundButton.getAttribute('aria-pressed') === soundBefore, 'Sound toggles back');

    check(window.flappyGame.loop.panicMax === 0, 'No frame-time cap after load');

    for (const [score, expected] of [[0, null], [1, 'Easy'], [9, 'Easy'], [10, 'Medium'], [19, 'Medium'], [20, 'Hard'], [29, 'Hard'], [30, 'Expert'], [39, 'Expert'], [40, 'Master'], [100, 'Master']]) {
      scene.score = score;
      scene.state = 'over';
      scene.syncUI();
      check(document.getElementById('medals').hidden === !expected
        && document.querySelectorAll('#medals li').length === (expected ? 1 : 0)
        && (document.querySelector('#medals li')?.dataset.level ?? null) === expected
        && (!expected || document.querySelector('#medals li').getAttribute('aria-label') === `Medaille ${expected} behaald`), `Score ${score}: highest medal only`);
    }
    for (const [threshold, name] of [[1, 'Easy'], [10, 'Medium'], [20, 'Hard'], [30, 'Expert'], [40, 'Master']]) {
      scene.reset(); scene.flap();
      scene.score = threshold - 1;
      scene.pairs[0].bodies.forEach(pipe => { pipe.x = scene.bird.body.left - 45; });
      scene.update(scene.time.now, 0);
      check(scene.score === threshold && !document.getElementById('medal-toast')
        && document.getElementById('medals').hidden, `${name}: no in-game medal popup`);
      scene.reset();
      check(document.getElementById('medals').hidden, `${name}: medal UI clears for next round`);
    }

    scene.flap();
    check(scene.bird.body.velocity.y === -350, 'Stronger flap preserves height with less float');
    const startHeight = scene.bird.body.y;
    let peakRise = 0;
    let fallingFrame;
    for (let frame = 0; frame < 28; frame++) {
      scene.physics.world.step(1 / 60);
      peakRise = Math.max(peakRise, startHeight - scene.bird.body.y);
      if (scene.bird.body.velocity.y <= 0) {
        if (scene.bird.angle !== -22) throw new Error('Bird tilts down before falling');
      } else if (fallingFrame === undefined) {
        fallingFrame = frame + 1;
        check(scene.bird.angle > -22 && scene.bird.angle < 10, 'Downward tilt starts smoothly after falling begins');
        check(scene.bird.body.gravity.y === 0, 'Full drop gravity restored after rising');
      }
    }
    check(peakRise > 52 && peakRise < 54, 'Jump retains about 53 pixels of height');
    check(fallingFrame === 20, 'Shorter upward arc without lingering at the apex');
    scene.bird.setVelocityY(0);
    scene.updateFlight(1 / 60);
    check(scene.bird.angle === -22, 'No nose-down animation at the apex');
    scene.physics.world.step(1 / 60);
    check(Math.abs(scene.bird.body.velocity.y - 25 * Math.exp(2.5 / 60)) < 0.01, 'Exponential boost during descent');
    const fallSpeeds = [scene.bird.body.velocity.y];
    for (let frame = 0; frame < 40; frame++) {
      scene.physics.world.step(1 / 60);
      fallSpeeds.push(scene.bird.body.velocity.y);
    }
    check(fallSpeeds[10] - fallSpeeds[9] > fallSpeeds[1] - fallSpeeds[0], 'Downward speed gains grow exponentially');
    check(fallSpeeds.at(-1) === 900 && fallSpeeds.every(speed => speed <= 900), 'Fall speed capped at 900 pixels per second');
    scene.togglePause();
    scene.updateFlight(0.1);
    check(scene.bird.body.velocity.y === 900, 'Pause freezes exponential falling');
    scene.togglePause();
    scene.flap();
    check(scene.bird.body.velocity.y === -350 && scene.bird.body.gravity.y === -400, 'Flap immediately resets exponential drop');
    scene.reset();
    check(scene.bird.angle === 0 && scene.bird.body.gravity.y === 0, 'Reset clears flight tilt and gravity offset');
    check(scene.width <= 440, 'Narrow playfield');
    for (const durations of [[1000 / 60], [15, 1000 / 30 - 15], [1000 / 120], [1000 / 144]]) {
      scene.reset(); scene.flap();
      const movingPipe = scene.pairs[0].bodies[0];
      let continuousMotion = true;
      for (let frame = 0; frame < 24; frame++) {
        const duration = durations[frame % durations.length];
        const previousPosition = movingPipe.x;
        scene.physics.world.update(scene.time.now + frame * duration, duration);
        scene.physics.world.postUpdate();
        continuousMotion &&= Math.abs(previousPosition - movingPipe.x - 220 * duration / 1000) < 0.01;
      }
      check(continuousMotion, `Frame timings ${durations.join(', ')}: continuous pipe movement`);
    }
    for (const frameDuration of [1000 / 60, 100]) {
      scene.reset(); scene.flap();
      check(scene.pairs[0].bodies.every(pipe => pipe.body.velocity.x === -220), `Frame duration ${frameDuration}: faster pipe speed`);
      let now = scene.time.now;
      let mostVisible = 0;
      let shortestSpacing = Infinity;
      let firstSpawnDelay;
      for (let frame = 0; frame < 900; frame++) {
        now += frameDuration;
        scene.pairs.forEach(pair => pair.bodies.forEach(pipe => { pipe.x += pipe.body.velocity.x / 60; }));
        scene.update(now, 1000 / 60);
        if (firstSpawnDelay === undefined && scene.pairs.length > 1) firstSpawnDelay = now - scene.time.now;
        for (let index = 1; index < scene.pairs.length; index++) {
          shortestSpacing = Math.min(shortestSpacing, scene.pairs[index].bodies[0].x - scene.pairs[index - 1].bodies[0].x);
        }
        const visible = scene.pairs.filter(pair => pair.bodies[2].getBounds().right > 0 && pair.bodies[2].getBounds().left < scene.width).length;
        mostVisible = Math.max(mostVisible, visible);
        if (visible > 3) throw new Error('More than three pipe pairs visible');
      }
      check(mostVisible === 3, `Frame duration ${frameDuration}: third pair only peeks in at the edge`);
      check(shortestSpacing >= 240 && shortestSpacing < 244, `Frame duration ${frameDuration}: closer pipe spacing`);
      if (frameDuration < 20) check(firstSpawnDelay >= 1090 && firstSpawnDelay <= 1110, 'Next pipe arrives in about 1.09 seconds');
    }

    Phaser.Math.RND.sow(['flappy-difficulty']);
    const bands = [
      [0, 150, 160], [9, 150, 160],
      [10, 134, 144], [19, 134, 144],
      [20, 118, 128], [29, 118, 128],
      [30, 106, 116], [39, 106, 116],
      [40, 96, 104], [100, 96, 104],
    ];
    for (const [score, minimumGap, maximumGap] of bands) {
      scene.reset();
      scene.score = score;
      const gaps = [];
      const centers = [];
      for (let index = 0; index < 100; index++) {
        const previousCenter = scene.pairs.at(-1)?.center ?? scene.bird.y;
        scene.spawnPair();
        const pair = scene.pairs.at(-1);
        const [top, bottom, topCap, bottomCap] = pair.bodies;
        const near = (first, second) => Math.abs(first - second) < 0.01;
        if (!near(top.getBounds().bottom, topCap.getBounds().top)
          || !near(bottom.getBounds().top, bottomCap.getBounds().bottom)
          || !near(bottomCap.getBounds().top - topCap.getBounds().bottom, pair.gap)) {
          throw new Error('Pipe stems and caps must match the playable gap');
        }
        if (top.displayHeight <= 0 || bottom.displayHeight <= 0 || !topCap.flipY
          || pair.gap < minimumGap || pair.gap > maximumGap || Math.abs(pair.center - previousCenter) > 140) {
          throw new Error('Unsafe pipe geometry or height transition');
        }
        gaps.push(pair.gap);
        centers.push(pair.center);
      }
      check(gaps.every(gap => gap >= minimumGap && gap <= maximumGap), `Score ${score}: correct difficulty band`);
      check(new Set(gaps).size > 1, `Score ${score}: gap variation within band`);
      if (score >= 30) check(Math.min(...centers) < 135 && Math.max(...centers) > scene.floor - 135, `Score ${score}: high and low openings`);
      const positions = scene.pairs[0].bodies.map(pipe => pipe.y);
      scene.physics.world.step(1 / 60);
      scene.physics.world.postUpdate();
      check(scene.pairs[0].bodies.every((pipe, index) => Math.abs(pipe.y - positions[index]) < 0.01), `Score ${score}: pipe alignment survives physics`);
      const top = scene.pairs[0].bodies[0];
      const renderer = scene.game.renderer;
      const context = renderer.currentContext;
      const drawImage = context.drawImage;
      let renderedHeight;
      try {
        context.drawImage = (...args) => { renderedHeight = args[8]; };
        renderer.batchSprite(top, top.frame, scene.cameras.main);
      } finally {
        context.drawImage = drawImage;
      }
      check(Math.abs(renderedHeight * top.scaleY - top.displayHeight) < 0.01, `Score ${score}: rendered pipe matches collision height`);

      const narrowest = scene.pairs.find(pair => pair.gap === minimumGap);
      check(Boolean(narrowest), `Score ${score}: minimum gap sampled`);
      scene.pairs.filter(pair => pair !== narrowest).forEach(pair => pair.bodies.forEach(pipe => pipe.destroy()));
      scene.pairs = [narrowest];
      for (const fps of [30, 60, 90, 120, 144]) {
        narrowest.bodies.forEach(pipe => {
          pipe.body.reset(scene.bird.x + 140, pipe.y);
          pipe.setVelocityX(-220);
        });
        narrowest.passed = false;
        scene.score = score;
        scene.state = 'playing';
        scene.lastSpawn = scene.time.now;
        scene.bird.body.reset(scene.bird.x, narrowest.center + 20);
        scene.bird.setGravityY(0);
        scene.bird.body.allowGravity = true;
        for (let frame = 0; frame < Math.ceil(fps * 1.5) && !narrowest.passed && scene.state === 'playing'; frame++) {
          if (scene.bird.body.center.y > narrowest.center + 20 && scene.bird.body.velocity.y >= 0) scene.flap();
          const now = scene.time.now + frame * 1000 / fps;
          scene.physics.world.update(now, 1000 / fps);
          scene.physics.world.postUpdate();
          scene.update(now, 1000 / fps);
        }
        check(scene.state === 'playing' && narrowest.passed, `Score ${score}, ${fps} FPS: timed flaps clear the narrowest gap`);
      }
    }
    return results;
  } finally {
    scene.reset();
    Phaser.Math.RND.state(savedRandom);
    if (savedBest === null) localStorage.removeItem('flappy-best');
    else localStorage.setItem('flappy-best', savedBest);
    if (savedSound === null) localStorage.removeItem('flappy-sound');
    else localStorage.setItem('flappy-sound', savedSound);
  }
};