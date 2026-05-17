/**
 * Neutral composite ranking — not medical quality; distance + rating volume blend.
 */

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function compositeRankScore(distanceKm, radiusKm, rating, reviewCount) {
  const r = Math.max(radiusKm, 0.5);
  const distScore = Math.max(0, 1 - distanceKm / r);
  const ratingNorm = Math.min(5, Math.max(0, Number(rating) || 0)) / 5;
  const count = Math.max(0, Number(reviewCount) || 0);
  const volumeScore = Math.min(1, Math.log10(count + 1) / Math.log10(301));
  const qualityScore = ratingNorm * 0.55 + volumeScore * 0.45;
  return distScore * 0.55 + qualityScore * 0.45;
}

export function rankPracticeResults(places, center) {
  const withMeta = places.map((p) => {
    const lat = p.latitude;
    const lng = p.longitude;
    const distanceKm =
      typeof lat === "number" && typeof lng === "number"
        ? haversineKm(center.lat, center.lng, lat, lng)
        : 999;
    const score = compositeRankScore(
      distanceKm,
      center.radiusKm,
      p.rating,
      p.reviewCount,
    );
    return { ...p, distanceKm: Math.round(distanceKm * 10) / 10, _score: score };
  });

  return withMeta
    .filter((p) => p.distanceKm <= center.radiusKm + 0.5)
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);
}
