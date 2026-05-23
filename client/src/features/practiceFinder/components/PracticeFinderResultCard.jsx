import { ExternalLink, MapPin, Navigation } from "lucide-react";

function formatSpecialty(raw, fallback) {
  if (!raw || typeof raw !== "string") return fallback;
  return raw.replace(/_/g, " ");
}

export default function PracticeFinderResultCard({ item, t, cardIndex }) {
  const titleId = `pf-card-title-${cardIndex}`;
  const specialty = formatSpecialty(item.specialty, t.cardSpecialtyFallback);
  const ratingLabel =
    item.rating != null
      ? `${t.cardRating}: ${item.rating.toFixed(1)}`
      : t.cardNoRating;
  const reviewsLabel =
    item.reviewCount != null
      ? t.cardReviews.replace("{count}", String(item.reviewCount))
      : null;

  return (
    <article className="pf-card" aria-labelledby={titleId}>
      <header className="pf-card__head">
        <h3 id={titleId} className="pf-card__title">
          {item.name}
        </h3>
        <p className="pf-card__specialty">{specialty}</p>
      </header>

      <p className="pf-card__address">
        <MapPin size={16} aria-hidden className="pf-card__icon" />
        <span>{item.address}</span>
      </p>

      <dl className="pf-card__meta">
        <div className="pf-card__meta-row">
          <dt>{t.fieldDistance}</dt>
          <dd>
            {item.distanceKm != null
              ? t.cardDistance.replace("{value}", String(item.distanceKm))
              : "—"}
          </dd>
        </div>
        <div className="pf-card__meta-row">
          <dt>{t.cardRating}</dt>
          <dd>
            {ratingLabel}
            {reviewsLabel ? ` · ${reviewsLabel}` : ""}
          </dd>
        </div>
        {item.phone ? (
          <div className="pf-card__meta-row">
            <dt>{t.phone}</dt>
            <dd>
              <a href={`tel:${item.phone.replace(/\s/g, "")}`}>{item.phone}</a>
            </dd>
          </div>
        ) : null}
        {item.openingHoursSummary ? (
          <div className="pf-card__meta-row">
            <dt>{t.hours}</dt>
            <dd>{item.openingHoursSummary}</dd>
          </div>
        ) : null}
      </dl>

      <div className="pf-card__actions">
        {item.websiteUrl ? (
          <a
            className="pf-btn pf-btn--secondary"
            href={item.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden />
            {t.openWebsite}
          </a>
        ) : null}
        {item.routeUrl ? (
          <a
            className="pf-btn pf-btn--secondary"
            href={item.routeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={16} aria-hidden />
            {t.openRoute}
          </a>
        ) : null}
        {item.mapsUrl ? (
          <a
            className="pf-btn pf-btn--primary"
            href={item.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={16} aria-hidden />
            {t.openMaps}
          </a>
        ) : null}
      </div>
    </article>
  );
}
