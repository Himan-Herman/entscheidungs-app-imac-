export default function PracticeFinderRadiusSlider({
  id,
  label,
  value,
  maxKm,
  hint,
  onChange,
  formatKm,
}) {
  return (
    <div className="pf-field">
      <label htmlFor={id} className="pf-field__label">
        {label}{" "}
        <span className="pf-field__value" aria-live="polite">
          {formatKm(value)}
        </span>
      </label>
      <input
        id={id}
        className="pf-radius"
        type="range"
        min={1}
        max={maxKm}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={1}
        aria-valuemax={maxKm}
        aria-valuenow={value}
        aria-valuetext={formatKm(value)}
      />
      {hint ? <p className="pf-field__hint">{hint}</p> : null}
    </div>
  );
}
