import { GroundwaterRecord } from "../services/groundwaterService";

interface NumericFields {
  [key: string]: number | null;
}

export function aggregateGroundwaterRecords(
  records: GroundwaterRecord[]
): GroundwaterRecord | null {
  if (records.length === 0) return null;
  if (records.length === 1) return records[0];

  const first = records[0];
  const aggregated: Record<string, number> = {};

  for (const record of records) {
    const data = record.data as Record<string, unknown>;

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number" && !isNaN(value)) {
        aggregated[key] = (aggregated[key] || 0) + value;
      }
    }
  }

  return {
    location: first.location,
    year: first.year,
    data: {
      ...aggregated,
      categoryTotal: determineCategoryFromStage(
        aggregated.stageOfExtractionTotal
      ),
      categoryCommand: null,
      categoryNonCommand: null,
      categoryPoorQuality: null,
    },
  };
}

export function aggregateHistoricalRecords(
  recordsByYear: Map<string, any[]>
): any[] {
  const aggregatedRecords: any[] = [];

  for (const [year, records] of recordsByYear.entries()) {
    if (records.length === 0) continue;

    const first = records[0];
    const aggregated: Record<string, number> = {};

    for (const record of records) {
      const data = record.data as Record<string, unknown>;

      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "number" && !isNaN(value)) {
          aggregated[key] = (aggregated[key] || 0) + value;
        }
      }
    }

    aggregatedRecords.push({
      year,
      locationId: first.locationId,
      locationName: first.locationName,
      data: {
        ...aggregated,
        categoryTotal: determineCategoryFromStage(
          aggregated.stageOfExtractionTotal
        ),
      },
    });
  }

  return aggregatedRecords.sort((a, b) => a.year.localeCompare(b.year));
}

function determineCategoryFromStage(stage: number | undefined): string {
  if (!stage) return "Unknown";
  if (stage < 70) return "Safe";
  if (stage < 90) return "Semi-Critical";
  if (stage < 100) return "Critical";
  return "Over-Exploited";
}

export function groupRecordsByName<T extends { locationName: string }>(
  records: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const record of records) {
    const normalizedName = record.locationName.toLowerCase().trim();
    const existing = grouped.get(normalizedName) || [];
    existing.push(record);
    grouped.set(normalizedName, existing);
  }

  return grouped;
}

export function groupRecordsByYear<T extends { year: string }>(
  records: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const record of records) {
    const existing = grouped.get(record.year) || [];
    existing.push(record);
    grouped.set(record.year, existing);
  }

  return grouped;
}
