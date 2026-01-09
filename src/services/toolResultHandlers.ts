import logger from "../utils/logger";
import {
  getGroundwaterDataByLocationId,
  generateChartData,
  generateTrendChartData,
  searchAndGetHistoricalData,
  generateComparisonChartData,
  generateHistoricalComparisonChartData,
} from "./groundwaterService";

type LocationType = "STATE" | "DISTRICT" | "TALUK";

interface ChartCallback {
  (chart: object): void;
}

interface ToolResult {
  found: boolean;
  [key: string]: unknown;
}

export async function handleSearchGroundwaterData(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  if (!result.found) return;

  // Historical data response
  if (result.isHistorical && result.locationId) {
    await handleHistoricalSearch(result, onChart);
    return;
  }

  // Single year response
  if (result.locationId) {
    await handleSingleYearSearch(result, onChart);
  }
}

async function handleHistoricalSearch(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  logger.debug(
    { locationId: result.locationId, yearsCount: result.dataPointCount },
    "Processing search_groundwater_data (historical)"
  );

  const historicalRecords = await searchAndGetHistoricalData(
    result.locationName as string,
    (result.locationType as string)?.toUpperCase() as LocationType
  );

  const yearsAvailable = result.yearsAvailable as string[];
  const filteredRecords = historicalRecords.filter((r) =>
    yearsAvailable.includes(r.year)
  );

  if (filteredRecords.length === 0) {
    logger.warn(
      { locationName: result.locationName },
      "No historical records found after filtering"
    );
    return;
  }

  const yearRange =
    yearsAvailable.length > 1
      ? `${yearsAvailable[0]} to ${yearsAvailable[yearsAvailable.length - 1]}`
      : yearsAvailable[0];

  const visualizations = generateTrendChartData(
    filteredRecords,
    result.locationName as string
  );

  onChart({
    type: "data_container",
    title: `Historical Trends - ${result.locationName}`,
    subtitle: `${result.dataPointCount} years of data: ${yearRange}`,
    locationId: result.locationId,
    locationName: result.locationName,
    visualizations,
  });
}

async function handleSingleYearSearch(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  logger.debug(
    { locationId: result.locationId, year: result.year },
    "Processing search_groundwater_data (single year)"
  );

  const fullRecord = await getGroundwaterDataByLocationId(
    result.locationId as string,
    result.year as string
  );

  if (!fullRecord) {
    logger.warn(
      { locationId: result.locationId },
      "Failed to fetch full record"
    );
    return;
  }

  const visualizations = generateChartData(fullRecord);

  logger.debug(
    { visualizationsCount: visualizations.length },
    "Generated visualizations for search tool"
  );

  onChart({
    type: "data_container",
    title: `Groundwater Data - ${result.locationName}`,
    subtitle: `${result.locationType} • Year: ${result.year || "2024-2025"}`,
    locationId: result.locationId,
    locationName: result.locationName,
    year: result.year || "2024-2025",
    visualizations,
  });
}

export async function handleCompareLocations(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  if (!result.found) return;

  // Multi-year historical comparison
  if (result.isHistoricalComparison && result.locationData) {
    await handleHistoricalComparison(result, onChart);
    return;
  }

  // Single year comparison
  if (result.locationIds) {
    await handleSingleYearComparison(result, onChart);
  }
}

async function handleHistoricalComparison(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  logger.debug(
    { locationsCount: result.count, yearsCount: result.dataPointCount },
    "Processing compare_locations (historical)"
  );

  const locationData = result.locationData as Array<{
    locationName: string;
    locationId: string;
    locationType?: LocationType;
    years: string[];
  }>;

  const defaultLocationType = (result.locationType as LocationType) || "STATE";
  const yearsAvailable = result.yearsAvailable as string[];
  const yearRange =
    yearsAvailable.length > 1
      ? `${yearsAvailable[0]} to ${yearsAvailable[yearsAvailable.length - 1]}`
      : yearsAvailable[0];

  const locationsWithRecords: Array<{
    locationName: string;
    records: Awaited<ReturnType<typeof searchAndGetHistoricalData>>;
  }> = [];

  for (const locData of locationData) {
    const locType = locData.locationType || defaultLocationType;

    const historicalRecords = await searchAndGetHistoricalData(
      locData.locationName,
      locType
    );

    const filteredRecords = historicalRecords.filter((r) =>
      locData.years.includes(r.year)
    );

    if (filteredRecords.length > 0) {
      locationsWithRecords.push({
        locationName: locData.locationName,
        records: filteredRecords,
      });
    }
  }

  if (locationsWithRecords.length === 0) {
    logger.warn("No records found for historical comparison");
    return;
  }

  const visualizations =
    generateHistoricalComparisonChartData(locationsWithRecords);
  const locationsCompared = result.locationsCompared as string[];

  logger.debug(
    {
      locationsCount: locationsWithRecords.length,
      visualizationsCount: visualizations.length,
    },
    "Generated historical comparison visualizations"
  );

  onChart({
    type: "data_container",
    title: `Historical Comparison - ${locationsCompared.join(", ")}`,
    subtitle: `${locationsWithRecords.length} locations • ${yearsAvailable.length} years: ${yearRange}`,
    visualizations,
  });
}

async function handleSingleYearComparison(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  logger.debug(
    { locationsCount: result.count, year: result.year },
    "Processing compare_locations (single year)"
  );

  const locationIds = result.locationIds as string[];
  const records = [];

  for (const locationId of locationIds) {
    const record = await getGroundwaterDataByLocationId(
      locationId,
      result.year as string
    );
    if (record) records.push(record);
  }

  if (records.length === 0) {
    logger.warn("No records found for comparison");
    return;
  }

  const visualizations = generateComparisonChartData(records);

  logger.debug(
    { visualizationsCount: visualizations.length },
    "Generated visualizations for comparison"
  );

  const locationsCompared = result.locationsCompared as string[];

  onChart({
    type: "data_container",
    title: `Location Comparison - ${locationsCompared.join(", ")}`,
    subtitle: `${result.count} locations • Year: ${result.year}`,
    visualizations,
  });
}

export async function handleGetHistoricalData(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  if (!result.found || !result.locationId) return;

  logger.debug(
    { locationId: result.locationId, locationType: result.locationType },
    "Processing get_historical_data"
  );

  const historicalRecords = await searchAndGetHistoricalData(
    result.locationName as string,
    (result.locationType as string)?.toUpperCase() as LocationType
  );

  const yearsAvailable = result.yearsAvailable as string[];
  const filteredRecords = historicalRecords.filter((r) =>
    yearsAvailable.includes(r.year)
  );

  if (filteredRecords.length === 0) {
    logger.warn(
      { locationName: result.locationName },
      "No historical records found after filtering"
    );
    return;
  }

  const yearRange =
    yearsAvailable.length > 1
      ? `${yearsAvailable[0]} to ${yearsAvailable[yearsAvailable.length - 1]}`
      : yearsAvailable[0];

  const visualizations = generateTrendChartData(
    filteredRecords,
    result.locationName as string
  );

  logger.debug(
    { visualizationsCount: visualizations.length },
    "Generated visualizations for historical data"
  );

  onChart({
    type: "data_container",
    title: `Historical Trends - ${result.locationName}`,
    subtitle: `${result.dataPointCount} years of data: ${yearRange}`,
    locationId: result.locationId,
    locationName: result.locationName,
    visualizations,
  });
}

export async function handleGetTopLocations(
  result: ToolResult,
  onChart: ChartCallback
): Promise<void> {
  if (!result.found) return;

  const metricLabel = result.metricLabel as string;
  const metricUnit = result.metricUnit as string;
  const locationType = result.locationType as string;
  const limit = (result.limit as number) || 10;

  if (result.isHistorical && result.trendData) {
    const yearsAnalyzed = result.yearsAnalyzed as string[];
    const data = result.data as Array<{
      name: string;
      avgValue: number;
      minValue: number;
      maxValue: number;
    }>;
    const trendData = result.trendData as Array<Record<string, unknown>>;

    const yearRange =
      yearsAnalyzed.length > 1
        ? `${yearsAnalyzed[0]} to ${yearsAnalyzed[yearsAnalyzed.length - 1]}`
        : yearsAnalyzed[0];

    const visualizations = [
      {
        type: "collapsible",
        title: `Top ${limit} ${locationType}s by ${metricLabel} (${yearRange})`,
        defaultOpen: true,
        children: [
          {
            type: "table",
            tableType: "ranking",
            title: `Average ${metricLabel} Rankings`,
            columns: ["Name", `Avg (${metricUnit})`, "Min", "Max"],
            data: data.map((d) => ({
              name: d.name,
              avg: d.avgValue,
              min: d.minValue,
              max: d.maxValue,
            })),
          },
          {
            type: "chart",
            chartType: "bar",
            title: `Average ${metricLabel}`,
            description: `Over ${yearsAnalyzed.length} years`,
            data: data.map((d) => ({ name: d.name, value: d.avgValue })),
          },
        ],
      },
      {
        type: "collapsible",
        title: "Historical Trend Analysis",
        defaultOpen: false,
        children: [
          {
            type: "chart",
            chartType: "multi_line",
            title: `${metricLabel} Trends`,
            description: `Top 5 ${locationType}s over time`,
            data: trendData,
            lines: data.slice(0, 5).map((d) => d.name),
          },
        ],
      },
    ];

    onChart({
      type: "data_container",
      title: `Top ${limit} ${locationType}s by ${metricLabel}`,
      subtitle: `Historical analysis: ${yearRange}`,
      visualizations,
    });
    return;
  }

  const year = result.year as string;
  const data = result.data as Array<{
    rank: number;
    name: string;
    value: number;
    category: string;
    stageOfExtraction: number;
    rainfall: number;
    recharge: number;
    extraction: number;
  }>;

  // Count categories, filtering out null/undefined
  const categoryCounts: Record<string, number> = {};
  data.forEach((d) => {
    const cat = String(d.category || "").trim();
    if (cat && cat !== "null" && cat !== "undefined" && cat !== "") {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });

  const getStageColor = (stage: number): string => {
    if (stage >= 100) return "hsl(4, 90%, 58%)";
    if (stage >= 90) return "hsl(38, 92%, 50%)";
    if (stage >= 70) return "hsl(217, 91%, 60%)";
    return "hsl(142, 71%, 45%)";
  };

  const rankingTableChildren = [
    {
      type: "table",
      tableType: "ranking",
      title: `${metricLabel} Rankings`,
      columns: ["Rank", "Name", `${metricLabel} (${metricUnit})`, "Category"],
      data: data.map((d) => ({
        Rank: d.rank,
        Name: d.name,
        [`${metricLabel} (${metricUnit})`]: Number(d.value || 0).toFixed(2),
        Category: d.category || "N/A",
      })),
    },
    {
      type: "chart",
      chartType: "bar",
      title: metricLabel,
      description: result.order === "desc" ? "Highest values" : "Lowest values",
      data: data.map((d) => ({ name: d.name, value: Number(d.value || 0) })),
    },
  ];

  const categoryAnalysisChildren = [
    {
      type: "chart",
      chartType: "bar",
      title: "Stage of Extraction",
      description: "Extraction %",
      data: data.map((d) => ({
        name: d.name,
        value: Number(d.stageOfExtraction) || 0,
        fill: getStageColor(Number(d.stageOfExtraction) || 0),
      })),
      colorByValue: true,
      threshold: { safe: 70, critical: 90, overExploited: 100 },
    },
  ];

  // Only add pie chart if we have valid categories
  if (Object.keys(categoryCounts).length > 0) {
    categoryAnalysisChildren.push({
      type: "chart",
      chartType: "pie",
      title: "Category Distribution",
      description: "By groundwater category",
      data: Object.entries(categoryCounts).map(([name, value]) => ({
        name,
        value,
      })),
    } as any);
  }

  const visualizations = [
    {
      type: "collapsible",
      title: `Top ${limit} ${locationType}s by ${metricLabel} (${year})`,
      defaultOpen: true,
      children: rankingTableChildren,
    },
    {
      type: "collapsible",
      title: "Category & Stage Analysis",
      defaultOpen: false,
      children: categoryAnalysisChildren,
    },
  ];

  logger.debug(
    { visualizationsCount: visualizations.length },
    "Generated visualizations for get_top_locations"
  );

  onChart({
    type: "data_container",
    title: `Top ${limit} ${locationType}s by ${metricLabel}`,
    subtitle: `Year: ${year}`,
    visualizations,
  });
}

export async function processToolResult(
  toolName: string,
  resultJson: string,
  onChart: ChartCallback
): Promise<void> {
  try {
    const result = JSON.parse(resultJson) as ToolResult;

    switch (toolName) {
      case "search_groundwater_data":
        await handleSearchGroundwaterData(result, onChart);
        break;

      case "compare_locations":
        await handleCompareLocations(result, onChart);
        break;

      case "get_historical_data":
        await handleGetHistoricalData(result, onChart);
        break;

      case "get_top_locations":
        await handleGetTopLocations(result, onChart);
        break;
    }
  } catch (error) {
    logger.debug({ error, toolName }, "Failed to parse tool result");
  }
}
