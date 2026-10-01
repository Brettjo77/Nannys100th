(() => {
  const HIGHLIGHTS = [
    // file, left %, top %, width % (of the hero scatter box)
    ['075.jpg', 0, 4, 58],
    ['090.jpg', 62, 0, 36],
    ['040.jpg', 30, 52, 52],
    ['014.jpg', 2, 66, 30],
  ];
  const SLIDE_MS = 4500;

  const scatterEl = document.getElementById('scatter');
  const heroEl = document.querySelector('.hero-scatter');
  const lb = document.getElementById('lightbox');
  const lbImg = lb.querySelector('.lb-img');
  const lbCount = lb.querySelector('.lb-count');
  const lbPlay = lb.querySelector('[data-lb="play"]');
  const lbDownload = lb.querySelector('[data-lb="download"]');
  const menu = document.getElementById('menu');
  const navToggle = document.querySelector('.nav-toggle');

  let photos = [];
  let order = [];
  let seed = 100;
  let columns = 0;
  let current = 0;
  let timer = null;

  // Small deterministic PRNG so the scatter is stable until shuffled.
  function rng(s) {
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Soft corners: up to 160px, but never more than a fifth of the frame's short side.
  const radiusObserver = new ResizeObserver(entries => {
    for (const e of entries) {
      const { width, height } = e.contentRect;
      e.target.style.setProperty('--r', Math.min(160, Math.min(width, height) * 0.2) + 'px');
    }
  });

  const revealObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -40px 0px' });

  function makeFrame(photo, eager = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'frame';
    btn.setAttribute('aria-label', `Open photo ${photos.indexOf(photo) + 1} of ${photos.length}`);
    btn.style.aspectRatio = `${photo.w} / ${photo.h}`;
    const img = document.createElement('img');
    img.src = `images/thumb/${photo.file}`;
    img.alt = '';
    img.width = photo.w;
    img.height = photo.h;
    img.decoding = 'async';
    if (!eager) img.loading = 'lazy';
    btn.appendChild(img);
    btn.addEventListener('click', () => open(order.indexOf(photo)));
    radiusObserver.observe(btn);
    revealObserver.observe(btn);
    return btn;
  }

  function columnCount() {
    const w = window.innerWidth;
    return w >= 1400 ? 4 : w >= 900 ? 3 : 2;
  }

  function renderScatter() {
    columns = columnCount();
    const rand = rng(seed);
    const cols = Array.from({ length: columns }, () => {
      const el = document.createElement('div');
      el.className = 'scatter-col';
      return { el, height: 0 };
    });

    order.forEach((photo, i) => {
      const widthPct = columns === 2 ? 82 + rand() * 18 : 68 + rand() * 32;
      const xPct = rand() * (100 - widthPct);
      const yPx = (rand() < 0.25 ? 48 + rand() * 72 : 15 + rand() * 33) * (columns === 2 ? 0.6 : 1);
      const frame = makeFrame(photo);
      frame.style.setProperty('--w', widthPct + '%');
      frame.style.setProperty('--x', xPct + '%');
      frame.style.setProperty('--y', (i < columns ? rand() * 48 : yPx) + 'px');

      // Masonry: drop each photo into the shortest column to keep the order roughly left-to-right.
      const target = cols.reduce((a, b) => (b.height < a.height ? b : a));
      target.el.appendChild(frame);
      target.height += (widthPct / 100) * (photo.h / photo.w) + yPx / 300;
    });

    scatterEl.replaceChildren(...cols.map(c => c.el));
  }

  function renderHero() {
    const byFile = new Map(photos.map(p => [p.file, p]));
    for (const [file, left, top, width] of HIGHLIGHTS) {
      const photo = byFile.get(file);
      if (!photo) continue;
      const frame = makeFrame(photo, true);
      frame.style.left = left + '%';
      frame.style.top = top + '%';
      frame.style.width = width + '%';
      heroEl.appendChild(frame);
    }
  }

  // A moving strip of every 4th photo, drawn twice so the loop is seamless.
  function renderCarousel() {
    const track = document.querySelector('.carousel-track');
    const picks = photos.filter((_, i) => i % 4 === 0);
    const frames = picks.map(p => makeFrame(p, true));
    const copies = picks.map(p => {
      const f = makeFrame(p, true);
      f.tabIndex = -1;
      f.setAttribute('aria-hidden', 'true');
      return f;
    });
    track.replaceChildren(...frames, ...copies);
    track.style.setProperty('--duration', picks.length * 5 + 's');
  }

  /* ---------- Lightbox ---------- */
  function show(i) {
    current = (i + order.length) % order.length;
    const photo = order[current];
    lbImg.classList.add('loading');
    lbImg.onload = () => lbImg.classList.remove('loading');
    lbImg.src = `images/full/${photo.file}`;
    lbImg.alt = `Photo ${current + 1} from Nanny Johnson's 100th birthday`;
    lbCount.textContent = `${current + 1} / ${order.length}`;
    lbDownload.href = `images/full/${photo.file}`;
    lbDownload.setAttribute('download', `Nanny-Johnson-100th-${photo.file}`);
    // Warm the cache for the neighbours so next/prev feels instant.
    [1, -1].forEach(d => { new Image().src = `images/full/${order[(current + d + order.length) % order.length].file}`; });
  }

  function open(i, autoplay = false) {
    lb.hidden = false;
    document.body.classList.add('locked');
    show(Math.max(0, i));
    autoplay ? play() : stop();
    lb.querySelector('[data-lb="close"]').focus();
  }

  function close() {
    stop();
    lb.hidden = true;
    document.body.classList.remove('locked');
  }

  function play() {
    stop();
    timer = setInterval(() => show(current + 1), SLIDE_MS);
    lbPlay.textContent = 'Pause';
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    lbPlay.textContent = 'Play';
  }

  lb.addEventListener('click', e => {
    const action = e.target.closest('[data-lb]')?.dataset.lb;
    if (action === 'prev') { stop(); show(current - 1); }
    if (action === 'next') { stop(); show(current + 1); }
    if (action === 'play') timer ? stop() : play();
    if (action === 'close') close();
    if (e.target === lb || e.target.classList.contains('lb-stage')) close();
  });

  document.addEventListener('keydown', e => {
    if (!lb.hidden) {
      if (e.key === 'ArrowRight') { stop(); show(current + 1); }
      if (e.key === 'ArrowLeft') { stop(); show(current - 1); }
      if (e.key === ' ') { e.preventDefault(); timer ? stop() : play(); }
      if (e.key === 'Escape') close();
    } else if (e.key === 'Escape' && !menu.hidden) {
      toggleMenu(false);
    }
  });

  let touchX = null;
  lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { stop(); show(current + (dx < 0 ? 1 : -1)); }
    touchX = null;
  });

  /* ---------- Menu ---------- */
  function toggleMenu(force) {
    const opening = force ?? menu.hidden;
    menu.hidden = !opening;
    navToggle.setAttribute('aria-expanded', String(opening));
    navToggle.querySelector('.nav-label').textContent = opening ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', opening);
    document.body.classList.toggle('locked', opening);
  }
  navToggle.addEventListener('click', () => toggleMenu());
  menu.addEventListener('click', e => { if (e.target.closest('[data-close]')) toggleMenu(false); });

  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (!menu.hidden) toggleMenu(false);
    if (action === 'slideshow') open(0, true);
    if (action === 'shuffle') {
      seed = Math.floor(Math.random() * 1e9);
      const rand = rng(seed);
      order = order.map(p => [rand(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
      renderScatter();
      document.getElementById('gallery').scrollIntoView();
    }
  });

  let resizeRaf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { if (columnCount() !== columns) renderScatter(); });
  });

  fetch('photos.json')
    .then(r => r.json())
    .then(data => {
      photos = data;
      order = photos.slice();
      document.querySelectorAll('[data-count]').forEach(el => { el.textContent = photos.length; });
      renderCarousel();
      renderHero();
      renderScatter();
    })
    .catch(() => {
      scatterEl.textContent = 'The photographs could not be loaded. Please refresh the page.';
    });
})();
