import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  metricToField,
  metricToLabel,
  metricToUnit,
  VALID_METRICS,
} from "../utils/metricHelpers";
import { filterRecordsByYear, getFilteredYears } from "../utils/yearFiltering";
import {
  formatGroundwaterDataForLLM,
  formatHistoricalDataForLLM,
  getTopLocationsByField,
  searchAndGetGroundwaterData,
  searchAndGetHistoricalData,
} from "./groundwaterService";
import {
  getAllStates,
  getAvailableYears,
  getDistrictsOfState,
  getTaluksOfDistrict,
  searchLocation,
} from "./locationSearch";

type LocationType = "STATE" | "DISTRICT" | "TALUK";

const yearFilterSchema = {
  year: z
    .string()
    .optional()
    .describe(
      "Specific year to query. Format: YYYY-YYYY (e.g., '2024-2025', '2020-2021'). Available: 2016-2017 to 2024-2025. Defaults to 2024-2025 if not specified."
    ),
  fromYear: z
    .string()
    .optional()
    .describe(
      "Start year for historical range. Format: YYYY-YYYY. Use with toYear for trends/historical analysis."
    ),
  toYear: z
    .string()
    .optional()
    .describe(
      "End year for historical range. Format: YYYY-YYYY. Use with fromYear for trends/historical analysis."
    ),
  specificYears: z
    .array(z.string())
    .optional()
    .describe(
      "Array of specific non-consecutive years. Format: ['2016-2017', '2020-2021', '2024-2025']. Use when comparing specific years that are not sequential."
    ),
};

const searchGroundwaterDataTool = tool(
  async ({
    locationName,
    locationType,
    stateName,
    districtName,
    ...yearParams
  }) => {
    const type = locationType?.toUpperCase() as LocationType | undefined;
    const parentName =
      type === "DISTRICT"
        ? stateName
        : type === "TALUK"
        ? districtName
        : undefined;

    if (yearParams.fromYear || yearParams.toYear || yearParams.specificYears) {
      let records = await searchAndGetHistoricalData(locationName, type!);
      if (records.length === 0) {
        return JSON.stringify({
          found: false,
          message: `No historical data found for "${locationName}"`,
        });
      }
      records = filterRecordsByYear(records, yearParams);
      if (records.length === 0) {
        return JSON.stringify({
          found: false,
          message: `No data found for "${locationName}" in specified year range`,
        });
      }
      return JSON.stringify({
        found: true,
        isHistorical: true,
        locationName: records[0].locationName,
        locationId: records[0].locationId,
        locationType: type,
        yearsAvailable: records.map((r) => r.year),
        dataPointCount: records.length,
        textSummary: formatHistoricalDataForLLM(records),
      });
    }

    const record = await searchAndGetGroundwaterData(
      locationName,
      type,
      parentName,
      yearParams.year
    );
    if (!record) {
      return JSON.stringify({
        found: false,
        message: `No groundwater data found for "${locationName}"${
          parentName ? ` in ${parentName}` : ""
        }`,
      });
    }
    return JSON.stringify({
      found: true,
      locationId: record.location.id,
      locationName: record.location.name,
      locationType: record.location.type,
      year: record.year,
      textSummary: formatGroundwaterDataForLLM(record),
    });
  },
  {
    name: "search_groundwater_data",
    description: `PRIMARY TOOL for getting groundwater data for ANY single location (state, district, or taluk).

WHEN TO USE:
- User asks about a specific place: "Tell me about Karnataka", "What's the water situation in Bangalore Urban", "How is groundwater in Tumkur taluk"
- User wants current year data (default: 2024-2025)
- User wants data for a specific year or year range for ONE location

DO NOT USE WHEN:
- User wants to compare multiple locations → use compare_locations instead
- User asks "which state has highest/lowest..." → use get_top_locations instead
- User wants to see all districts in a state → use list_locations instead

HOW IT WORKS:
- Just provide the location name - fuzzy search auto-detects if it's a state, district, or taluk
- No need to specify locationType when not known - it will be inferred automatically
- Available years: 2016-2017 to 2024-2025 (defaults to 2024-2025)
- Don't explicitly ask for location type - just provide location name without type and it will be inferred automatically using fuzzy matching

EXAMPLES:
- "Karnataka" → searches states, finds Karnataka
- "Bangalore Urban" → searches districts, finds Bangalore Urban in Karnataka
- "Tumkur" → could be district or taluk, fuzzy search finds best match`,
    schema: z.object({
      locationName: z
        .string()
        .describe(
          "Name of the location to search. Can be a state (e.g., 'Karnataka', 'Tamil Nadu'), district (e.g., 'Bangalore Urban', 'Chennai'), or taluk (e.g., 'Tumkur', 'Kolar'). Fuzzy matching is applied - no need to specify the type."
        ),
      locationType: z
        .enum(["state", "district", "taluk"])
        .optional()
        .describe(
          "OPTIONAL - Leave empty to auto-detect. Only specify if you need to disambiguate (e.g., when a name exists at multiple levels)."
        ),
      stateName: z
        .string()
        .optional()
        .describe(
          "OPTIONAL - Parent state name. Only needed to disambiguate districts with same name in different states."
        ),
      districtName: z
        .string()
        .optional()
        .describe(
          "OPTIONAL - Parent district name. Only needed to disambiguate taluks with same name."
        ),
      ...yearFilterSchema,
    }),
  }
);

const compareLocationsTool = tool(
  async ({ locationNames, locationType, ...yearParams }) => {
    const type = locationType?.toUpperCase() as LocationType | undefined;

    if (yearParams.fromYear || yearParams.toYear || yearParams.specificYears) {
      const allLocationRecords: Array<{
        locationName: string;
        locationId: string;
        records: any[];
      }> = [];
      for (const name of locationNames) {
        let records = await searchAndGetHistoricalData(name, type!);
        if (records.length === 0) continue;
        records = filterRecordsByYear(records, yearParams);
        if (records.length > 0) {
          allLocationRecords.push({
            locationName: records[0].locationName,
            locationId: records[0].locationId,
            records,
          });
        }
      }
      if (allLocationRecords.length === 0) {
        return JSON.stringify({
          found: false,
          message: "No historical data found for specified locations",
        });
      }
      return JSON.stringify({
        found: true,
        isHistoricalComparison: true,
        count: allLocationRecords.length,
        locationType: type || "STATE",
        locationsCompared: allLocationRecords.map((l) => l.locationName),
        yearsAvailable: allLocationRecords[0].records.map((r) => r.year),
        dataPointCount: allLocationRecords[0].records.length,
        locationData: allLocationRecords.map((l) => ({
          locationName: l.locationName,
          locationId: l.locationId,
          locationType: type,
          years: l.records.map((r) => r.year),
        })),
        textSummary: allLocationRecords
          .map(
            (loc) =>
              `${loc.locationName}:\n${formatHistoricalDataForLLM(loc.records)}`
          )
          .join("\n\n---\n\n"),
      });
    }

    const targetYear = yearParams.year || "2024-2025";
    const records = [];
    for (const name of locationNames) {
      const record = await searchAndGetGroundwaterData(
        name,
        type,
        undefined,
        targetYear
      );
      if (record) records.push(record);
    }
    if (records.length === 0) {
      return JSON.stringify({
        found: false,
        message: "No groundwater data found for specified locations",
      });
    }
    return JSON.stringify({
      found: true,
      count: records.length,
      year: targetYear,
      locationsCompared: locationNames,
      locationIds: records.map((r) => r.location.id),
      textSummary: records
        .map((r) => formatGroundwaterDataForLLM(r))
        .join("\n\n---\n\n"),
      locations: records.map((r) => ({
        id: r.location.id,
        name: r.location.name,
        type: r.location.type,
      })),
    });
  },
  {
    name: "compare_locations",
    description: `COMPARISON TOOL for comparing groundwater data between 2-10 locations side-by-side.

WHEN TO USE:
- User wants to compare specific places: "Compare Karnataka and Tamil Nadu", "How does Bangalore compare to Chennai"
- User mentions multiple locations and wants to see differences
- User asks "which is better between X and Y" (specific locations named)

DO NOT USE WHEN:
- User asks about just ONE location → use search_groundwater_data instead
- User asks "which state has the highest..." without naming specific locations → use get_top_locations instead
- User wants to explore what locations exist → use list_locations instead

HOW IT WORKS:
- Provide 2-10 location names - fuzzy search auto-detects their types
- All locations should ideally be at the same level (all states, or all districts, etc.) for meaningful comparison
- Returns side-by-side data for all specified locations

EXAMPLES:
- Compare states: ["Karnataka", "Tamil Nadu", "Kerala"]
- Compare districts: ["Bangalore Urban", "Chennai", "Hyderabad"]
- Compare over time: Add fromYear/toYear to see how comparison changed`,
    schema: z.object({
      locationNames: z
        .array(z.string())
        .min(2)
        .max(10)
        .describe(
          "Array of 2-10 location names to compare. Fuzzy matching finds each location automatically. Example: ['Karnataka', 'Tamil Nadu'] or ['Bangalore Urban', 'Chennai', 'Mumbai']"
        ),
      locationType: z
        .enum(["state", "district", "taluk"])
        .optional()
        .describe(
          "OPTIONAL - Leave empty to auto-detect. Only specify if all locations are at the same level and you want to ensure correct matching."
        ),
      ...yearFilterSchema,
    }),
  }
);

const getHistoricalDataTool = tool(
  async ({ locationName, locationType, ...yearParams }) => {
    const type = locationType?.toUpperCase() as LocationType | undefined;
    let records = await searchAndGetHistoricalData(locationName, type);
    if (records.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No historical data found for "${locationName}"`,
        availableYears: await getAvailableYears(),
      });
    }
    records = filterRecordsByYear(records, yearParams);
    if (records.length === 0) {
      return JSON.stringify({
        found: false,
        message: `No data found for "${locationName}" in specified year range`,
      });
    }
    return JSON.stringify({
      found: true,
      locationName: records[0].locationName,
      locationId: records[0].locationId,
      locationType,
      yearsAvailable: records.map((r) => r.year),
      dataPointCount: records.length,
      textSummary: formatHistoricalDataForLLM(records),
    });
  },
  {
    name: "get_historical_data",
    description: `TREND/HISTORY TOOL for analyzing how groundwater conditions changed over time for a SINGLE location.

WHEN TO USE:
- User asks about trends: "How has Karnataka's water situation changed?", "Show me the trend for Bangalore"
- User asks about historical data: "What was the extraction rate in 2018?", "Show me data from 2016 to 2020"
- User wants to see patterns over multiple years for ONE location

DO NOT USE WHEN:
- User just wants current data → use search_groundwater_data instead
- User wants to compare multiple locations → use compare_locations (which also supports year filters)
- User asks "which states improved the most" → use get_top_locations with year filters

HOW IT WORKS:
- Provide location name - fuzzy search auto-detects type
- Returns data for all available years (2016-2017 to 2024-2025) or filtered range
- Shows year-over-year changes and trends

YEAR FILTERING:
- fromYear + toYear: Get data in range (e.g., "2018-2019" to "2022-2023")
- specificYears: Get exact years (e.g., ["2016-2017", "2020-2021", "2024-2025"])

EXAMPLES:
- "How has Karnataka changed over the years" → locationName: "Karnataka"
- "Bangalore water trend from 2018 to 2022" → locationName: "Bangalore Urban", fromYear: "2018-2019", toYear: "2022-2023"`,
    schema: z.object({
      locationName: z
        .string()
        .describe(
          "Name of the location to get historical data for. Fuzzy matching auto-detects if it's a state, district, or taluk."
        ),
      locationType: z
        .enum(["state", "district", "taluk"])
        .optional()
        .describe(
          "OPTIONAL - Leave empty to auto-detect. Only specify if needed to disambiguate."
        ),
      fromYear: z
        .string()
        .optional()
        .describe(
          "Start year for range filter. Format: YYYY-YYYY (e.g., '2018-2019'). If not specified, starts from earliest available."
        ),
      toYear: z
        .string()
        .optional()
        .describe(
          "End year for range filter. Format: YYYY-YYYY (e.g., '2022-2023'). If not specified, goes to latest available."
        ),
      specificYears: z
        .array(z.string())
        .optional()
        .describe(
          "Array of specific years to fetch. Format: ['2016-2017', '2020-2021']. Use this for non-consecutive years."
        ),
    }),
  }
);

const getTopLocationsTool = tool(
  async ({ metric, locationType, order, limit, ...yearParams }) => {
    const type = locationType.toUpperCase() as LocationType;
    const metricLabel = metricToLabel(metric);
    const metricUnit = metricToUnit(metric);
    const { isHistorical, yearsToQuery, targetYear } = await getFilteredYears(
      yearParams
    );

    if (isHistorical && yearsToQuery.length > 1) {
      const locationAggregates: Record<
        string,
        { name: string; values: number[] }
      > = {};
      const yearlyRankings: Record<string, any[]> = {};

      for (const y of yearsToQuery) {
        const records = await getTopLocationsByField(
          metric,
          type,
          order,
          limit * 2,
          y
        );
        yearlyRankings[y] = records.map((r, i) => {
          const d = r.data as Record<string, unknown>;
          const value = d[metricToField(metric)] ?? null;
          const name = r.location.name;
          if (!locationAggregates[name])
            locationAggregates[name] = { name, values: [] };
          if (value !== null)
            locationAggregates[name].values.push(Number(value));
          return { rank: i + 1, name, value, category: d.categoryTotal };
        });
      }

      const aggregatedData = Object.values(locationAggregates)
        .map((loc) => ({
          name: loc.name,
          avgValue: loc.values.length
            ? loc.values.reduce((a, b) => a + b, 0) / loc.values.length
            : 0,
          minValue: loc.values.length ? Math.min(...loc.values) : 0,
          maxValue: loc.values.length ? Math.max(...loc.values) : 0,
        }))
        .sort((a, b) =>
          order === "desc" ? b.avgValue - a.avgValue : a.avgValue - b.avgValue
        )
        .slice(0, limit);

      const trendData = yearsToQuery.map((y) => {
        const point: Record<string, unknown> = { year: y };
        for (const loc of aggregatedData.slice(0, 5)) {
          point[loc.name] =
            yearlyRankings[y]?.find((r) => r.name === loc.name)?.value ?? null;
        }
        return point;
      });

      return JSON.stringify({
        found: true,
        isHistorical: true,
        metric,
        metricLabel,
        metricUnit,
        order,
        limit,
        locationType: type,
        yearsAnalyzed: yearsToQuery,
        data: aggregatedData,
        trendData,
        textSummary: `Top ${limit} ${type}s by ${metricLabel}:\n${aggregatedData
          .map(
            (d, i) =>
              `${i + 1}. ${d.name}: ${d.avgValue.toFixed(
                2
              )} ${metricUnit} (range: ${d.minValue.toFixed(
                2
              )} - ${d.maxValue.toFixed(2)})`
          )
          .join("\n")}`,
      });
    }

    const records = await getTopLocationsByField(
      metric,
      type,
      order,
      limit,
      targetYear
    );
    if (records.length === 0)
      return JSON.stringify({ found: false, message: "No data found" });

    const data = records.map((r, i) => {
      const d = r.data as Record<string, unknown>;
      return {
        rank: i + 1,
        name: r.location.name,
        value: d[metricToField(metric)],
        category: d.categoryTotal,
        stageOfExtraction: d.stageOfExtractionTotal,
        rainfall: d.rainfallTotal,
        recharge: d.rechargeTotalTotal,
        extraction: d.draftTotalTotal,
      };
    });

    return JSON.stringify({
      found: true,
      metric,
      metricLabel,
      metricUnit,
      order,
      limit,
      locationType: type,
      year: targetYear,
      data,
      textSummary: `Top ${limit} ${type}s by ${metricLabel}:\n${data
        .map(
          (d) =>
            `${d.rank}. ${d.name}: ${Number(d.value).toFixed(
              2
            )} ${metricUnit} (Category: ${d.category})`
        )
        .join("\n")}`,
    });
  },
  {
    name: "get_top_locations",
    description: `RANKING TOOL for finding best/worst performing locations by any metric. Use for "which state has highest/lowest..." questions.

WHEN TO USE:
- User asks ranking questions: "Which state has the highest extraction?", "Top 5 districts with lowest rainfall"
- User asks about best/worst: "Which areas are over-exploited?", "Safest districts for water"
- User wants leaderboard-style data without naming specific locations
- User asks "where is groundwater situation best/worst"

DO NOT USE WHEN:
- User names specific locations to look up → use search_groundwater_data
- User names specific locations to compare → use compare_locations
- User asks about a specific place's data → use search_groundwater_data

AVAILABLE METRICS (what to rank by):
- rainfall: Annual rainfall in mm
- recharge: Total groundwater recharge (how much water goes into ground) in MCM
- extraction: Total groundwater draft/extraction (how much pumped out) in MCM
- stage_of_extraction: Extraction as % of recharge (below 70% = safe, above 100% = over-exploited)
- extractable_resources: Net groundwater available for use in MCM

LOCATION TYPES:
- state: Rank all 36 states/UTs in India
- district: Rank all ~750 districts
- taluk: Rank all ~6000+ taluks

ORDER:
- desc: Highest first (for "most", "highest", "top")
- asc: Lowest first (for "least", "lowest", "bottom")

EXAMPLES:
- "Which states use the most groundwater?" → metric: "extraction", locationType: "state", order: "desc"
- "Top 10 over-exploited districts" → metric: "stage_of_extraction", locationType: "district", order: "desc", limit: 10
- "States with best water situation" → metric: "stage_of_extraction", locationType: "state", order: "asc" (lowest extraction % = safest)`,
    schema: z.object({
      metric: z
        .enum(VALID_METRICS as [string, ...string[]])
        .describe(
          `The metric to rank by. Options: ${VALID_METRICS.join(
            ", "
          )}. Use 'stage_of_extraction' for water stress/health questions, 'extraction' for usage questions, 'recharge' for replenishment questions, 'rainfall' for precipitation questions.`
        ),
      locationType: z
        .enum(["state", "district", "taluk"])
        .describe(
          "Level at which to rank. Use 'state' for broad national picture, 'district' for regional analysis, 'taluk' for local granularity."
        ),
      order: z
        .enum(["asc", "desc"])
        .default("desc")
        .describe(
          "Sort order. 'desc' for highest/most/worst first. 'asc' for lowest/least/best first. Default: desc."
        ),
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(10)
        .describe(
          "Number of results to return (1-20). Default: 10. Use lower for quick overview, higher for comprehensive list."
        ),
      ...yearFilterSchema,
    }),
  }
);

const listLocationsTool = tool(
  async ({ locationType, parentName }) => {
    let locations;
    if (locationType === "state") {
      locations = getAllStates();
    } else if (locationType === "district" && parentName) {
      const stateResults = searchLocation(
        parentName.replace(/[_-]/g, " "),
        "STATE"
      );
      if (stateResults.length === 0)
        return JSON.stringify({
          found: false,
          message: `State "${parentName}" not found`,
        });
      locations = getDistrictsOfState(stateResults[0].location.id);
    } else if (locationType === "taluk" && parentName) {
      const districtResults = searchLocation(
        parentName.replace(/[_-]/g, " "),
        "DISTRICT"
      );
      if (districtResults.length === 0)
        return JSON.stringify({
          found: false,
          message: `District "${parentName}" not found`,
        });
      locations = getTaluksOfDistrict(districtResults[0].location.id);
    } else {
      return JSON.stringify({
        found: false,
        message: "For districts/taluks, provide parent name.",
      });
    }
    return JSON.stringify({
      found: true,
      count: locations.length,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
      })),
    });
  },
  {
    name: "list_locations",
    description: `EXPLORATION TOOL for discovering what locations exist in the database. Use to show hierarchy or enumerate child locations.

WHEN TO USE:
- User asks "What districts are in Karnataka?", "Show me all states", "List taluks in Bangalore Urban"
- User wants to explore/browse locations before asking about specific data
- User needs to know valid location names to query
- User asks about administrative divisions or hierarchy

DO NOT USE WHEN:
- User asks for groundwater DATA about a location → use search_groundwater_data
- User wants to compare locations → use compare_locations
- User wants rankings → use get_top_locations

HIERARCHY (India's administrative structure):
- India (country) → 36 States/UTs → ~750 Districts → ~6000+ Taluks/Tehsils/Mandals

HOW TO USE:
- For all states: locationType: "state" (no parentName needed)
- For districts in a state: locationType: "district", parentName: "Karnataka"
- For taluks in a district: locationType: "taluk", parentName: "Bangalore Urban"

EXAMPLES:
- "What are all the states?" → locationType: "state"
- "Districts in Tamil Nadu" → locationType: "district", parentName: "Tamil Nadu"
- "Taluks in Mysore district" → locationType: "taluk", parentName: "Mysore"`,
    schema: z.object({
      locationType: z
        .enum(["state", "district", "taluk"])
        .describe(
          "What type of locations to list. 'state' lists all 36 states/UTs. 'district' lists districts in a state. 'taluk' lists taluks in a district."
        ),
      parentName: z
        .string()
        .optional()
        .describe(
          "Parent location name. Required for district (provide state name) and taluk (provide district name). Not needed for state."
        ),
    }),
  }
);

export const allTools = [
  searchGroundwaterDataTool,
  compareLocationsTool,
  getTopLocationsTool,
  listLocationsTool,
  getHistoricalDataTool,
];
