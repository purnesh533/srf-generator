const HOURS_PER_YEAR = 2080;
const MONTHS_PER_YEAR = 12;

export function toAnnualSalary(amount, frequency) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 0;

  switch (String(frequency || "yearly").toLowerCase()) {
    case "hourly":
      return n * HOURS_PER_YEAR;
    case "monthly":
      return n * MONTHS_PER_YEAR;
    case "yearly":
    default:
      return n;
  }
}

export function computeAnnualCtc(record) {
  const fixedAnnual = toAnnualSalary(record.salaryFixed, record.salaryFrequency);
  const variable = Number(record.variablePayAnnual || 0);
  const retention = Number(record.annualRetentionBonus || 0);
  return fixedAnnual + (Number.isFinite(variable) ? variable : 0) + (Number.isFinite(retention) ? retention : 0);
}
