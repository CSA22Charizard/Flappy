(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const MODES = [['', 'A Normal'], ['noclick', 'F No click'], ['nogesture', 'G No touch gestures'], ['canvasonly', 'H Canvas only']];
  if (params.has('canvasonly')) document.head.insertAdjacentHTML('beforeend', '<style>.masthead,.game-heading,.game-hud,.scene-label,.game-toolbar{visibility:hidden}</style>');
  const current = MODES.find(([key]) => key && params.has(key)) ?? MODES[0];
  const panel = document.getElementById('lab-panel');
  const links = MODES.map(([key, name]) => `<a href="./${key ? `?${key}` : ''}" style="display:inline-block;margin:0 6px 6px 0;padding:6px 8px;border:1px solid #123722;border-radius:5px;color:#123722;text-decoration:none;${key === current[0] ? 'background:#ffdb00;font-weight:bold' : ''}">${name}</a>`).join('');
  panel.innerHTML = `<div>${links}</div><div id="lab-out">Tap Spelen, then tap about 30 times.</div>`;
  const out = document.getElementById('lab-out');
  const tapFrames = []; const otherFrames = []; const handler = []; const inputDelay = [];
  let tapAt = -1000; let releaseAt = -1000; let taps = 0; let previous = 0; let scene;
  let tapCounted = true; let tapsWithDrop = 0; let droppedBetween = 0; const afterPress = []; const afterRelease = [];
  const pct = (list, p) => { if (!list.length) return 0; const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const f = (n) => n.toFixed(1);
  const stage = document.getElementById('stage');
  stage.addEventListener('pointerdown', (event) => {
    if (scene?.state !== 'playing') return;
    taps++; tapAt = performance.now(); tapCounted = false;
    inputDelay.push(tapAt - event.timeStamp);
  }, { capture: true, passive: true });
  stage.addEventListener('touchend', () => { releaseAt = performance.now(); }, { capture: true, passive: true });
  const attach = () => {
    scene = window.flappyGame?.scene.getScene('Flight');
    if (!scene?.bird) { setTimeout(attach, 100); return; }
    scene.die = () => {};
    const flap = scene.flap.bind(scene);
    scene.flap = () => { const a = performance.now(); flap(); handler.push(performance.now() - a); };
    const tick = (now) => {
      if (scene.state === 'playing') {
        if (previous) {
          const afterTap = now - tapAt < 120;
          (afterTap ? tapFrames : otherFrames).push(now - previous);
          if (now - previous > 25) {
            if (afterTap) {
              const at = performance.now();
              afterPress.push(at - tapAt);
              if (releaseAt >= tapAt) afterRelease.push(at - releaseAt);
              if (!tapCounted) { tapCounted = true; tapsWithDrop++; }
            } else droppedBetween++;
          }
        }
        previous = now;
        if (scene.bird.y < 50 || scene.bird.y > 440) scene.bird.body.reset(scene.bird.x, 240);
      } else previous = 0;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setInterval(() => {
      if (!otherFrames.length) return;
      out.innerHTML = `<b>${current[1]}</b> | renderer ${window.flappyGame.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'} | taps ${taps}<br>`
        + `Between taps: typical ${f(pct(otherFrames, .5))} ms, slow ${f(pct(otherFrames, .95))} ms, worst ${f(Math.max(...otherFrames))} ms<br>`
        + `After a tap: typical ${f(pct(tapFrames, .5))} ms, slow ${f(pct(tapFrames, .95))} ms, worst ${f(tapFrames.length ? Math.max(...tapFrames) : 0)} ms<br>`
        + `Flap code: ${f(pct(handler, .5))} ms, worst ${f(handler.length ? Math.max(...handler) : 0)} ms | Tap delay: ${f(pct(inputDelay, .5))} ms<br>`
        + `<b>Taps with a dropped frame: ${tapsWithDrop} of ${taps}</b> | Drops between taps: ${droppedBetween}<br>`
        + `Drop comes ${f(pct(afterPress, .5))} ms after press, ${f(pct(afterRelease, .5))} ms after release`;
    }, 500);
  };
  attach();
})();
