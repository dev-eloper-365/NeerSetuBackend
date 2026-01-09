import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/gw-db";
import { groundwaterData, locations } from "../db/gw-schema";
import { aggregateGroundwaterRecords, aggregateHistoricalRecords, groupRecordsByYear } from "../utils/aggregation";
import {
  generateSummaryExplanation,
  generateRechargeExplanation,
  generateExtractionPieExplanation,
  generateWaterBalanceExplanation,
  getStageExplanation,
  getCategoryExplanation,
  generateComparisonExplanation,
  generateStageComparisonExplanation,
  generateTrendExplanation,
  generateRainfallTrendExplanation,
  generateMultiLineTrendExplanation,
  generateCategoryDistributionExplanation,
  generateYoYChangeExplanation,
} from "../utils/chartExplanations";
import {
  getAvailableYears,
  getDistrictsOfState,
  getLocationById,
  getLocationsByNameAndType,
  getTaluksOfDistrict,
  LocationRecord,
  searchDistrict,
  searchLocation,
  searchState,
  searchTaluk,
} from "./locationSearch";

export interface GroundwaterRecord {
  location: {
    id: string;
    name: string;
    type: string;
  };
  year: string;
  data: Record<string, unknown>;
}

const LATEST_YEAR = "2024-2025";

export async function getGroundwaterDataByLocationId(locationId: string, year: string = LATEST_YEAR): Promise<GroundwaterRecord | null> {
  const result = await db
    .select()
    .from(groundwaterData)
    .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
    .where(and(eq(locations.id, locationId), eq(groundwaterData.year, year)));

  if (result.length === 0) return null;

  const records = result.map((row) => ({
    location: {
      id: row.locations.id,
      name: row.locations.name,
      type: row.locations.type,
    },
    year: row.groundwater_data.year,
    data: row.groundwater_data,
  }));

  return aggregateGroundwaterRecords(records);
}

export async function searchAndGetGroundwaterData(
  query: string,
  locationType?: "STATE" | "DISTRICT" | "TALUK",
  parentName?: string,
  year: string = LATEST_YEAR
): Promise<GroundwaterRecord | null> {
  const normalizedQuery = query.replace(/[_-]/g, " ").trim();
  const normalizedParent = parentName?.replace(/[_-]/g, " ").trim();

  let results: { location: { id: string }; score: number }[];
  if (locationType === "STATE") {
    results = searchState(normalizedQuery);
  } else if (locationType === "DISTRICT") {
    results = searchDistrict(normalizedQuery, normalizedParent);
  } else if (locationType === "TALUK") {
    results = searchTaluk(normalizedQuery, normalizedParent);
  } else {
    results = searchLocation(normalizedQuery, locationType);
  }

  if (results.length === 0) return null;

  const bestMatch = results[0];
  return getGroundwaterDataByLocationId(bestMatch.location.id, year);
}

export async function compareLocations(locationIds: string[], year: string = LATEST_YEAR): Promise<GroundwaterRecord[]> {
  const results: GroundwaterRecord[] = [];

  for (const id of locationIds) {
    const data = await getGroundwaterDataByLocationId(id, year);
    if (data) results.push(data);
  }

  return results;
}

export async function getTopLocationsByField(
  field: string,
  locationType: "STATE" | "DISTRICT" | "TALUK",
  order: "asc" | "desc" = "desc",
  limit: number = 10,
  year: string = LATEST_YEAR
): Promise<GroundwaterRecord[]> {
  const columnName = fieldToColumn(field);
  if (!columnName) return [];

  const orderFn = order === "desc" ? desc : asc;

  const result = await db
    .select()
    .from(groundwaterData)
    .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
    .where(and(eq(locations.type, locationType), eq(groundwaterData.year, year), isNotNull(sql.raw(`groundwater_data.${columnName}`))))
    .orderBy(orderFn(sql.raw(`groundwater_data.${columnName}`)))
    .limit(limit);

  return result.map((row) => ({
    location: {
      id: row.locations.id,
      name: row.locations.name,
      type: row.locations.type,
    },
    year: row.groundwater_data.year,
    data: row.groundwater_data,
  }));
}

export async function getLocationWithChildren(
  locationId: string,
  year: string = LATEST_YEAR
): Promise<{
  parent: GroundwaterRecord | null;
  children: GroundwaterRecord[];
}> {
  const parent = await getGroundwaterDataByLocationId(locationId, year);
  if (!parent) return { parent: null, children: [] };

  const location = await getLocationById(locationId);
  if (!location) return { parent, children: [] };

  let childLocations: { id: string }[] = [];
  if (location.type === "STATE") {
    childLocations = getDistrictsOfState(locationId);
  } else if (location.type === "DISTRICT") {
    childLocations = getTaluksOfDistrict(locationId);
  }

  const children: GroundwaterRecord[] = [];
  for (const child of childLocations.slice(0, 20)) {
    const data = await getGroundwaterDataByLocationId(child.id, year);
    if (data) children.push(data);
  }

  return { parent, children };
}

export async function getCategorySummary(locationType: "STATE" | "DISTRICT" | "TALUK", year: string = LATEST_YEAR): Promise<Record<string, number>> {
  const result = await db
    .select({
      category: groundwaterData.categoryTotal,
      count: sql<number>`count(*)`,
    })
    .from(groundwaterData)
    .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
    .where(and(eq(locations.type, locationType), eq(groundwaterData.year, year)))
    .groupBy(groundwaterData.categoryTotal);

  const summary: Record<string, number> = {};
  for (const row of result) {
    if (row.category) {
      summary[row.category] = Number(row.count);
    }
  }
  return summary;
}

export async function getAggregateStats(locationType: "STATE" | "DISTRICT" | "TALUK", year: string = LATEST_YEAR): Promise<Record<string, number>> {
  const result = await db
    .select({
      totalRecharge: sql<number>`sum(recharge_total_total)`,
      totalDraft: sql<number>`sum(draft_total_total)`,
      totalExtractable: sql<number>`sum(extractable_total)`,
      avgRainfall: sql<number>`avg(rainfall_total)`,
      avgStageOfExtraction: sql<number>`avg(stage_of_extraction_total)`,
      count: sql<number>`count(*)`,
    })
    .from(groundwaterData)
    .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
    .where(and(eq(locations.type, locationType), eq(groundwaterData.year, year)));

  const row = result[0];
  return {
    totalRecharge: Number(row.totalRecharge) || 0,
    totalDraft: Number(row.totalDraft) || 0,
    totalExtractable: Number(row.totalExtractable) || 0,
    avgRainfall: Number(row.avgRainfall) || 0,
    avgStageOfExtraction: Number(row.avgStageOfExtraction) || 0,
    locationCount: Number(row.count) || 0,
  };
}

function fieldToColumn(field: string): string | null {
  const fieldMap: Record<string, string> = {
    rainfall: "rainfall_total",
    recharge: "recharge_total_total",
    extraction: "draft_total_total",
    draft: "draft_total_total",
    extractable: "extractable_total",
    stage: "stage_of_extraction_total",
    stage_of_extraction: "stage_of_extraction_total",
    loss: "loss_total",
    availability: "availability_future_total",
    irrigation_extraction: "draft_agriculture_total",
    domestic_extraction: "draft_domestic_total",
    industrial_extraction: "draft_industry_total",
    recharge_from_rainfall: "recharge_rainfall_total",
  };
  return fieldMap[field.toLowerCase()] ?? null;
}

export interface HistoricalRecord {
  year: string;
  locationId: string;
  locationName: string;
  data: Record<string, unknown>;
}

export async function getHistoricalDataByLocationName(
  locationName: string,
  locationType: "STATE" | "DISTRICT" | "TALUK"
): Promise<HistoricalRecord[]> {
  const matchingLocations = getLocationsByNameAndType(locationName, locationType);

  if (matchingLocations.length === 0) return [];

  const locationIds = matchingLocations.map((l) => l.id);

  const result = await db
    .select()
    .from(groundwaterData)
    .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
    .where(inArray(locations.id, locationIds));

  const records = result.map((row) => ({
    year: row.groundwater_data.year,
    locationId: row.locations.id,
    locationName: row.locations.name,
    data: row.groundwater_data,
  }));

  const recordsByYear = groupRecordsByYear(records);
  return aggregateHistoricalRecords(recordsByYear);
}

export async function searchAndGetHistoricalData(
  query: string,
  locationType: "STATE" | "DISTRICT" | "TALUK" | undefined
): Promise<HistoricalRecord[]> {
  const normalizedQuery = query.replace(/[_-]/g, " ").trim();

  let results: { location: LocationRecord }[];
  if (locationType === "STATE") {
    results = searchState(normalizedQuery);
  } else if (locationType === "DISTRICT") {
    results = searchDistrict(normalizedQuery);
  } else if (locationType === "TALUK") {
    results = searchTaluk(normalizedQuery);
  } else {
    results = searchLocation(normalizedQuery);
  }

  if (results.length === 0) return [];

  const bestMatch = results[0];

  if (!locationType) {
    locationType = bestMatch.location.type as "STATE" | "DISTRICT" | "TALUK";
  }

  return getHistoricalDataByLocationName(bestMatch.location.name, locationType);
}

export async function getGroundwaterDataForYear(
  query: string,
  year: string,
  locationType?: "STATE" | "DISTRICT" | "TALUK"
): Promise<GroundwaterRecord | null> {
  return searchAndGetGroundwaterData(query, locationType, undefined, year);
}

export async function compareYears(locationName: string, locationType: "STATE" | "DISTRICT" | "TALUK", years: string[]): Promise<HistoricalRecord[]> {
  const historicalData = await getHistoricalDataByLocationName(locationName, locationType);

  if (years.length === 0) return historicalData;

  return historicalData.filter((h) => years.includes(h.year));
}

export function formatGroundwaterDataForLLM(record: GroundwaterRecord): string {
  const data = record.data as Record<string, unknown>;
  const lines: string[] = [`Location: ${record.location.name} (${record.location.type})`, `Year: ${record.year}`, ""];

  if (data.rainfallTotal) {
    lines.push(`Rainfall: ${formatNumber(data.rainfallTotal)} mm`);
  }

  if (data.categoryTotal) {
    lines.push(`Category: ${data.categoryTotal}`);
  }

  if (data.extractableTotal) {
    lines.push(`Annual Extractable Ground Water Resources: ${formatNumber(data.extractableTotal)} ham`);
  }

  if (data.draftTotalTotal) {
    lines.push(`Ground Water Extraction: ${formatNumber(data.draftTotalTotal)} ham`);
  }

  lines.push("");
  lines.push("Ground Water Recharge (ham):");
  const rechargeRows = [
    {
      name: "Rainfall Recharge",
      cmd: data.rechargeRainfallCommand,
      nonCmd: data.rechargeRainfallNonCommand,
      total: data.rechargeRainfallTotal,
    },
    {
      name: "Canal Recharge",
      cmd: data.rechargeCanalCommand,
      nonCmd: data.rechargeCanalNonCommand,
      total: data.rechargeCanalTotal,
    },
    {
      name: "Surface Water Irrigation",
      cmd: data.rechargeSurfaceIrrigationCommand,
      nonCmd: data.rechargeSurfaceIrrigationNonCommand,
      total: data.rechargeSurfaceIrrigationTotal,
    },
    {
      name: "Ground Water Irrigation",
      cmd: data.rechargeGwIrrigationCommand,
      nonCmd: data.rechargeGwIrrigationNonCommand,
      total: data.rechargeGwIrrigationTotal,
    },
    {
      name: "Water Conservation Structures",
      cmd: data.rechargeArtificialStructureCommand,
      nonCmd: data.rechargeArtificialStructureNonCommand,
      total: data.rechargeArtificialStructureTotal,
    },
    {
      name: "Tanks And Ponds",
      cmd: data.rechargeWaterBodyCommand,
      nonCmd: data.rechargeWaterBodyNonCommand,
      total: data.rechargeWaterBodyTotal,
    },
  ].filter((r) => r.total);

  for (const row of rechargeRows) {
    lines.push(`  - ${row.name}: ${formatNumber(row.total)} (Cmd: ${formatNumber(row.cmd)}, Non-Cmd: ${formatNumber(row.nonCmd)})`);
  }
  if (data.rechargeTotalTotal) {
    lines.push(
      `  Total: ${formatNumber(data.rechargeTotalTotal)} (Cmd: ${formatNumber(data.rechargeTotalCommand)}, Non-Cmd: ${formatNumber(
        data.rechargeTotalNonCommand
      )})`
    );
  }

  lines.push("");
  lines.push("Natural Discharges (ham):");
  const dischargeRows = [
    {
      name: "Baseflow",
      cmd: data.baseflowLateralCommand,
      nonCmd: data.baseflowLateralNonCommand,
      total: data.baseflowLateralTotal,
    },
    {
      name: "Evaporation",
      cmd: data.evaporationCommand,
      nonCmd: data.evaporationNonCommand,
      total: data.evaporationTotal,
    },
    {
      name: "Transpiration",
      cmd: data.transpirationCommand,
      nonCmd: data.transpirationNonCommand,
      total: data.transpirationTotal,
    },
    {
      name: "Vertical Flows",
      cmd: data.baseflowVerticalCommand,
      nonCmd: data.baseflowVerticalNonCommand,
      total: data.baseflowVerticalTotal,
    },
  ].filter((r) => r.total);

  for (const row of dischargeRows) {
    lines.push(`  - ${row.name}: ${formatNumber(row.total)} (Cmd: ${formatNumber(row.cmd)}, Non-Cmd: ${formatNumber(row.nonCmd)})`);
  }
  if (data.lossTotal) {
    lines.push(`  Total: ${formatNumber(data.lossTotal)} (Cmd: ${formatNumber(data.lossCommand)}, Non-Cmd: ${formatNumber(data.lossNonCommand)})`);
  }

  lines.push("");
  lines.push("Annual Extractable Ground Water Resources (ham):");
  lines.push(
    `  Command: ${formatNumber(data.extractableCommand)}, Non-Command: ${formatNumber(data.extractableNonCommand)}, Total: ${formatNumber(
      data.extractableTotal
    )}`
  );

  lines.push("");
  lines.push("Ground Water Extraction (ham):");
  const extractionRows = [
    {
      name: "Irrigation",
      cmd: data.draftAgricultureCommand,
      nonCmd: data.draftAgricultureNonCommand,
      total: data.draftAgricultureTotal,
    },
    {
      name: "Domestic",
      cmd: data.draftDomesticCommand,
      nonCmd: data.draftDomesticNonCommand,
      total: data.draftDomesticTotal,
    },
    {
      name: "Industry",
      cmd: data.draftIndustryCommand,
      nonCmd: data.draftIndustryNonCommand,
      total: data.draftIndustryTotal,
    },
  ].filter((r) => r.total);

  for (const row of extractionRows) {
    lines.push(`  - ${row.name}: ${formatNumber(row.total)} (Cmd: ${formatNumber(row.cmd)}, Non-Cmd: ${formatNumber(row.nonCmd)})`);
  }
  if (data.draftTotalTotal) {
    lines.push(
      `  Total: ${formatNumber(data.draftTotalTotal)} (Cmd: ${formatNumber(data.draftTotalCommand)}, Non-Cmd: ${formatNumber(
        data.draftTotalNonCommand
      )})`
    );
  }

  if (data.stageOfExtractionTotal) {
    lines.push("");
    lines.push(`Stage of Extraction: ${formatNumber(data.stageOfExtractionTotal)}%`);
  }

  return lines.join("\n");
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function generateChartData(record: GroundwaterRecord): object[] {
  const data = record.data as Record<string, unknown>;
  const locationName = record.location.name;
  const visualizations: object[] = [];

  // Prepare summary data for explanation
  const summaryData = {
    extractableTotal: data.extractableTotal,
    extractionTotal: data.draftTotalTotal,
    rainfall: data.rainfallTotal,
    rechargeTotal: data.rechargeTotalTotal,
    naturalDischarges: data.lossTotal,
    stageOfExtraction: data.stageOfExtractionTotal,
    category: data.categoryTotal,
  };

  // 1. Summary Stats Card (Key Metrics)
  visualizations.push({
    type: "summary",
    title: `Area of Focus: ${locationName} (${record.location.type})`,
    year: record.year,
    data: summaryData,
    explanation: generateSummaryExplanation(summaryData),
  });

  // 2. Ground Water Recharge Table
  const rechargeTableData = [
    {
      source: "Rainfall Recharge",
      command: data.rechargeRainfallCommand,
      nonCommand: data.rechargeRainfallNonCommand,
      total: data.rechargeRainfallTotal,
    },
    { source: "Stream Channel Recharge", command: 0, nonCommand: 0, total: 0 },
    {
      source: "Canal Recharge",
      command: data.rechargeCanalCommand,
      nonCommand: data.rechargeCanalNonCommand,
      total: data.rechargeCanalTotal,
    },
    {
      source: "Surface Water Irrigation",
      command: data.rechargeSurfaceIrrigationCommand,
      nonCommand: data.rechargeSurfaceIrrigationNonCommand,
      total: data.rechargeSurfaceIrrigationTotal,
    },
    {
      source: "Ground Water Irrigation",
      command: data.rechargeGwIrrigationCommand,
      nonCommand: data.rechargeGwIrrigationNonCommand,
      total: data.rechargeGwIrrigationTotal,
    },
    {
      source: "Water Conservation Structures",
      command: data.rechargeArtificialStructureCommand,
      nonCommand: data.rechargeArtificialStructureNonCommand,
      total: data.rechargeArtificialStructureTotal,
    },
    {
      source: "Tanks And Ponds",
      command: data.rechargeWaterBodyCommand,
      nonCommand: data.rechargeWaterBodyNonCommand,
      total: data.rechargeWaterBodyTotal,
    },
  ].filter((r) => r.total);

  rechargeTableData.push({
    source: "Total",
    command: data.rechargeTotalCommand,
    nonCommand: data.rechargeTotalNonCommand,
    total: data.rechargeTotalTotal,
  });

  visualizations.push({
    type: "table",
    tableType: "recharge",
    title: `Ground Water Recharge (ham)`,
    headerValue: data.rechargeTotalTotal,
    columns: ["Source", "Command", "Non Command", "Total"],
    data: rechargeTableData,
    explanation:
      "This table shows where underground water comes from. 'Command' areas have irrigation infrastructure (canals, etc.), while 'Non-Command' areas rely on natural recharge. Rainfall is usually the biggest source of recharge.",
  });

  // 3. Natural Discharges Table
  const dischargesTableData = [
    {
      source: "Baseflow",
      command: data.baseflowLateralCommand,
      nonCommand: data.baseflowLateralNonCommand,
      total: data.baseflowLateralTotal,
    },
    { source: "Evapo-Transpiration", command: 0, nonCommand: 0, total: 0 },
    {
      source: "Evaporation",
      command: data.evaporationCommand,
      nonCommand: data.evaporationNonCommand,
      total: data.evaporationTotal,
    },
    { source: "Lateral Flows", command: 0, nonCommand: 0, total: 0 },
    { source: "Stream Recharges", command: 0, nonCommand: 0, total: 0 },
    {
      source: "Transpiration",
      command: data.transpirationCommand,
      nonCommand: data.transpirationNonCommand,
      total: data.transpirationTotal,
    },
    {
      source: "Vertical Flows",
      command: data.baseflowVerticalCommand,
      nonCommand: data.baseflowVerticalNonCommand,
      total: data.baseflowVerticalTotal,
    },
  ].filter((r) => r.total || r.source === "Total");

  dischargesTableData.push({
    source: "Total",
    command: data.lossCommand,
    nonCommand: data.lossNonCommand,
    total: data.lossTotal,
  });

  visualizations.push({
    type: "table",
    tableType: "discharges",
    title: `Natural Discharges (ham)`,
    headerValue: data.lossTotal,
    columns: ["Source", "Command", "Non Command", "Total"],
    data: dischargesTableData,
    explanation:
      "Natural discharge is water that leaves the underground reserves naturally - through streams, evaporation, and plant absorption. This water is 'lost' from the groundwater system but is part of the natural water cycle.",
  });

  // 4. Annual Extractable Ground Water Resources Table
  visualizations.push({
    type: "table",
    tableType: "extractable",
    title: `Annual Extractable Ground Water Resources (ham)`,
    headerValue: data.extractableTotal,
    columns: ["Command", "Non Command", "Total"],
    data: [
      {
        command: data.extractableCommand,
        nonCommand: data.extractableNonCommand,
        total: data.extractableTotal,
      },
    ],
    explanation:
      "This is the total amount of underground water that can safely be pumped out each year without depleting the reserves. Think of it as the 'annual water budget' - the amount nature refills each year.",
  });

  // 5. Ground Water Extraction Table
  const extractionTableData = [
    {
      source: "Irrigation",
      command: data.draftAgricultureCommand,
      nonCommand: data.draftAgricultureNonCommand,
      total: data.draftAgricultureTotal,
    },
    {
      source: "Domestic",
      command: data.draftDomesticCommand,
      nonCommand: data.draftDomesticNonCommand,
      total: data.draftDomesticTotal,
    },
    {
      source: "Industry",
      command: data.draftIndustryCommand,
      nonCommand: data.draftIndustryNonCommand,
      total: data.draftIndustryTotal,
    },
  ].filter((r) => r.total);

  extractionTableData.push({
    source: "Total",
    command: data.draftTotalCommand,
    nonCommand: data.draftTotalNonCommand,
    total: data.draftTotalTotal,
  });

  visualizations.push({
    type: "table",
    tableType: "extraction",
    title: `Ground Water Extraction (ham)`,
    headerValue: data.draftTotalTotal,
    columns: ["Source", "Command", "Non Command", "Total"],
    data: extractionTableData,
    explanation:
      "This shows how much underground water is actually being pumped out and for what purpose. Irrigation (farming) typically uses the most water, followed by household (domestic) and factory (industrial) use.",
  });

  // 6. Recharge Sources Bar Chart
  const rechargeChartData = [
    { name: "Rainfall", value: data.rechargeRainfallTotal },
    { name: "Canal", value: data.rechargeCanalTotal },
    { name: "Surface Irrigation", value: data.rechargeSurfaceIrrigationTotal },
    { name: "GW Irrigation", value: data.rechargeGwIrrigationTotal },
    {
      name: "Conservation Structures",
      value: data.rechargeArtificialStructureTotal,
    },
    { name: "Tanks & Ponds", value: data.rechargeWaterBodyTotal },
  ].filter((r) => r.value);

  if (rechargeChartData.length > 0) {
    visualizations.push({
      type: "chart",
      chartType: "bar",
      title: `Ground Water Recharge Sources - ${locationName}`,
      description: "Breakdown of ground water recharge by source (ham)",
      data: rechargeChartData,
      explanation: generateRechargeExplanation(rechargeChartData as Array<{ name: string; value: unknown }>, data.rechargeTotalTotal),
    });
  }

  // 7. Extraction by Use Pie Chart
  const extractionPieData = [
    { name: "Irrigation", value: data.draftAgricultureTotal },
    { name: "Domestic", value: data.draftDomesticTotal },
    { name: "Industry", value: data.draftIndustryTotal },
  ].filter((e) => e.value);

  if (extractionPieData.length > 0) {
    visualizations.push({
      type: "chart",
      chartType: "pie",
      title: `Ground Water Extraction by Use - ${locationName}`,
      description: "Distribution of ground water extraction (ham)",
      data: extractionPieData,
      explanation: generateExtractionPieExplanation(extractionPieData as Array<{ name: string; value: unknown }>),
    });
  }

  // 8. Command vs Non-Command Comparison
  const commandComparisonData = [
    {
      name: "Recharge",
      command: data.rechargeTotalCommand,
      nonCommand: data.rechargeTotalNonCommand,
    },
    {
      name: "Extraction",
      command: data.draftTotalCommand,
      nonCommand: data.draftTotalNonCommand,
    },
    {
      name: "Extractable",
      command: data.extractableCommand,
      nonCommand: data.extractableNonCommand,
    },
  ].filter((r) => r.command || r.nonCommand);

  if (commandComparisonData.length > 0) {
    visualizations.push({
      type: "chart",
      chartType: "grouped_bar",
      title: `Command vs Non-Command Areas - ${locationName}`,
      description: "Comparison between command and non-command areas (ham)",
      data: commandComparisonData,
      explanation:
        "Command areas have irrigation infrastructure like canals, while non-command areas rely on direct rainfall and wells. This comparison shows how water availability and usage differ between these two types of regions.",
    });
  }

  // 9. Water Balance Overview (Stacked/Comparison)
  const waterBalanceData = {
    recharge: data.rechargeTotalTotal,
    naturalDischarge: data.lossTotal,
    extractable: data.extractableTotal,
    extraction: data.draftTotalTotal,
    availabilityForFuture: data.availabilityFutureTotal,
  };
  visualizations.push({
    type: "chart",
    chartType: "waterBalance",
    title: `Water Balance Overview - ${locationName}`,
    description: "Overall groundwater balance",
    data: waterBalanceData,
    explanation: generateWaterBalanceExplanation(waterBalanceData as Record<string, unknown>),
  });

  // 10. Stage of Extraction Category Status
  const stageOfExtraction = Number(data.stageOfExtractionTotal) || 0;
  const category = String(data.categoryTotal || "Unknown");
  visualizations.push({
    type: "stats",
    title: `Extraction Status & Category`,
    description: `Current stage: ${stageOfExtraction.toFixed(2)}%`,
    data: {
      stageOfExtraction,
      category,
      status: stageOfExtraction < 70 ? "Safe" : stageOfExtraction < 90 ? "Semi-Critical" : stageOfExtraction < 100 ? "Critical" : "Over-Exploited",
      healthIndicator:
        stageOfExtraction < 70 ? "Healthy" : stageOfExtraction < 90 ? "Moderate Stress" : stageOfExtraction < 100 ? "High Stress" : "Severe Stress",
    },
    threshold: {
      safe: 70,
      critical: 90,
      overExploited: 100,
    },
    explanation: getStageExplanation(stageOfExtraction) + " " + getCategoryExplanation(category),
  });

  // 11. Recharge vs Extraction Comparison (Bar Chart)
  const rechargeVsExtraction = [
    { name: "Recharge", value: data.rechargeTotalTotal },
    { name: "Extraction", value: data.draftTotalTotal },
    { name: "Natural Discharge", value: data.lossTotal },
  ].filter((r) => r.value);

  if (rechargeVsExtraction.length > 0) {
    visualizations.push({
      type: "chart",
      chartType: "bar",
      title: `Recharge vs Extraction Analysis - ${locationName}`,
      description: "Comparison of recharge, extraction, and natural discharge (ham)",
      data: rechargeVsExtraction,
      explanation:
        "This compares water coming in (recharge) versus water going out (extraction + natural discharge). For sustainable water use, recharge should be higher than extraction. If extraction exceeds recharge, water levels will drop over time.",
    });
  }

  // 12. Availability & Sustainability Metrics
  const availabilityData = {
    extractable: Number(data.extractableTotal) || 0,
    currentExtraction: Number(data.draftTotalTotal) || 0,
    futureAvailability: Number(data.availabilityFutureTotal) || 0,
    utilizationPercent: stageOfExtraction,
    remainingCapacity: Math.max(0, (Number(data.extractableTotal) || 0) - (Number(data.draftTotalTotal) || 0)),
  };

  visualizations.push({
    type: "stats",
    title: `Availability & Sustainability Metrics`,
    description: `Future availability: ${formatNumber(availabilityData.futureAvailability)} ham`,
    data: availabilityData,
    explanation: `Currently using ${availabilityData.utilizationPercent.toFixed(0)}% of available water. ${
      availabilityData.remainingCapacity > 0
        ? `There's still ${formatNumber(availabilityData.remainingCapacity)} ham of unused capacity for future needs.`
        : "All available water is being used - no room for additional extraction."
    }`,
  });

  return visualizations;
}

export function generateComparisonChartData(records: GroundwaterRecord[]): object[] {
  const visualizations: object[] = [];

  // 1. Locations Table (like the state-wise table in screenshot)
  const locationsTableData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      Name: r.location.name,
      "Rainfall (mm)": data.rainfallTotal,
      "Extractable (ham)": data.extractableTotal,
      "Extraction (ham)": data.draftTotalTotal,
      "Stage (%)": data.stageOfExtractionTotal,
    };
  });

  visualizations.push({
    type: "table",
    tableType: "locations",
    title: "Location Comparison",
    columns: ["Name", "Rainfall (mm)", "Extractable (ham)", "Extraction (ham)", "Stage (%)"],
    data: locationsTableData,
    explanation: `This table compares ${records.length} locations side by side. Look at the 'Stage (%)' column - below 70% is healthy, 70-90% needs attention, above 90% is concerning, and above 100% means water is being used faster than it can be replenished.`,
  });

  // 2. Key Metrics Comparison Bar Chart
  const comparisonData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      name: r.location.name,
      recharge: data.rechargeTotalTotal,
      extraction: data.draftTotalTotal,
      extractable: data.extractableTotal,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "grouped_bar",
    title: "Groundwater Metrics Comparison",
    description: "Comparison of recharge, extraction, and extractable resources (ham)",
    data: comparisonData,
    explanation:
      "This chart shows three key metrics for each location: recharge (water coming in), extraction (water being used), and extractable (safe limit). Ideally, extraction should be less than both recharge and extractable resources.",
  });

  // 3. Rainfall Comparison
  const rainfallData = records.map((r) => ({
    name: r.location.name,
    value: (r.data as Record<string, unknown>).rainfallTotal,
  }));

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Rainfall Comparison",
    description: "Annual rainfall across locations (mm)",
    data: rainfallData,
    color: "hsl(217, 91%, 60%)",
    explanation: generateComparisonExplanation(rainfallData as Array<{ name: string; value: unknown }>, "Rainfall", "mm"),
  });

  // 4. Stage of Extraction Comparison
  const stageData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    const stage = data.stageOfExtractionTotal as number;
    let color = "hsl(142, 71%, 45%)"; // Green for safe
    if (stage >= 100) color = "hsl(4, 90%, 58%)"; // Red for over-exploited
    else if (stage >= 90) color = "hsl(38, 92%, 50%)"; // Orange for critical
    else if (stage >= 70) color = "hsl(217, 91%, 60%)"; // Blue for semi-critical

    return {
      name: r.location.name,
      value: stage,
      category: data.categoryTotal,
      fill: color,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Stage of Extraction Comparison",
    description: "Extraction as percentage of extractable resources (%)",
    data: stageData,
    threshold: { safe: 70, critical: 90, overExploited: 100 },
    colorByValue: true,
    explanation: generateStageComparisonExplanation(stageData as Array<{ name: string; value: number; category?: string }>),
  });

  // 5. Total Recharge Comparison
  const rechargeData = records.map((r) => ({
    name: r.location.name,
    value: (r.data as Record<string, unknown>).rechargeTotalTotal,
  }));

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Total Recharge Comparison",
    description: "Annual groundwater recharge across locations (ham)",
    data: rechargeData,
    color: "hsl(142, 71%, 45%)",
    explanation: generateComparisonExplanation(rechargeData as Array<{ name: string; value: unknown }>, "Groundwater recharge", "ham"),
  });

  // 6. Total Extraction Comparison
  const extractionData = records.map((r) => ({
    name: r.location.name,
    value: (r.data as Record<string, unknown>).draftTotalTotal,
  }));

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Total Extraction Comparison",
    description: "Annual groundwater extraction across locations (ham)",
    data: extractionData,
    color: "hsl(4, 90%, 58%)",
    explanation: generateComparisonExplanation(extractionData as Array<{ name: string; value: unknown }>, "Water extraction", "ham"),
  });

  // 7. Extractable Resources Comparison
  const extractableData = records.map((r) => ({
    name: r.location.name,
    value: (r.data as Record<string, unknown>).extractableTotal,
  }));

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Extractable Resources Comparison",
    description: "Annual extractable groundwater resources (ham)",
    data: extractableData,
    color: "hsl(258, 90%, 66%)",
    explanation: generateComparisonExplanation(extractableData as Array<{ name: string; value: unknown }>, "Extractable water resources", "ham"),
  });

  // 8. Net Groundwater Balance Comparison
  const balanceData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    const recharge = Number(data.rechargeTotalTotal) || 0;
    const extraction = Number(data.draftTotalTotal) || 0;
    const loss = Number(data.lossTotal) || 0;
    return {
      name: r.location.name,
      value: recharge - extraction - loss,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: "Net Groundwater Balance Comparison",
    description: "Net balance: Recharge - Extraction - Natural Discharge (ham)",
    data: balanceData,
    color: "hsl(38, 92%, 50%)",
    explanation:
      "Net balance shows if water levels are likely to rise or fall. Positive values (bars going up) mean more water is coming in than going out - good for sustainability. Negative values mean water is being depleted faster than nature can replenish it.",
  });

  // 9. Recharge vs Extraction Multi-line Comparison
  const rechargeVsExtractionData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      name: r.location.name,
      recharge: data.rechargeTotalTotal,
      extraction: data.draftTotalTotal,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "grouped_bar",
    title: "Recharge vs Extraction Direct Comparison",
    description: "Side-by-side comparison of recharge and extraction (ham)",
    data: rechargeVsExtractionData,
    explanation:
      "This directly compares how much water is being replenished (recharge) versus how much is being used (extraction) in each location. When extraction bars are higher than recharge bars, that location is using water faster than it's being replaced.",
  });

  // 10. Category Distribution by Location
  const locationCategoryData = records.map((r) => {
    const data = r.data as Record<string, unknown>;
    const category = String(data.categoryTotal || "Unknown").trim();
    return {
      location: r.location.name,
      category: category === "null" ? "Unknown" : category,
      stage: data.stageOfExtractionTotal,
    };
  });

  // Add table showing each location's category
  visualizations.push({
    type: "table",
    tableType: "categoryByLocation",
    title: "Category by Location",
    columns: ["Location", "Category", "Stage (%)"],
    data: locationCategoryData,
    explanation:
      "This table shows the water health category for each location. 'Safe' means sustainable usage, 'Semi-Critical' and 'Critical' indicate increasing stress, and 'Over-Exploited' means water is being used faster than it's replenished.",
  });

  // Also add the aggregate pie chart
  const categoryCount: Record<string, number> = {};
  for (const item of locationCategoryData) {
    if (item.category && item.category !== "Unknown") {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    }
  }

  if (Object.keys(categoryCount).length > 0) {
    const pieData = Object.entries(categoryCount).map(([name, value]) => ({
      name,
      value,
    }));
    visualizations.push({
      type: "chart",
      chartType: "pie",
      title: "Category Distribution",
      description: "Distribution of locations by groundwater category",
      data: pieData,
      explanation: generateCategoryDistributionExplanation(pieData),
    });
  }

  return visualizations;
}

export function generateTrendChartData(records: HistoricalRecord[], locationName: string): object[] {
  const visualizations: object[] = [];

  if (records.length === 0) return visualizations;

  const sortedRecords = [...records].sort((a, b) => a.year.localeCompare(b.year));

  visualizations.push({
    type: "trend_summary",
    title: `Historical Trend: ${locationName}`,
    years: sortedRecords.map((r) => r.year),
    latestYear: sortedRecords[sortedRecords.length - 1].year,
    earliestYear: sortedRecords[0].year,
    dataPoints: sortedRecords.length,
  });

  const trendData = sortedRecords.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      year: r.year,
      recharge: Number(data.rechargeTotalTotal) || 0,
      rechargeFromRainfall: Number(data.rechargeRainfallTotal) || 0,
      rechargeFromCanal: Number(data.rechargeCanalTotal) || 0,
      rechargeFromWaterBody: Number(data.rechargeWaterBodyTotal) || 0,
      rechargeFromArtificial: Number(data.rechargeArtificialStructureTotal) || 0,
      rechargeOther: (Number(data.rechargeSurfaceIrrigationTotal) || 0) + (Number(data.rechargeGwIrrigationTotal) || 0),
      extraction: Number(data.draftTotalTotal) || 0,
      extractionIrrigation: Number(data.draftIrrigationTotal) || 0,
      extractionDomestic: Number(data.draftDomesticTotal) || 0,
      extractionIndustrial: Number(data.draftIndustrialTotal) || 0,
      extractable: Number(data.extractableTotal) || 0,
      rainfall: Number(data.rainfallTotal) || 0,
      stageOfExtraction: Number(data.stageOfExtractionTotal) || 0,
      category: data.categoryTotal,
      naturalDischarge: Number(data.lossTotal) || 0,
    };
  });

  // Table with proper key mapping
  const tableData = trendData.map((t) => ({
    year: t.year,
    "rainfall(mm)": t.rainfall,
    "recharge(ham)": t.recharge,
    "extractable(ham)": t.extractable,
    "extraction(ham)": t.extraction,
    "stage(%)": t.stageOfExtraction,
    category: t.category,
  }));

  visualizations.push({
    type: "table",
    tableType: "trend",
    title: `Year-wise Groundwater Data - ${locationName}`,
    columns: ["Year", "Rainfall (mm)", "Recharge (ham)", "Extractable (ham)", "Extraction (ham)", "Stage (%)", "Category"],
    data: tableData,
    explanation: `This table shows how groundwater conditions have changed in ${locationName} over ${tableData.length} years. Watch the 'Stage (%)' column - if it's increasing over time, water stress is getting worse. If the category changes from 'Safe' to 'Critical', it's a warning sign.`,
  });

  const extractionTrendData = trendData.map((t) => ({
    year: t.year,
    value: t.extraction,
  }));
  visualizations.push({
    type: "chart",
    chartType: "line",
    title: `Groundwater Extraction Trend - ${locationName}`,
    description: "Historical trend of groundwater extraction (ham)",
    data: extractionTrendData,
    explanation: generateTrendExplanation(extractionTrendData, "Groundwater extraction"),
  });

  const stageTrendData = trendData.map((t) => ({
    year: t.year,
    value: t.stageOfExtraction,
  }));
  visualizations.push({
    type: "chart",
    chartType: "line",
    title: `Stage of Extraction Trend - ${locationName}`,
    description: "Historical trend of extraction stage (%)",
    data: stageTrendData,
    threshold: { safe: 70, critical: 90, overExploited: 100 },
    explanation:
      generateTrendExplanation(stageTrendData, "Stage of extraction") + " Values above the red line (100%) indicate unsustainable water use.",
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: `Recharge vs Extraction Trend - ${locationName}`,
    description: "Comparison of recharge and extraction over years (ham)",
    data: trendData.map((t) => ({
      year: t.year,
      recharge: t.recharge,
      extraction: t.extraction,
    })),
    explanation:
      "This shows the race between water coming in (recharge) and water going out (extraction). When the extraction line is above the recharge line, water levels are likely falling. Ideally, recharge should stay above extraction.",
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: `Recharge Sources Breakdown - ${locationName}`,
    description: "Contribution of different recharge sources over years (ham)",
    data: trendData.map((t) => ({
      year: t.year,
      rainfall: t.rechargeFromRainfall,
      canal: t.rechargeFromCanal,
      "water bodies": t.rechargeFromWaterBody,
      "artificial structures": t.rechargeFromArtificial,
      "other irrigation": t.rechargeOther,
    })),
    explanation:
      "This breaks down where underground water recharge comes from. Rainfall is usually the biggest contributor. If rainfall recharge is declining, it could indicate changing climate patterns or reduced water absorption.",
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: `Extraction by Use Type - ${locationName}`,
    description: "Groundwater extraction breakdown: irrigation, domestic, industrial (ham)",
    data: trendData.map((t) => ({
      year: t.year,
      irrigation: t.extractionIrrigation,
      domestic: t.extractionDomestic,
      industrial: t.extractionIndustrial,
    })),
    explanation:
      "This shows who is using the groundwater. Irrigation (farming) typically uses 80-90% of groundwater. If any category is growing rapidly, it may indicate increased demand that needs to be managed.",
  });

  visualizations.push({
    type: "chart",
    chartType: "area",
    title: `Extractable Resources Trend - ${locationName}`,
    description: "Available extractable groundwater resources over years (ham)",
    data: trendData.map((t) => ({
      year: t.year,
      value: t.extractable,
    })),
    explanation:
      "This shows how much water can safely be extracted each year. A declining trend means less water is becoming available - either due to lower rainfall, reduced recharge, or ongoing over-extraction.",
  });

  const rainfallBarData = trendData.map((t) => ({
    name: t.year,
    value: t.rainfall,
  }));
  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: `Rainfall Trend - ${locationName}`,
    description: "Annual rainfall over years (mm)",
    data: rainfallBarData,
    explanation: generateRainfallTrendExplanation(rainfallBarData),
  });

  // Net Balance Chart (Recharge - Extraction)
  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: `Net Groundwater Balance - ${locationName}`,
    description: "Net balance = Recharge - Extraction (positive is good, ham)",
    data: trendData.map((t) => ({
      name: t.year,
      value: (t.recharge || 0) - (t.extraction || 0),
    })),
    explanation:
      "Positive bars (going up) mean more water is being added than removed that year - good for water levels. Negative bars (going down) mean water is being depleted. Look for patterns - consistent negative values mean ongoing water stress.",
  });

  // Sustainability Index Chart (Recharge/Extraction ratio)
  visualizations.push({
    type: "chart",
    chartType: "line",
    title: `Sustainability Index - ${locationName}`,
    description: "Ratio of Recharge to Extraction (>1 is sustainable)",
    data: trendData.map((t) => ({
      year: t.year,
      value: t.extraction && t.extraction > 0 ? (t.recharge || 0) / t.extraction : 0,
    })),
    explanation:
      "This measures sustainability: values above 1.0 mean more water is being recharged than extracted (sustainable). Values below 1.0 mean water is being used faster than it's replenished (unsustainable). Aim for 1.0 or higher.",
  });

  // Water Stress Indicator combining extraction and rainfall
  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: `Water Stress Indicators - ${locationName}`,
    description: "Normalized trends: High stage of extraction + Low rainfall = High stress",
    data: trendData.map((t) => ({
      year: t.year,
      "stage of extraction": t.stageOfExtraction,
      "rainfall index": t.rainfall ? t.rainfall / 1000 : 0, // Scaled for comparison
    })),
    explanation:
      "This combines two stress indicators: extraction stage (how much we're using) and rainfall (nature's supply). When extraction is high and rainfall is low, water stress is at its worst. Look for years where these lines diverge.",
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: `Water Balance Trend - ${locationName}`,
    description: "Recharge, extraction and natural discharge over years (ham)",
    data: trendData.map((t) => ({
      year: t.year,
      recharge: t.recharge,
      extraction: t.extraction,
      discharge: t.naturalDischarge,
    })),
    explanation:
      "This shows the complete water picture: recharge (water in), extraction (water pumped out), and natural discharge (water lost to nature). For balance, recharge should exceed extraction plus discharge.",
  });

  // Year-over-year changes
  if (trendData.length > 1) {
    const yoyData: {
      name: string;
      extraction: number;
      recharge: number;
    }[] = [];
    for (let i = 1; i < trendData.length; i++) {
      const prev = trendData[i - 1];
      const curr = trendData[i];
      yoyData.push({
        name: curr.year,
        extraction: prev.extraction && prev.extraction > 0 ? Math.round(((curr.extraction - prev.extraction) / prev.extraction) * 100 * 10) / 10 : 0,
        recharge: prev.recharge && prev.recharge > 0 ? Math.round(((curr.recharge - prev.recharge) / prev.recharge) * 100 * 10) / 10 : 0,
      });
    }

    visualizations.push({
      type: "chart",
      chartType: "grouped_bar",
      title: `Year-over-Year % Change - ${locationName}`,
      description: "Percentage change in extraction and recharge from previous year",
      data: yoyData,
      explanation: generateYoYChangeExplanation(yoyData),
    });
  }

  const categoryChanges: { year: string; category: string }[] = [];
  for (let i = 0; i < trendData.length; i++) {
    if (i === 0 || trendData[i].category !== trendData[i - 1].category) {
      categoryChanges.push({
        year: trendData[i].year,
        category: String(trendData[i].category || "Unknown"),
      });
    }
  }

  // Enhanced category changes with more insights
  const latestData = trendData[trendData.length - 1];
  const earliestData = trendData[0];
  const avgStageOfExtraction = trendData.reduce((sum, t) => sum + (t.stageOfExtraction || 0), 0) / trendData.length;

  const trendSummaryData = {
    yearsAnalyzed: trendData.length,
    categoryChanges: categoryChanges.length - 1,
    currentCategory: latestData.category || "Unknown",
    initialCategory: earliestData.category || "Unknown",
    avgStageOfExtraction: Math.round(avgStageOfExtraction * 10) / 10,
    extractionTrend: latestData.extraction > earliestData.extraction ? "Increasing" : "Decreasing",
    rechargeTrend: latestData.recharge > earliestData.recharge ? "Increasing" : "Decreasing",
    overallTrend: latestData.stageOfExtraction > earliestData.stageOfExtraction ? "Worsening" : "Improving",
  };

  const overallTrendExplanation =
    trendSummaryData.overallTrend === "Worsening"
      ? "The overall trend shows increasing water stress over the years. Conservation measures may be needed."
      : "The overall trend shows improvement - water conditions are getting better or stabilizing.";

  visualizations.push({
    type: "stats",
    title: `Trend Summary - ${locationName}`,
    data: trendSummaryData,
    explanation: `Over ${trendData.length} years, the water category changed ${categoryChanges.length - 1} time(s). Currently: ${
      trendSummaryData.currentCategory
    }. Extraction is ${trendSummaryData.extractionTrend.toLowerCase()} and recharge is ${trendSummaryData.rechargeTrend.toLowerCase()}. ${overallTrendExplanation}`,
  });

  return visualizations;
}

export function formatHistoricalDataForLLM(records: HistoricalRecord[]): string {
  if (records.length === 0) return "No historical data available.";

  const sortedRecords = [...records].sort((a, b) => a.year.localeCompare(b.year));

  const locationName = sortedRecords[0].locationName;
  const lines: string[] = [`Historical Groundwater Data for ${locationName}`, `Available Years: ${sortedRecords.map((r) => r.year).join(", ")}`, ""];

  for (const record of sortedRecords) {
    const data = record.data as Record<string, unknown>;
    lines.push(`--- ${record.year} ---`);
    lines.push(`  Category: ${data.categoryTotal || "N/A"}`);
    lines.push(`  Rainfall: ${formatNumber(data.rainfallTotal)} mm`);
    lines.push(`  Recharge: ${formatNumber(data.rechargeTotalTotal)} ham`);
    lines.push(`  Extractable: ${formatNumber(data.extractableTotal)} ham`);
    lines.push(`  Extraction: ${formatNumber(data.draftTotalTotal)} ham`);
    lines.push(`  Stage of Extraction: ${formatNumber(data.stageOfExtractionTotal)}%`);
    lines.push("");
  }

  if (sortedRecords.length >= 2) {
    const first = sortedRecords[0].data as Record<string, unknown>;
    const last = sortedRecords[sortedRecords.length - 1].data as Record<string, unknown>;

    lines.push("--- Trend Analysis ---");

    const extractionChange = calculateChange(first.draftTotalTotal, last.draftTotalTotal);
    const stageChange = calculateChange(first.stageOfExtractionTotal, last.stageOfExtractionTotal);
    const extractableChange = calculateChange(first.extractableTotal, last.extractableTotal);

    lines.push(`  Extraction Change (${sortedRecords[0].year} to ${sortedRecords[sortedRecords.length - 1].year}): ${extractionChange}`);
    lines.push(`  Stage of Extraction Change: ${stageChange}`);
    lines.push(`  Extractable Resources Change: ${extractableChange}`);
  }

  return lines.join("\n");
}

function calculateChange(oldVal: unknown, newVal: unknown): string {
  const oldNum = Number(oldVal);
  const newNum = Number(newVal);

  if (isNaN(oldNum) || isNaN(newNum) || oldNum === 0) return "N/A";

  const change = ((newNum - oldNum) / oldNum) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

export function generateHistoricalComparisonChartData(locationsData: Array<{ locationName: string; records: HistoricalRecord[] }>): object[] {
  const visualizations: object[] = [];

  if (locationsData.length === 0) return visualizations;

  const allYears = new Set<string>();
  for (const loc of locationsData) {
    for (const r of loc.records) {
      allYears.add(r.year);
    }
  }
  const sortedYears = Array.from(allYears).sort();

  const locationNames = locationsData.map((l) => l.locationName);

  // 1. Summary Table - Latest year comparison
  const latestYear = sortedYears[sortedYears.length - 1];
  const tableData = locationsData.map((loc) => {
    const latestRecord = loc.records.find((r) => r.year === latestYear);
    const data = (latestRecord?.data || {}) as Record<string, unknown>;
    return {
      Name: loc.locationName,
      Year: latestYear,
      "Rainfall (mm)": data.rainfallTotal ?? "-",
      "Recharge (ham)": data.rechargeTotalTotal ?? "-",
      "Extraction (ham)": data.draftTotalTotal ?? "-",
      "Stage (%)": data.stageOfExtractionTotal ?? "-",
      Category: data.categoryTotal ?? "-",
    };
  });

  visualizations.push({
    type: "table",
    tableType: "comparison",
    title: `Location Comparison - ${latestYear}`,
    columns: ["Name", "Year", "Rainfall (mm)", "Recharge (ham)", "Extraction (ham)", "Stage (%)", "Category"],
    data: tableData,
    explanation: `This compares ${locationsData.length} locations in ${latestYear}. Look at the 'Stage (%)' column to see which areas are under most water stress. Categories range from 'Safe' (healthy) to 'Over-Exploited' (critical).`,
  });

  // 2. Extraction Trends - Multi-location line chart
  const extractionTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      point[loc.locationName] = record ? (record.data as Record<string, unknown>).draftTotalTotal : null;
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Extraction Trends Comparison",
    description: "Groundwater extraction over years across locations (ham)",
    data: extractionTrendData,
    lines: locationNames,
    explanation: generateMultiLineTrendExplanation(extractionTrendData as Array<Record<string, unknown>>, locationNames),
  });

  // 3. Stage of Extraction Trends
  const stageTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      point[loc.locationName] = record ? (record.data as Record<string, unknown>).stageOfExtractionTotal : null;
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Stage of Extraction Trends",
    description: "Extraction stage (%) over years across locations",
    data: stageTrendData,
    lines: locationNames,
    threshold: { safe: 70, critical: 90, overExploited: 100 },
    explanation:
      "This compares water stress levels across locations over time. Lines above 70% indicate stress, above 90% is critical, and above 100% means unsustainable extraction. Watch for lines that are rising - those areas are getting more stressed.",
  });

  // 4. Recharge Trends
  const rechargeTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      point[loc.locationName] = record ? (record.data as Record<string, unknown>).rechargeTotalTotal : null;
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Recharge Trends Comparison",
    description: "Groundwater recharge over years across locations (ham)",
    data: rechargeTrendData,
    lines: locationNames,
    explanation:
      "This compares how much water is being added to underground reserves in each location. Rising lines mean improving recharge; falling lines suggest decreasing water replenishment.",
  });

  // 5. Rainfall Trends
  const rainfallTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      point[loc.locationName] = record ? (record.data as Record<string, unknown>).rainfallTotal : null;
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Rainfall Trends Comparison",
    description: "Annual rainfall over years across locations (mm)",
    data: rainfallTrendData,
    lines: locationNames,
    explanation:
      "Rainfall directly affects groundwater recharge. Compare how rainfall patterns differ between locations and over time. Locations with declining rainfall may face future water challenges.",
  });

  // 6. Extractable Resources Trends
  const extractableTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      point[loc.locationName] = record ? (record.data as Record<string, unknown>).extractableTotal : null;
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Extractable Resources Trends",
    description: "Available extractable resources over years (ham)",
    data: extractableTrendData,
    lines: locationNames,
    explanation:
      "This shows how much water can safely be extracted in each location. Declining lines indicate shrinking water availability - a warning sign for future water security.",
  });

  // 7. Net Balance Trends (Recharge - Extraction - Loss)
  const balanceTrendData = sortedYears.map((year) => {
    const point: Record<string, unknown> = { year };
    for (const loc of locationsData) {
      const record = loc.records.find((r) => r.year === year);
      if (record) {
        const data = record.data as Record<string, unknown>;
        const recharge = Number(data.rechargeTotalTotal) || 0;
        const extraction = Number(data.draftTotalTotal) || 0;
        const loss = Number(data.lossTotal) || 0;
        point[loc.locationName] = recharge - extraction - loss;
      } else {
        point[loc.locationName] = null;
      }
    }
    return point;
  });

  visualizations.push({
    type: "chart",
    chartType: "multi_line",
    title: "Net Groundwater Balance Trends",
    description: "Net balance (Recharge - Extraction - Loss) over years (ham)",
    data: balanceTrendData,
    lines: locationNames,
    explanation:
      "Positive values mean water levels are likely stable or rising; negative values mean depletion. Compare which locations have consistently positive or negative balances to understand long-term sustainability.",
  });

  // 8. Latest Year Bar Comparison - Extraction
  const latestExtractionData = locationsData.map((loc) => {
    const latestRecord = loc.records.find((r) => r.year === latestYear);
    return {
      name: loc.locationName,
      value: latestRecord ? (latestRecord.data as Record<string, unknown>).draftTotalTotal : 0,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: `Extraction Comparison - ${latestYear}`,
    description: "Groundwater extraction in latest year (ham)",
    data: latestExtractionData,
    color: "hsl(4, 90%, 58%)",
    explanation: generateComparisonExplanation(latestExtractionData as Array<{ name: string; value: unknown }>, "Water extraction", "ham"),
  });

  // 9. Latest Year Bar Comparison - Stage
  const latestStageData = locationsData.map((loc) => {
    const latestRecord = loc.records.find((r) => r.year === latestYear);
    const stage = latestRecord ? Number((latestRecord.data as Record<string, unknown>).stageOfExtractionTotal) : 0;
    let color = "hsl(142, 71%, 45%)";
    if (stage >= 100) color = "hsl(4, 90%, 58%)";
    else if (stage >= 90) color = "hsl(38, 92%, 50%)";
    else if (stage >= 70) color = "hsl(217, 91%, 60%)";
    return {
      name: loc.locationName,
      value: stage,
      fill: color,
    };
  });

  visualizations.push({
    type: "chart",
    chartType: "bar",
    title: `Stage of Extraction Comparison - ${latestYear}`,
    description: "Stage of extraction in latest year (%)",
    data: latestStageData,
    colorByValue: true,
    explanation: generateStageComparisonExplanation(
      latestStageData as Array<{
        name: string;
        value: number;
        category?: string;
      }>
    ),
  });

  return visualizations;
}
