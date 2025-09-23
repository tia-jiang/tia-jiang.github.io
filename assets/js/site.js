(function(){
    function onReady(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }

    // Presets defined by (width-in-columns, aspect-ratio = width/height)
    const PRESETS = [
    { w:1, ar: 1/1 }, { w:1, ar: 4/5 }, { w:1, ar: 3/4 }, { w:1, ar: 2/3 },
    { w:1, ar: 4/3 }, { w:1, ar: 3/2 }, { w:1, ar: 16/9 }, { w:1, ar: 21/9 },
    { w:2, ar: 1/1 }, { w:2, ar: 3/4 }, { w:2, ar: 2/3 }, { w:2, ar: 3/2 }, { w:2, ar: 16/9 }
    ];

    function getNumberVar(el, name, fallback){
    const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
    }
    function getIntVar(el, name, fallback){
    const v = parseInt(getComputedStyle(el).getPropertyValue(name), 10);
    return isNaN(v) ? fallback : v;
    }

    function getGridMetrics(container){
    const gap  = getNumberVar(container, '--gap', 24);
    const cols = Math.max(1, getIntVar(container, '--cols', 3));
    const W    = container.clientWidth;
    const colw = (W - gap * (cols - 1)) / cols;
    return { cols, gap, colw };
    }

    function pickPreset(mediaAR, colw, gap, cols) {
    const isLandscape = mediaAR >= 1;
    const maxW = cols >= 2 ? 2 : 1;

    const candidates = PRESETS.filter(p => {
        if (p.w > maxW) return false;
        return isLandscape ? p.ar >= 1 : p.ar < 1;
    });

    let best = null, bestDiff = Infinity;
    for (const p of candidates) {
        const tileW = p.w * colw + (p.w - 1) * gap;
        const tileH = tileW / p.ar;
        const diff = Math.abs((tileW / tileH) - mediaAR);
        if (diff < bestDiff) {
        best = { w: p.w, h: tileH };
        bestDiff = diff;
        }
    }
    console.log('MediaAR', mediaAR.toFixed(2), 'picked', best);
    return best || { w:1, h: colw / (4/3) }; // safe fallback
    }

    function sizeCard(card, metrics){
    const mediaEl = card.querySelector('.card-media');
    const mediaBox = card.querySelector('.media');
    if (!mediaEl || !mediaBox) return;

    const isImg = mediaEl.tagName === 'IMG';
    const w = isImg ? mediaEl.naturalWidth  : mediaEl.videoWidth;
    const h = isImg ? mediaEl.naturalHeight : mediaEl.videoHeight;
    if (!w || !h) return;

    const { colw, gap, cols } = metrics;
    const preset = pickPreset(w / h, colw, gap, cols);

    // optional clamp to avoid monstrous tiles
    const MAX_H = 560;
    const tileH = Math.min(preset.h, MAX_H);

    card.classList.remove('w1','w2','w3');
    card.classList.add('w' + preset.w);

    mediaBox.style.setProperty('--tileh', tileH + 'px');
    mediaBox.style.height = tileH + 'px';
    // (no fixed height on .card → caption remains visible)
    }

    function processMasonry(masonry){
    const metrics = getGridMetrics(masonry);
    masonry.querySelectorAll('.card').forEach(card => {
        const media = card.querySelector('.card-media');
        if (!media) return;
        const go = () => sizeCard(card, metrics);
        if (media.tagName === 'IMG'){
        (media.complete && media.naturalWidth) ? go() : media.addEventListener('load', go, { once:true });
        } else {
        (media.readyState >= 1 && media.videoWidth) ? go() : media.addEventListener('loadedmetadata', go, { once:true });
        }
    });
    }

    function runAll(){
    document.querySelectorAll('.masonry').forEach(processMasonry);
    }

    onReady(() => {
    runAll();
    window.addEventListener('load', runAll);
    window.addEventListener('resize', () => {
        clearTimeout(window.__tiles_r);
        window.__tiles_r = setTimeout(runAll, 120);
    });
    });
})();
