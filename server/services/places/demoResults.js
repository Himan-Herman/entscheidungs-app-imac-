/** Demo data — only when PLACES_DEMO_MODE=true in non-production environments. */

export function buildDemoResults(center, specialty, language) {
  const isDe = language === "de";
  const isRu = language === "ru";
  return [
    {
      placeId: "demo-1",
      name: isDe
        ? "Praxis am Stadtpark"
        : isRu
          ? "Клиника у городского парка"
          : "City Park Medical Office",
      specialty,
      address: isDe
        ? "Musterstraße 12, 10115 Berlin"
        : isRu
          ? "ул. Примерная 12, 10115 Берлин"
          : "Sample Street 12, 10115 Berlin",
      latitude: center.lat + 0.008,
      longitude: center.lng + 0.006,
      distanceKm: 1.2,
      rating: 4.6,
      reviewCount: 312,
      websiteUrl: "https://example.com",
      mapsUrl: "https://www.google.com/maps",
      routeUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`,
      phone: "+49 30 1234567",
      openingHoursSummary: isDe
        ? "Mo–Fr 8:00–18:00"
        : isRu
          ? "Пн–Пт 8:00–18:00"
          : "Mon–Fri 8:00–18:00",
      openingHours: [],
      languages: isDe
        ? ["Deutsch", "English"]
        : isRu
          ? ["Немецкий", "Английский"]
          : ["German", "English"],
      bookingUrl: null,
    },
    {
      placeId: "demo-2",
      name: isDe
        ? "Gemeinschaftspraxis Nord"
        : isRu
          ? "Северная групповая клиника"
          : "North Community Practice",
      specialty,
      address: isDe
        ? "Nordweg 4, 10115 Berlin"
        : isRu
          ? "Северный путь 4, 10115 Берлин"
          : "North Way 4, 10115 Berlin",
      latitude: center.lat - 0.012,
      longitude: center.lng + 0.01,
      distanceKm: 2.8,
      rating: 4.4,
      reviewCount: 89,
      websiteUrl: null,
      mapsUrl: "https://www.google.com/maps",
      routeUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`,
      phone: null,
      openingHoursSummary: null,
      openingHours: [],
      languages: [],
      bookingUrl: null,
    },
  ];
}
