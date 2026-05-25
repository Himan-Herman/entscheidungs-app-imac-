import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getPrimaryIntlLocale } from "../../../i18n/intlLocale.js";

const COLORS = {
  primary: "#0d9488",
  secondary: "#f59e0b",
};

function fmtAxisDate(iso, lang) {
  try {
    return new Date(iso).toLocaleDateString(getPrimaryIntlLocale(lang), {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso?.slice(5, 10) || "";
  }
}

function fmtTooltipDate(iso, lang) {
  try {
    return new Date(iso).toLocaleString(getPrimaryIntlLocale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function CustomTooltip({ active, payload, label, t, lang, isBP }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--ms-surface,#fff)",
        border: "1px solid var(--ms-border,#e2e8f0)",
        borderRadius: 10,
        padding: "0.6rem 0.9rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        fontSize: "0.875rem",
      }}
    >
      <p style={{ margin: "0 0 0.35rem", fontWeight: 700 }}>
        {fmtTooltipDate(label, lang)}
      </p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ margin: "0.15rem 0", color: p.color }}>
          {isBP
            ? p.dataKey === "valuePrimary"
              ? `${t.chart.systolic}: ${p.value}`
              : `${t.chart.diastolic}: ${p.value}`
            : `${t.chart.value}: ${p.value}`}
        </p>
      ))}
    </div>
  );
}

export default function VitalChart({ entries, type, t, lang }) {
  const isBP = type === "blood_pressure";

  const chartData = useMemo(() => {
    return [...entries]
      .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt))
      .map(e => ({
        measuredAt: e.measuredAt,
        valuePrimary: Number(Number(e.valuePrimary).toFixed(1)),
        valueSecondary: e.valueSecondary != null ? Number(Number(e.valueSecondary).toFixed(1)) : undefined,
      }));
  }, [entries]);

  if (chartData.length < 2) {
    return (
      <p className="vitals-chart-panel__no-data">{t.chart.noData}</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
        <XAxis
          dataKey="measuredAt"
          tickFormatter={v => fmtAxisDate(v, lang)}
          tick={{ fontSize: 11, fill: "var(--ms-text-secondary,#6b7280)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--ms-text-secondary,#6b7280)" }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip
          content={<CustomTooltip t={t} lang={lang} isBP={isBP} />}
          cursor={{ stroke: "var(--ms-border,#e2e8f0)", strokeWidth: 1 }}
        />
        {isBP && (
          <Legend
            wrapperStyle={{ fontSize: "0.8rem", paddingTop: "0.5rem" }}
            formatter={(value) =>
              value === "valuePrimary" ? t.chart.systolic : t.chart.diastolic
            }
          />
        )}
        <Line
          type="monotone"
          dataKey="valuePrimary"
          stroke={COLORS.primary}
          strokeWidth={2.5}
          dot={{ r: 3, fill: COLORS.primary, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          name="valuePrimary"
        />
        {isBP && (
          <Line
            type="monotone"
            dataKey="valueSecondary"
            stroke={COLORS.secondary}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.secondary, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="valueSecondary"
            strokeDasharray="5 3"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
