function resolutionFromDimensions(width, height) {
  const classifyByHeight = (hVal) => {
    if (hVal === undefined || hVal === null) return undefined;
    const h = Number(hVal);
    if (Number.isNaN(h)) return 'Unknown';
    if (h >= 2160) return '4K';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    return 'SD';
  };

  const classifyByWidth = (wVal) => {
    if (wVal === undefined || wVal === null) return undefined;
    const w = Number(wVal);
    if (Number.isNaN(w)) return 'Unknown';
    if (w >= 3800) return '4K';
    if (w >= 1800) return '1080p';
    if (w >= 1200) return '720p';
    if (w >= 700) return '480p';
    return 'SD';
  };

  const hRes = classifyByHeight(height);
  const wRes = classifyByWidth(width);

  if (hRes && wRes) {
    const order = ['Unknown', 'SD', '480p', '720p', '1080p', '4K'];
    const idx = (r) => Math.max(0, order.indexOf(r));
    return idx(hRes) >= idx(wRes) ? hRes : wRes;
  }

  return hRes ?? wRes ?? 'Unknown';
}

console.log('1920x800 ->', resolutionFromDimensions(1920, 800));
console.log('720x480 ->', resolutionFromDimensions(720, 480));
console.log('1440x1080 ->', resolutionFromDimensions(1440, 1080));
console.log('1920x1080 ->', resolutionFromDimensions(1920, 1080));
console.log('3800x2160 ->', resolutionFromDimensions(3800, 2160));
