const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

type RelativeUnit = Intl.RelativeTimeFormatUnit;

const TIME_UNITS: Array<{ unit: RelativeUnit; seconds: number }> = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);

  for (const { unit, seconds } of TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return null;
}
