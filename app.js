(() => {
  // Hero highlights: photo number, left %, top %, width %, rotation
  const HIGHLIGHTS = [
    [75, 0, 6, 56, -2.5],
    [90, 61, 0, 37, 2],
    [40, 30, 50, 52, 1.2],
    [14, 3, 64, 30, -3],
  ];
  const SLIDE_MS = 5000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const phoneViewer = matchMedia('(max-width: 700px), (max-height: 500px)');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const lb = $('#lightbox');
  const lbPrint = $('.lb-print', lb);
  const lbImg = $('.lb-img', lb);
  const lbCount = $('.lb-count', lb);
  const lbChapter = $('.lb-chapter', lb);
  const lbPlay = $('[data-lb="play"]', lb);
  const lbDownload = $('[data-lb="download"]', lb);
  const lbProgress = $('.lb-progress', lb);
  const lbThumbs = $('.lb-thumbs', lb);
  const menu = $('#menu');
  const navToggle = $('.nav-toggle');

  let photos = [];   // everything, in file order
  let chapters = []; // [{id, title, blurb, photos: [photo]}]
  let order = [];    // lightbox order: chapter by chapter
  let columns = 0;
  let current = 0;
  let timer = null;
  let lastFocus = null;

  // Small deterministic PRNG so the scatter looks the same on every visit.
  function rng(s) {
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const num = photo => parseInt(photo.file, 10);

  /* ---------- Reveal on scroll ---------- */
  const revealObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  function image(photo, eager) {
    const img = document.createElement('img');
    img.src = `images/thumb/${photo.file}`;
    img.alt = '';
    img.width = photo.w;
    img.height = photo.h;
    img.decoding = 'async';
    if (!eager) img.loading = 'lazy';
    return img;
  }

  // A clickable vintage print.
  function makePrint(photo, eager = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'frame';
    btn.dataset.photo = num(photo);
    btn.setAttribute('aria-label', `Open photo ${order.indexOf(photo) + 1} of ${order.length}`);
    const paper = document.createElement('div');
    paper.className = 'print';
    paper.style.setProperty('--ph', photo.c);
    paper.appendChild(image(photo, eager));
    btn.appendChild(paper);
    revealObserver.observe(btn);
    return btn;
  }

  /* ---------- Film strip carousel ---------- */
  const carousel = { x: 0, speed: 0, boost: 0, half: 0, hover: false };

  function renderCarousel() {
    const track = $('.carousel-track');
    const picks = order.filter((_, i) => i % 3 === 0);
    const film = (photo, hidden) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'film';
      b.dataset.photo = num(photo);
      b.style.setProperty('--ph', photo.c);
      if (hidden) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
      else b.setAttribute('aria-label', `Open photo ${order.indexOf(photo) + 1}`);
      b.appendChild(image(photo, !hidden));
      return b;
    };
    track.replaceChildren(...picks.map(p => film(p)), ...picks.map(p => film(p, true)));
    const measure = () => { carousel.half = track.scrollWidth / 2; };
    measure();
    window.addEventListener('resize', measure);
    track.addEventListener('load', measure, true);

    const section = $('.carousel');
    section.addEventListener('pointerenter', () => { carousel.hover = true; });
    section.addEventListener('pointerleave', () => { carousel.hover = false; });
    section.addEventListener('focusin', () => { carousel.hover = true; });
    section.addEventListener('focusout', () => { carousel.hover = false; });
    if (reduceMotion) return;

    let last = performance.now();
    const tick = now => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const target = carousel.hover ? 0 : 38; // px per second
      carousel.speed += (target - carousel.speed) * Math.min(1, dt * 3);
      carousel.boost *= Math.pow(0.04, dt); // scroll boost decays quickly
      carousel.x -= (carousel.speed + carousel.boost) * dt;
      if (carousel.half) {
        if (carousel.x <= -carousel.half) carousel.x += carousel.half;
        if (carousel.x > 0) carousel.x -= carousel.half;
      }
      track.style.transform = `translate3d(${carousel.x}px,0,0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Hero ---------- */
  function renderHero() {
    const hero = $('.hero-scatter');
    for (const [n, left, top, width, rot] of HIGHLIGHTS) {
      const photo = photos.find(p => num(p) === n);
      if (!photo) continue;
      const frame = makePrint(photo, true);
      Object.assign(frame.style, { left: left + '%', top: top + '%', width: width + '%' });
      frame.style.setProperty('--rot', rot + 'deg');
      frame.dataset.depth = (0.6 + Math.abs(rot) / 4).toFixed(2);
      hero.appendChild(frame);
    }
    if (reduceMotion || !finePointer) return;
    // Prints drift slightly with the mouse, at different depths.
    const heroSection = $('.hero');
    heroSection.addEventListener('pointermove', e => {
      const r = heroSection.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      for (const f of $$('.frame', hero)) {
        const d = +f.dataset.depth * 22;
        f.style.translate = `${(-dx * d).toFixed(1)}px ${(-dy * d).toFixed(1)}px`;
      }
    });
    heroSection.addEventListener('pointerleave', () => $$('.frame', hero).forEach(f => { f.style.translate = ''; }));
  }

  function tickYears() {
    const el = $('.ticker');
    if (reduceMotion) { el.textContent = '2026'; return; }
    const start = performance.now();
    const dur = 2200;
    const step = now => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = 1926 + Math.round(eased * 100);
      if (t < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 500);
  }

  /* ---------- Chapters ---------- */
  function columnCount() {
    const w = window.innerWidth;
    return w >= 1400 ? 4 : w >= 900 ? 3 : w >= 600 ? 2 : 1;
  }

  function renderScatter(el, list, seed) {
    const rand = rng(seed);
    const cols = Array.from({ length: Math.min(columns, list.length) }, () => {
      const c = document.createElement('div');
      c.className = 'scatter-col';
      return { el: c, height: 0 };
    });
    list.forEach((photo, i) => {
      // Phones get one column of big prints; wider screens get the scattered columns.
      const widthPct = columns === 1 ? 90 + rand() * 10 : columns === 2 ? 86 + rand() * 14 : 70 + rand() * 30;
      const xPct = rand() * (100 - widthPct);
      const yPx = i < cols.length ? rand() * 40
        : columns === 1 ? 22 + rand() * 18
        : (rand() < 0.25 ? 56 + rand() * 64 : 18 + rand() * 30) * (columns === 2 ? 0.6 : 1);
      const frame = makePrint(photo);
      frame.style.setProperty('--w', widthPct + '%');
      frame.style.setProperty('--x', xPct + '%');
      frame.style.setProperty('--y', yPx + 'px');
      frame.style.setProperty('--rot', ((rand() - 0.5) * (columns === 1 ? 2.4 : 4)).toFixed(2) + 'deg');
      frame.dataset.speed = ((rand() - 0.5) * (columns === 1 ? 0.03 : 0.09)).toFixed(3);
      // Masonry: shortest column first, so reading order stays roughly left-to-right.
      const target = cols.reduce((a, b) => (b.height < a.height ? b : a));
      target.el.appendChild(frame);
      target.height += (widthPct / 100) * (photo.h / photo.w) + yPx / 300;
      parallaxObserver.observe(frame);
    });
    el.replaceChildren(...cols.map(c => c.el));
  }

  function renderChapters() {
    columns = columnCount();
    const wrap = $('#chapters');
    if (!wrap.children.length) {
      chapters.forEach((ch, i) => {
        const section = document.createElement('section');
        section.className = 'chapter';
        section.id = ch.id;
        section.setAttribute('aria-labelledby', `${ch.id}-title`);
        section.innerHTML = `
          <div class="chapter-head fade-up">
            <span class="chapter-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h2 class="heading" id="${ch.id}-title"></h2>
              <p class="muted"></p>
            </div>
            <p class="stamp chapter-count">${ch.photos.length} photographs</p>
          </div>
          <div class="scatter"></div>`;
        $('h2', section).textContent = ch.title;
        $('.muted', section).textContent = ch.blurb;
        revealObserver.observe($('.chapter-head', section));
        wrap.appendChild(section);
        chapterObserver.observe(section);
      });
    }
    chapters.forEach((ch, i) => renderScatter($(`#${ch.id} .scatter`), ch.photos, 100 + i * 17));
  }

  function renderChapterNav() {
    const nav = $('.chapter-nav-inner');
    const links = $('[data-menu-links]');
    chapters.forEach(ch => {
      const a = document.createElement('a');
      a.className = 'pill';
      a.href = `#${ch.id}`;
      a.dataset.chapter = ch.id;
      a.innerHTML = `<span></span> <small>${ch.photos.length}</small>`;
      a.firstChild.textContent = ch.title;
      nav.appendChild(a);

      const li = document.createElement('li');
      const m = document.createElement('a');
      m.href = `#${ch.id}`;
      m.dataset.close = '';
      m.textContent = ch.title;
      li.appendChild(m);
      links.appendChild(li);
    });
  }

  const chapterObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      $$('.chapter-nav .pill').forEach(p => {
        const on = p.dataset.chapter === e.target.id;
        p.setAttribute('aria-current', String(on));
        if (on) p.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });

  /* ---------- Scroll parallax ---------- */
  const visible = new Set();
  const parallaxObserver = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
  }, { rootMargin: '200px 0px' });

  let lastY = window.scrollY;
  let scrollRaf = 0;
  function onScroll() {
    const y = window.scrollY;
    carousel.boost = Math.min(900, carousel.boost + Math.abs(y - lastY) * 4);
    lastY = y;
    if (reduceMotion || scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const mid = window.innerHeight / 2;
      for (const f of visible) {
        const r = f.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - mid) * +f.dataset.speed;
        f.style.translate = `0 ${offset.toFixed(1)}px`;
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Lightbox ---------- */
  const chapterOf = photo => chapters.find(ch => ch.photos.includes(photo));

  function buildThumbs() {
    if (lbThumbs.children.length) return;
    order.forEach((photo, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--ph', photo.c);
      b.setAttribute('aria-label', `Photo ${i + 1}`);
      b.appendChild(image(photo));
      b.addEventListener('click', () => { stop(); show(i); });
      lbThumbs.appendChild(b);
    });
  }

  function show(i) {
    current = (i + order.length) % order.length;
    const photo = order[current];
    const ch = chapterOf(photo);
    lbPrint.classList.add('loading');
    const src = `images/full/${photo.file}`;
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      if (order[current] !== photo) return;
      lbImg.src = src;
      lbImg.width = photo.w;
      lbImg.height = photo.h;
      requestAnimationFrame(() => lbPrint.classList.remove('loading'));
    };
    setTimeout(() => { pre.src = src; }, 150);
    lbImg.alt = `Photo ${current + 1}: ${ch ? ch.title : ''}`;
    lbChapter.textContent = ch ? ch.title : '';
    lbCount.textContent = `${current + 1} / ${order.length}`;
    lbDownload.href = src;
    lbDownload.setAttribute('download', `Nanny-Johnson-100th-${photo.file}`);
    history.replaceState(null, '', `#photo-${num(photo)}`);

    $$('button', lbThumbs).forEach((b, j) => b.setAttribute('aria-current', String(j === current)));
    lbThumbs.children[current]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    [1, -1].forEach(d => { new Image().src = `images/full/${order[(current + d + order.length) % order.length].file}`; });

    if (timer) restartProgress();
  }

  function open(i, autoplay = false) {
    lastFocus = document.activeElement;
    buildThumbs();
    lb.hidden = false;
    lb.classList.remove('bare');
    document.body.classList.add('locked');
    show(Math.max(0, i));
    autoplay ? play() : stop();
    $('[data-lb="close"]', lb).focus();
  }

  function close() {
    stop();
    if (document.fullscreenElement) document.exitFullscreen();
    lb.hidden = true;
    document.body.classList.remove('locked');
    history.replaceState(null, '', location.pathname);
    // If opened from the gallery, land on the photo you were last looking at.
    const back = lastFocus?.closest?.('#chapters') && $(`#chapters .frame[data-photo="${num(order[current])}"]`);
    if (back) {
      back.scrollIntoView({ block: 'center', behavior: 'auto' });
      back.focus({ preventScroll: true });
    } else {
      lastFocus?.focus?.({ preventScroll: true });
    }
  }

  function restartProgress() {
    lbProgress.classList.remove('run');
    void lbProgress.offsetWidth;
    lbProgress.style.setProperty('--slide', SLIDE_MS + 'ms');
    lbProgress.classList.add('run');
  }

  function play() {
    clearInterval(timer);
    timer = setInterval(() => show(current + 1), SLIDE_MS);
    lbPlay.textContent = 'Pause';
    restartProgress();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    lbPlay.textContent = 'Play';
    lbProgress.classList.remove('run');
  }

  lb.addEventListener('click', e => {
    const action = e.target.closest('[data-lb]')?.dataset.lb;
    if (action === 'prev') { stop(); show(current - 1); }
    if (action === 'next') { stop(); show(current + 1); }
    if (action === 'play') timer ? stop() : play();
    if (action === 'close') close();
    if (action === 'share') share(location.href, 'Link to this photo copied');
    if (action === 'fullscreen') {
      document.fullscreenElement ? document.exitFullscreen() : lb.requestFullscreen?.().catch(() => {});
    }
    if (e.target.closest('.lb-stage') && !action) {
      // Phones: tap anywhere on the photo to hide/show the controls. Desktop: click the backdrop to close.
      if (phoneViewer.matches) lb.classList.toggle('bare');
      else if (e.target.classList.contains('lb-stage')) close();
    }
  });

  document.addEventListener('keydown', e => {
    if (!lb.hidden) {
      if (e.key === 'ArrowRight') { stop(); show(current + 1); }
      if (e.key === 'ArrowLeft') { stop(); show(current - 1); }
      if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); timer ? stop() : play(); }
      if (e.key === 'Escape' && !document.fullscreenElement) close();
      if (e.key === 'Tab') {
        // Keep keyboard focus inside the viewer.
        const items = $$('button, a[href]', lb).filter(el => el.offsetParent !== null);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    } else if (e.key === 'Escape' && !menu.hidden) {
      toggleMenu(false);
    }
  });

  let touchX = null;
  $('.lb-stage', lb).addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  $('.lb-stage', lb).addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { stop(); show(current + (dx < 0 ? 1 : -1)); }
    touchX = null;
  });

  /* ---------- Share & toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('.toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  async function share(url, copiedMsg) {
    const data = { title: "Nanny Johnson · 100", text: "Photos from Nanny Johnson's 100th birthday", url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast(copiedMsg); }
    catch { toast(url); }
  }

  /* ---------- Menu ---------- */
  function toggleMenu(force) {
    const opening = force ?? menu.hidden;
    menu.hidden = !opening;
    navToggle.setAttribute('aria-expanded', String(opening));
    $('.nav-label', navToggle).textContent = opening ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', opening);
    document.body.classList.toggle('locked', opening);
  }
  navToggle.addEventListener('click', () => toggleMenu());
  menu.addEventListener('click', e => { if (e.target.closest('[data-close]')) toggleMenu(false); });

  document.addEventListener('click', e => {
    const opener = e.target.closest('.frame, .film');
    if (opener) {
      const photo = order.find(p => num(p) === +opener.dataset.photo);
      open(order.indexOf(photo));
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (!menu.hidden) toggleMenu(false);
    if (action === 'slideshow') open(0, true);
    if (action === 'share') share(location.origin + location.pathname, 'Link copied, ready to paste');
  });

  let resizeRaf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { if (columnCount() !== columns) renderChapters(); });
  });

  /* ---------- Start ---------- */
  Promise.all([fetch('photos.json').then(r => r.json()), fetch('chapters.json').then(r => r.json())])
    .then(([photoData, chapterData]) => {
      photos = photoData;
      const byNum = new Map(photos.map(p => [num(p), p]));
      const used = new Set();
      chapters = chapterData.map(ch => {
        const list = ch.photos.map(n => byNum.get(n)).filter(Boolean);
        list.forEach(p => used.add(p));
        return { ...ch, photos: list };
      });
      // Any photo not listed in chapters.json still gets shown.
      const rest = photos.filter(p => !used.has(p));
      if (rest.length) chapters.push({ id: 'more', title: 'More photographs', blurb: 'The rest of the day.', photos: rest });
      order = chapters.flatMap(ch => ch.photos);

      $$('[data-count]').forEach(el => { el.textContent = photos.length; });
      renderCarousel();
      renderHero();
      renderChapterNav();
      renderChapters();

      const deep = location.hash.match(/^#photo-(\d+)$/);
      if (deep) {
        const photo = byNum.get(+deep[1]);
        if (photo) open(order.indexOf(photo));
      }
    })
    .catch(() => {
      $('#chapters').textContent = 'The photographs could not be loaded. Please refresh the page.';
    });

  $$('.fade-up').forEach(el => revealObserver.observe(el));
  requestAnimationFrame(() => {
    document.body.classList.add('ready');
    tickYears();
  });
})();
