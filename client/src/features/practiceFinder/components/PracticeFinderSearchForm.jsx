import PracticeFinderRadiusSlider from "./PracticeFinderRadiusSlider.jsx";

const RADIUS_MAX_UI = 10;

export default function PracticeFinderSearchForm({
  t,
  form,
  onChange,
  geo,
  onSubmit,
  loading,
  searchDisabled = false,
  errorMessage,
}) {
  const formatKm = (v) => t.radiusKm.replace("{value}", String(v));

  return (
    <form
      className="pf-form"
      onSubmit={onSubmit}
      aria-label={t.formAria}
      noValidate
    >
      {errorMessage ? (
        <p className="pf-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <label className="pf-field">
        <span className="pf-field__label">{t.fieldCountryRequired}</span>
        <input
          className="pf-input"
          type="text"
          name="country"
          required
          autoComplete="country-name"
          value={form.country}
          onChange={(e) => onChange("country", e.target.value)}
          placeholder={t.placeholderCountry}
        />
      </label>

      <label className="pf-field">
        <span className="pf-field__label">{t.fieldSpecialtyRequired}</span>
        <input
          className="pf-input"
          type="text"
          name="specialty"
          required
          value={form.specialty}
          onChange={(e) => onChange("specialty", e.target.value)}
          placeholder={t.placeholderSpecialty}
        />
      </label>

      <div className="pf-form__row">
        <label className="pf-field">
          <span className="pf-field__label">{t.fieldPostal}</span>
          <input
            className="pf-input"
            type="text"
            name="postalCode"
            autoComplete="postal-code"
            value={form.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
            placeholder={t.placeholderPostal}
          />
        </label>
        <label className="pf-field">
          <span className="pf-field__label">{t.fieldCity}</span>
          <input
            className="pf-input"
            type="text"
            name="city"
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder={t.placeholderCity}
          />
        </label>
      </div>

      <label className="pf-field">
        <span className="pf-field__label">{t.fieldAddress}</span>
        <input
          className="pf-input"
          type="text"
          name="addressLine"
          autoComplete="street-address"
          value={form.addressLine}
          onChange={(e) => onChange("addressLine", e.target.value)}
          placeholder={t.placeholderAddress}
        />
      </label>

      <PracticeFinderRadiusSlider
        id="pf-radius"
        label={t.radiusLabel}
        value={form.radiusKm}
        maxKm={RADIUS_MAX_UI}
        hint={t.radiusMaxHint.replace("{max}", "50")}
        onChange={(v) => onChange("radiusKm", v)}
        formatKm={formatKm}
      />

      <fieldset className="pf-location">
        <legend className="pf-location__legend">{t.useLocation}</legend>
        <label className="pf-location__consent">
          <input
            type="checkbox"
            checked={geo.consent}
            onChange={(e) => geo.setConsent(e.target.checked)}
          />
          <span>{t.locationConsent}</span>
        </label>
        <button
          type="button"
          className="pf-btn pf-btn--secondary"
          onClick={() => void geo.requestLocation()}
          disabled={!geo.consent || geo.loading}
        >
          {t.useLocation}
        </button>
        {geo.errorKey ? (
          <p className="pf-field__hint pf-field__hint--error" role="alert">
            {t[geo.errorKey] ?? t.errorGeneric}
          </p>
        ) : null}
        {geo.coords && !geo.errorKey ? (
          <p className="pf-field__hint" role="status">
            {t.locationSuccess}
          </p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        className="pf-btn pf-btn--primary pf-form__submit"
        disabled={loading || searchDisabled}
      >
        {loading ? t.searching : t.searchButton}
      </button>
    </form>
  );
}
