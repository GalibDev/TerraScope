/** POWER missing values stay missing; rainfall cannot be negative. */
export function climateMonths(
  year: number,
  parameter: Record<string, Record<string, number>>,
) {
  const valid = (value: number | undefined, rainfall = false) =>
    value === undefined ||
    !Number.isFinite(value) ||
    value === -999 ||
    (rainfall && value < 0)
      ? null
      : value;
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}${String(i + 1).padStart(2, "0")}`;
    return {
      month: new Date(Date.UTC(2000, i)).toLocaleString("en", {
        month: "short",
        timeZone: "UTC",
      }),
      temperature: valid(parameter.T2M?.[key]),
      precipitation: valid(parameter.PRECTOTCORR?.[key], true),
    };
  });
}
