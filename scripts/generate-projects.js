// node scripts/generate-projects.js
// Scans assets/projects/* and creates/updates _projects/{slug}.md
// Adds front matter including an `assets` array:
// - cover.* first
// - then others sorted A→Z
// Supports images/videos (extend `ALLOWED` below)

const fs = require('fs');
const path = require('path');

const ROOT         = process.cwd();
const ASSETS_ROOT  = path.join(ROOT, 'assets', 'projects');
const OUT_DIR      = path.join(ROOT, '_projects/projects');
const DRY_RUN      = process.argv.includes('--dry-run');
const OVERWRITE    = process.argv.includes('--overwrite'); // overwrite existing .md

const ALLOWED = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'],
  video: ['.mp4', '.webm', '.mov', '.m4v']
};
const ALL_EXTS = new Set([...ALLOWED.image, ...ALLOWED.video].map(e => e.toLowerCase()));

function toSlug(name) {
  return name.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function toTitle(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}
function isAllowed(file) {
  return ALL_EXTS.has(path.extname(file).toLowerCase());
}
function assetTypeByExt(ext) {
  ext = ext.toLowerCase();
  if (ALLOWED.image.includes(ext)) return 'image';
  if (ALLOWED.video.includes(ext)) return 'video';
  return 'other';
}
function frontMatterEscape(s) {
  // escape quotes for YAML safety
  return (s || '').replace(/"/g, '\\"');
}

// Ensure dirs
if (!fs.existsSync(ASSETS_ROOT)) {
  console.error('No assets/projects/ directory found.');
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Walk immediate subfolders of assets/projects
const folders = fs.readdirSync(ASSETS_ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

folders.forEach(dir => {
  const slug      = toSlug(dir);
  const title     = toTitle(dir);
  const projectDirAbs = path.join(ASSETS_ROOT, dir);
  const projectDirRel = `/assets/projects/${dir}`; // leading slash for site paths
  const mdPath    = path.join(OUT_DIR, `${slug}.md`);

  // Collect files (flat — 1 level; extend to recursive if needed)
  let files = fs.readdirSync(projectDirAbs, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => f.name)
    .filter(isAllowed);

  if (files.length === 0) {
    console.warn(`(i) Skipping ${dir} — no allowed media files`);
    return;
  }

  // Separate cover first (any "cover.*" filename)
  const covers = files.filter(n => /^cover\./i.test(n)).sort();
  const others = files
    .filter(n => !/^cover\./i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Build assets array
  const assets = [];
  const pushAsset = (name) => {
    const ext   = path.extname(name).toLowerCase();
    const type  = assetTypeByExt(ext);
    // infer a simple alt from filename (e.g., "img-01.jpg" -> "Img 01")
    const base  = path.basename(name, ext).replace(/[-_]+/g, ' ').trim();
    const alt   = base ? base[0].toUpperCase() + base.slice(1) : title;

    assets.push({
      type,
      src: `${projectDirRel}/${name}`,
      alt
    });
  };

  covers.forEach(pushAsset);
  others.forEach(pushAsset);

  // Pick a date (mtime of folder as fallback)
  const stats  = fs.statSync(projectDirAbs);
  const isoDate = new Date(stats.mtime).toISOString().slice(0,10);

  // Optional: also include a top-level cover (first cover or first asset)
  const coverPath = (covers[0] ?? files[0]) ? `${projectDirRel}/${(covers[0] ?? files[0])}` : '';

  // If file exists and not overwriting, skip
  if (fs.existsSync(mdPath) && !OVERWRITE) {
    console.log(`✓ ${slug}.md exists (use --overwrite to regenerate)`);
    return;
  }

  // Build front matter
  const fm = [
    '---',
    `layout: project`,
    `title: "${frontMatterEscape(title)}"`,
    `date: ${isoDate}`,
    `assets_dir: ${projectDirRel}`,
    coverPath ? `cover: "${coverPath}"` : null,
    `description: ""`,
    `assets:`,
    ...assets.map(a => `  - type: ${a.type}\n    src: "${a.src}"\n    alt: "${frontMatterEscape(a.alt)}"`),
    '---',
    '',
    ''
  ].filter(Boolean).join('\n');

  if (DRY_RUN) {
    console.log(`\n— Would write: _projects/projects/${slug}.md —\n${fm}`);
  } else {
    fs.writeFileSync(mdPath, fm, 'utf8');
    console.log(`${fs.existsSync(mdPath) ? '↻ Updated' : '+'} _projects/projects/${slug}.md (${assets.length} asset${assets.length!==1?'s':''})`);
  }
});

console.log('Done.');