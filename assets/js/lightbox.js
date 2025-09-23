(function () {
  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // Dev-friendly cache buster: unique each time on localhost; stable in prod
  function withCache(u) {
    if (!u) return u;
    const dev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const ver = dev ? (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))
                    : (window.ASSET_VER || '1');
    return u.includes('?') ? `${u}&v=${ver}` : `${u}?v=${ver}`;
  }

  // Robust src extraction (handles <video src> and <video><source></video>)
  function srcFrom(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'video') {
      const s = el.querySelector('source');
      return (s && (s.src || s.getAttribute('src'))) ||
             el.currentSrc || el.src || el.getAttribute('src');
    }
    return el.currentSrc || el.src || el.getAttribute('src');
  }

  onReady(function () {
    console.log("lightbox init…");

    // Bind to both images and videos in the gallery
    const tiles = document.querySelectorAll('.masonry .card img, .masonry .card video');
    if (!tiles.length) { console.warn('lightbox: no media found'); return; }

    // Build media list with type
    const media = Array.from(tiles).map(el => ({
      type: el.tagName.toLowerCase() === 'video' ? 'video' : 'image',
      src:  srcFrom(el),
      alt:  el.getAttribute('alt') || ''
    }));

    // Build overlay (single frame with both elements)
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.innerHTML = `
      <div class="lb-ui"></div>
      <div class="lb-viewport">
        <div class="lb-frame">
          <img class="lb-img" alt="">
          <video class="lb-video" controls playsinline preload="metadata"></video>
        </div>
      </div>
      <div class="lb-nav"><div class="lb-prev"></div><div class="lb-next"></div></div>
      <button class="lb-btn lb-exit"    aria-label="Close"    title="Close"></button>
      <button class="lb-btn lb-zoom"    aria-label="Zoom"     title="Zoom"></button>
      <button class="lb-btn lb-prevbtn" aria-label="Previous" title="Previous"></button>
      <button class="lb-btn lb-nextbtn" aria-label="Next"     title="Next"></button>
      <div class="lb-cap"></div>`;
    document.body.appendChild(lb);

    // Refs
    const imgEl   = lb.querySelector('.lb-img');
    const capEl   = lb.querySelector('.lb-cap');
    const btnExit = lb.querySelector('.lb-exit');
    const btnZoom = lb.querySelector('.lb-zoom');
    const btnPrev = lb.querySelector('.lb-prevbtn');
    const btnNext = lb.querySelector('.lb-nextbtn');
    const zonePrev = lb.querySelector('.lb-prev');
    const zoneNext = lb.querySelector('.lb-next');
    let   vidEl   = lb.querySelector('.lb-video'); // keep mutable if you ever swap node

    let idx = 0, zoom = 1, panX = 0, panY = 0;
    let dragging = false, sx = 0, sy = 0, spx = 0, spy = 0;

    function setBGWhite() { lb.style.background = '#ffffff'; }

    function applyTransform() {
      imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    function resetZoom() {
      zoom = 1; panX = 0; panY = 0;
      applyTransform();
      imgEl.style.cursor = 'default';
      lb.dataset.zoom = "out";
    }

    function toggleZoom() {
      if (media[idx].type !== 'image') return;
      zoom = (zoom === 1) ? 2 : 1;
      panX = 0; panY = 0;
      applyTransform();
      imgEl.style.cursor = 'default';
      lb.dataset.zoom = (zoom > 1) ? "in" : "out";
    }

    function resetVideoEl() {
      if (!vidEl) return;
      try { vidEl.pause(); } catch (_) {}
      vidEl.removeAttribute('src');
      while (vidEl.firstChild) vidEl.removeChild(vidEl.firstChild); // in case sources were added
      vidEl.load();
    }

    function preloadNeighbors(i) {
      const next = media[i + 1], prev = media[i - 1];
      if (next && next.type === 'image') (new Image()).src = withCache(next.src);
      if (prev && prev.type === 'image') (new Image()).src = withCache(prev.src);
    }

    function show(i) {
      if (i < 0 || i >= media.length) { close(); return; }
      idx = i;
      const item = media[idx];
      capEl.textContent = item.alt || '';
      resetZoom();
      setBGWhite();

      // Always reset video element before switching
      resetVideoEl();

      if (item.type === 'image') {
        // image branch
        imgEl.style.display = 'block';
        vidEl.style.display = 'none';
        imgEl.src = withCache(item.src);
        imgEl.alt = item.alt || '';

        // (img decoding kept for smoother background change)
        if (imgEl.decode) {
          imgEl.decode().catch(() => {});
        }

        preloadNeighbors(idx);
      } else {
        // video branch
        imgEl.style.display = 'none';
        vidEl.style.display = 'block';

        // set attributes (idempotent)
        vidEl.setAttribute('playsinline', '');
        vidEl.setAttribute('controls', '');
        vidEl.preload = 'metadata';
        vidEl.muted = false; // user clicks to play

        const url = withCache(item.src);
        console.log('lightbox video URL:', url);
        vidEl.src = url;
        vidEl.load();

        // debug helpers
        // vidEl.onloadedmetadata = () => console.log('loadedmetadata', vidEl.videoWidth, vidEl.videoHeight);
        // vidEl.oncanplay = () => console.log('canplay');
        vidEl.onerror = () => console.warn('video error', vidEl.error);
      }
    }

    function open(i) { lb.classList.add('open'); show(i); }
    function close() {
      resetVideoEl();
      lb.classList.remove('open');
    }
    function next() { show(idx + 1); }
    function prev() { show(idx - 1); }

    // Drag-to-pan (images only, zoomed)
    imgEl.addEventListener('mousedown', e => {
      if (media[idx].type !== 'image' || zoom === 1) return;
      dragging = true; sx = e.clientX; sy = e.clientY; spx = panX; spy = panY;
      imgEl.style.cursor = 'default';
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      panX = spx + (e.clientX - sx);
      panY = spy + (e.clientY - sy);
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false; imgEl.style.cursor = 'default';
    });

    // Buttons & zones
    btnExit.addEventListener('click', close);
    btnZoom.addEventListener('click', toggleZoom);
    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    zoneNext.addEventListener('click', next);
    zonePrev.addEventListener('click', prev);

    // Keyboard
    window.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key.toLowerCase() === 'z') toggleZoom();
      else if (e.key === ' ') {
        if (media[idx].type === 'video') {
          e.preventDefault();
          if (vidEl.paused) vidEl.play().catch(() => {}); else vidEl.pause();
        }
      }
    });

    // Bind thumbnails
    tiles.forEach((el, i) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => { e.preventDefault(); open(i); });
    });

    console.log(`lightbox bound to ${media.length} media item(s)`);
  });
})();


