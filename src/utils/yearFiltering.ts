import { getAvailableYears } from "../services/locationSearch";

export interface YearFilterParams {
  year?: string;
  fromYear?: string;
  toYear?: string;
  specificYears?: string[];
}

export interface FilteredYearsResult {
  isHistorical: boolean;
  yearsToQuery: string[];
  targetYear: string;
}

export async function getFilteredYears(
  params: YearFilterParams
): Promise<FilteredYearsResult> {
  const { year, fromYear, toYear, specificYears } = params;
  const targetYear = year || "2024-2025";

  if (!fromYear && !toYear && !specificYears) {
    return {
      isHistorical: false,
      yearsToQuery: [targetYear],
      targetYear,
    };
  }

  const availableYears = await getAvailableYears();
  let yearsToQuery = availableYears;

  if (specificYears && specificYears.length > 0) {
    yearsToQuery = availableYears.filter((y) => specificYears.includes(y));
  } else if (fromYear || toYear) {
    yearsToQuery = availableYears.filter((y) => {
      if (fromYear && toYear) return y >= fromYear && y <= toYear;
      if (fromYear) return y >= fromYear;
      if (toYear) return y <= toYear;
      return true;
    });
  }

  return {
    isHistorical: true,
    yearsToQuery,
    targetYear,
  };
}

export function filterRecordsByYear<T extends { year: string }>(
  records: T[],
  params: YearFilterParams
): T[] {
  const { fromYear, toYear, specificYears } = params;

  if (specificYears && specificYears.length > 0) {
    return records.filter((r) => specificYears.includes(r.year));
  }

  if (fromYear || toYear) {
    return records.filter((r) => {
      if (fromYear && toYear) return r.year >= fromYear && r.year <= toYear;
      if (fromYear) return r.year >= fromYear;
      if (toYear) return r.year <= toYear;
      return true;
    });
  }

  return records;
}

export function calculatePercentChange(
  oldVal: unknown,
  newVal: unknown
): string {
  const oldNum = Number(oldVal);
  const newNum = Number(newVal);
  if (isNaN(oldNum) || isNaN(newNum) || oldNum === 0) return "N/A";
  const change = ((newNum - oldNum) / oldNum) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}
