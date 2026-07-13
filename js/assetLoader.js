export async function loadJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load ${path}`, error);
    return fallback;
  }
}

export function flattenManifest(manifest) {
  const entries = {};
  const aliases = {
    small: 'enemySmall',
    medium: 'enemyMedium',
    boss: 'enemyBoss',
    skillDisabled: 'skillButtonDisabled',
    skillReady: 'skillButtonReady',
    skillActive: 'skillButtonActive',
    skillCooldown: 'skillButtonCooldown',
    time: 'iconTime',
    score: 'iconScore',
    rank: 'iconRank'
  };
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    Object.entries(node).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.path) {
        entries[key] = value;
        if (aliases[key]) entries[aliases[key]] = value;
      } else {
        walk(value);
      }
    });
  };
  walk(manifest.assets || manifest);
  return entries;
}

export async function loadAssets(manifest) {
  const basePath = manifest.basePath || 'assets/';
  const entries = flattenManifest(manifest);
  const images = {};
  const promises = Object.entries(entries).map(async ([key, entry]) => {
    if (entry.type === 'reference' || entry.usage === 'preview-only') return;
    if (entry.mvp === false || entry.mvpEnabled === false) return;
    images[key] = await loadImageWithFallback(resolveAssetPath(basePath, entry.path), entry);
  });
  await Promise.all(promises);
  warmLoadedImages(images);
  return {
    entries,
    images,
    get(key) {
      return images[key] || null;
    },
    url(key) {
      const entry = entries[key];
      return entry ? resolveAssetPath(basePath, entry.path) : '';
    }
  };
}

function resolveAssetPath(basePath, path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/') || path.startsWith('data:')) return path;
  return path.startsWith(basePath) ? path : `${basePath}${path}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch (error) {
        console.warn(`Image decode skipped for ${src}`, error);
      }
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function loadImageWithFallback(src, entry) {
  try {
    return await loadImage(src);
  } catch (firstError) {
    const png = src.replace(/\.svg$/i, '.png');
    if (png !== src) {
      try {
        return await loadImage(png);
      } catch (secondError) {
        console.warn(`Asset fallback failed for ${src}`, secondError);
      }
    } else {
      console.warn(`Asset load failed for ${src}`, firstError);
    }
  }
  return createPlaceholder(entry);
}

function createPlaceholder(entry) {
  const width = entry.drawSize?.width || 64;
  const height = entry.drawSize?.height || 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(62,233,255,0.22)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#3ee9ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('asset', width / 2, height / 2);
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  return img;
}

function warmLoadedImages(images) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  Object.values(images).forEach((img) => {
    try {
      if (img && img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, 0, 0, 1, 1);
      }
    } catch (error) {
      console.warn('Image warmup skipped', error);
    }
  });
}
