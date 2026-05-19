import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getMessages } from "../../../i18n/translations";
import PracticeFinderDisclaimer from "../components/PracticeFinderDisclaimer.jsx";
import PracticeFinderSearchForm from "../components/PracticeFinderSearchForm.jsx";
import PracticeFinderResultsList from "../components/PracticeFinderResultsList.jsx";
import { useGeolocationWithConsent } from "../hooks/useGeolocationWithConsent.js";
import { usePracticeFinderSearch } from "../hooks/usePracticeFinderSearch.js";
import { usePlacesAvailability } from "../hooks/usePlacesAvailability.js";
import "../styles/PracticeFinder.css";

const DEFAULT_FORM = {
  country: "",
  specialty: "",
  postalCode: "",
  city: "",
  addressLine: "",
  radiusKm: 5,
};

export default function PracticeFinderPage() {
  const { language } = useLanguage();
  const t = useMemo(() => {
    const m = getMessages(language);
    return m.practiceFinder ?? getMessages("en").practiceFinder;
  }, [language]);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [localError, setLocalError] = useState(null);
  const geo = useGeolocationWithConsent();
  const places = usePlacesAvailability();
  const search = usePracticeFinderSearch(language);

  useEffect(() => {
    document.title = `${t.pageTitle} — MedScoutX`;
  }, [t.pageTitle]);

  const onChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setLocalError(null);
  }, []);

  const serviceUnavailable = !places.loading && !places.canSearch;

  const errorMessage = useMemo(() => {
    if (serviceUnavailable) return t.serviceUnavailable;
    if (localError) return t[localError] ?? t.errorGeneric;
    if (!search.errorKey) return null;
    return t[search.errorKey] ?? t.errorGeneric;
  }, [localError, search.errorKey, serviceUnavailable, t]);

  const hasLocationInput = useCallback(
    () =>
      !!geo.coords ||
      !!form.city.trim() ||
      !!form.postalCode.trim() ||
      !!form.addressLine.trim(),
    [form, geo.coords],
  );

  const validate = useCallback(() => {
    if (!form.country.trim()) return "errorCountry";
    if (!form.specialty.trim()) return "errorSpecialty";
    if (!hasLocationInput()) return "errorLocation";
    return null;
  }, [form, hasLocationInput]);

  const handleSearch = useCallback(
    async (e, { append = false } = {}) => {
      e?.preventDefault?.();
      if (!places.canSearch) return;
      const v = validate();
      if (v) {
        setLocalError(v);
        if (!append) search.reset();
        return;
      }
      setLocalError(null);
      const manualLocation =
        form.city.trim() || form.postalCode.trim() || form.addressLine.trim();
      await search.runSearch(form, {
        append,
        coords: manualLocation ? null : geo.coords,
        pageToken: append ? search.nextPageToken : null,
      });
    },
    [form, geo.coords, places.canSearch, search, validate],
  );

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      void handleSearch(e, { append: false });
    },
    [handleSearch],
  );

  return (
    <div className="pf-page">
      <nav className="pf-page__nav" aria-label={t.navAria}>
        <Link to="/patient" className="pf-page__back">
          <ArrowLeft size={18} aria-hidden />
          {t.backPatientHub}
        </Link>
      </nav>

      <header className="pf-page__hero">
        <h1 className="pf-page__title">{t.pageHeading}</h1>
        <p className="pf-page__sub">{t.pageSub}</p>
      </header>

      <PracticeFinderDisclaimer notice={t.mdrNotice} />

      {serviceUnavailable ? (
        <div className="pf-unavailable" role="alert">
          <p className="pf-unavailable__title">{t.serviceUnavailable}</p>
          <p className="pf-unavailable__hint">{t.serviceUnavailableHint}</p>
        </div>
      ) : null}

      {places.demoMode && places.canSearch ? (
        <p className="pf-demo-banner" role="status">
          {t.demoBanner}
        </p>
      ) : null}

      <PracticeFinderSearchForm
        t={t}
        form={form}
        onChange={onChange}
        geo={geo}
        onSubmit={onSubmit}
        loading={search.loading}
        searchDisabled={serviceUnavailable}
        errorMessage={errorMessage}
      />

      <PracticeFinderResultsList
        t={t}
        results={search.results}
        loading={search.loading}
        hasSearched={search.hasSearched}
        demoMode={search.demoMode}
        hasMore={!!search.nextPageToken}
        onLoadMore={() => void handleSearch(null, { append: true })}
      />
    </div>
  );
}
