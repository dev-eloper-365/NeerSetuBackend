import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  jsonb,
  pgEnum,
  index,
  timestamp,
  integer,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const locationTypeEnum = pgEnum("location_type", [
  "COUNTRY",
  "STATE",
  "DISTRICT",
  "TALUK",
]);

export const categoryEnum = pgEnum("category", [
  "safe",
  "semi_critical",
  "critical",
  "over_exploited",
  "salinity",
  "hilly_area",
  "no_data",
]);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").unique(),
    name: text("name").notNull(),
    type: locationTypeEnum("type").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => locations.id),
  },
  (table) => [
    index("locations_parent_id_idx").on(table.parentId),
    index("locations_type_idx").on(table.type),
    index("locations_external_id_idx").on(table.externalId),
    // Composite index for faster filtering by type and parent
    index("locations_type_parent_idx").on(table.type, table.parentId),
    // Index for name search (for fuzzy matching optimization)
    index("locations_name_idx").on(table.name),
    // Composite index for hierarchical queries
    index("locations_name_type_idx").on(table.name, table.type),
  ]
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  parent: one(locations, {
    fields: [locations.parentId],
    references: [locations.id],
    relationName: "parent_child",
  }),
  children: many(locations, { relationName: "parent_child" }),
  groundwaterData: many(groundwaterData),
}));

export const groundwaterData = pgTable(
  "groundwater_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    year: text("year").notNull(),

    // Rainfall (mm)
    rainfallCommand: doublePrecision("rainfall_command"),
    rainfallNonCommand: doublePrecision("rainfall_non_command"),
    rainfallPoorQuality: doublePrecision("rainfall_poor_quality"),
    rainfallTotal: doublePrecision("rainfall_total"),

    // Category
    categoryCommand: text("category_command"),
    categoryNonCommand: text("category_non_command"),
    categoryPoorQuality: text("category_poor_quality"),
    categoryTotal: text("category_total"),

    // Ground Water Recharge (ham)
    rechargeRainfallCommand: doublePrecision("recharge_rainfall_command"),
    rechargeRainfallNonCommand: doublePrecision(
      "recharge_rainfall_non_command"
    ),
    rechargeRainfallPoorQuality: doublePrecision(
      "recharge_rainfall_poor_quality"
    ),
    rechargeRainfallTotal: doublePrecision("recharge_rainfall_total"),

    rechargeCanalCommand: doublePrecision("recharge_canal_command"),
    rechargeCanalNonCommand: doublePrecision("recharge_canal_non_command"),
    rechargeCanalPoorQuality: doublePrecision("recharge_canal_poor_quality"),
    rechargeCanalTotal: doublePrecision("recharge_canal_total"),

    rechargeSurfaceIrrigationCommand: doublePrecision(
      "recharge_surface_irrigation_command"
    ),
    rechargeSurfaceIrrigationNonCommand: doublePrecision(
      "recharge_surface_irrigation_non_command"
    ),
    rechargeSurfaceIrrigationPoorQuality: doublePrecision(
      "recharge_surface_irrigation_poor_quality"
    ),
    rechargeSurfaceIrrigationTotal: doublePrecision(
      "recharge_surface_irrigation_total"
    ),

    rechargeGwIrrigationCommand: doublePrecision(
      "recharge_gw_irrigation_command"
    ),
    rechargeGwIrrigationNonCommand: doublePrecision(
      "recharge_gw_irrigation_non_command"
    ),
    rechargeGwIrrigationPoorQuality: doublePrecision(
      "recharge_gw_irrigation_poor_quality"
    ),
    rechargeGwIrrigationTotal: doublePrecision("recharge_gw_irrigation_total"),

    rechargeWaterBodyCommand: doublePrecision("recharge_water_body_command"),
    rechargeWaterBodyNonCommand: doublePrecision(
      "recharge_water_body_non_command"
    ),
    rechargeWaterBodyPoorQuality: doublePrecision(
      "recharge_water_body_poor_quality"
    ),
    rechargeWaterBodyTotal: doublePrecision("recharge_water_body_total"),

    rechargeArtificialStructureCommand: doublePrecision(
      "recharge_artificial_structure_command"
    ),
    rechargeArtificialStructureNonCommand: doublePrecision(
      "recharge_artificial_structure_non_command"
    ),
    rechargeArtificialStructurePoorQuality: doublePrecision(
      "recharge_artificial_structure_poor_quality"
    ),
    rechargeArtificialStructureTotal: doublePrecision(
      "recharge_artificial_structure_total"
    ),

    rechargeTotalCommand: doublePrecision("recharge_total_command"),
    rechargeTotalNonCommand: doublePrecision("recharge_total_non_command"),
    rechargeTotalPoorQuality: doublePrecision("recharge_total_poor_quality"),
    rechargeTotalTotal: doublePrecision("recharge_total_total"),

    // Natural Discharges (ham) / Loss
    lossCommand: doublePrecision("loss_command"),
    lossNonCommand: doublePrecision("loss_non_command"),
    lossPoorQuality: doublePrecision("loss_poor_quality"),
    lossTotal: doublePrecision("loss_total"),

    baseflowLateralCommand: doublePrecision("baseflow_lateral_command"),
    baseflowLateralNonCommand: doublePrecision("baseflow_lateral_non_command"),
    baseflowLateralPoorQuality: doublePrecision(
      "baseflow_lateral_poor_quality"
    ),
    baseflowLateralTotal: doublePrecision("baseflow_lateral_total"),

    baseflowVerticalCommand: doublePrecision("baseflow_vertical_command"),
    baseflowVerticalNonCommand: doublePrecision(
      "baseflow_vertical_non_command"
    ),
    baseflowVerticalPoorQuality: doublePrecision(
      "baseflow_vertical_poor_quality"
    ),
    baseflowVerticalTotal: doublePrecision("baseflow_vertical_total"),

    evaporationCommand: doublePrecision("evaporation_command"),
    evaporationNonCommand: doublePrecision("evaporation_non_command"),
    evaporationPoorQuality: doublePrecision("evaporation_poor_quality"),
    evaporationTotal: doublePrecision("evaporation_total"),

    transpirationCommand: doublePrecision("transpiration_command"),
    transpirationNonCommand: doublePrecision("transpiration_non_command"),
    transpirationPoorQuality: doublePrecision("transpiration_poor_quality"),
    transpirationTotal: doublePrecision("transpiration_total"),

    // Annual Extractable Ground Water Resources (ham) - currentAvailabilityForAllPurposes
    extractableCommand: doublePrecision("extractable_command"),
    extractableNonCommand: doublePrecision("extractable_non_command"),
    extractablePoorQuality: doublePrecision("extractable_poor_quality"),
    extractableTotal: doublePrecision("extractable_total"),

    // Total GW Availability
    totalGwAvailabilityCommand: doublePrecision(
      "total_gw_availability_command"
    ),
    totalGwAvailabilityNonCommand: doublePrecision(
      "total_gw_availability_non_command"
    ),
    totalGwAvailabilityPoorQuality: doublePrecision(
      "total_gw_availability_poor_quality"
    ),
    totalGwAvailabilityTotal: doublePrecision("total_gw_availability_total"),

    // Availability for Future Use
    availabilityFutureCommand: doublePrecision("availability_future_command"),
    availabilityFutureNonCommand: doublePrecision(
      "availability_future_non_command"
    ),
    availabilityFuturePoorQuality: doublePrecision(
      "availability_future_poor_quality"
    ),
    availabilityFutureTotal: doublePrecision("availability_future_total"),

    // Ground Water Extraction / Draft (ham)
    draftAgricultureCommand: doublePrecision("draft_agriculture_command"),
    draftAgricultureNonCommand: doublePrecision(
      "draft_agriculture_non_command"
    ),
    draftAgriculturePoorQuality: doublePrecision(
      "draft_agriculture_poor_quality"
    ),
    draftAgricultureTotal: doublePrecision("draft_agriculture_total"),

    draftDomesticCommand: doublePrecision("draft_domestic_command"),
    draftDomesticNonCommand: doublePrecision("draft_domestic_non_command"),
    draftDomesticPoorQuality: doublePrecision("draft_domestic_poor_quality"),
    draftDomesticTotal: doublePrecision("draft_domestic_total"),

    draftIndustryCommand: doublePrecision("draft_industry_command"),
    draftIndustryNonCommand: doublePrecision("draft_industry_non_command"),
    draftIndustryPoorQuality: doublePrecision("draft_industry_poor_quality"),
    draftIndustryTotal: doublePrecision("draft_industry_total"),

    draftTotalCommand: doublePrecision("draft_total_command"),
    draftTotalNonCommand: doublePrecision("draft_total_non_command"),
    draftTotalPoorQuality: doublePrecision("draft_total_poor_quality"),
    draftTotalTotal: doublePrecision("draft_total_total"),

    // Stage of Extraction (%)
    stageOfExtractionCommand: doublePrecision("stage_of_extraction_command"),
    stageOfExtractionNonCommand: doublePrecision(
      "stage_of_extraction_non_command"
    ),
    stageOfExtractionPoorQuality: doublePrecision(
      "stage_of_extraction_poor_quality"
    ),
    stageOfExtractionTotal: doublePrecision("stage_of_extraction_total"),

    // GW Allocation
    allocationDomesticCommand: doublePrecision("allocation_domestic_command"),
    allocationDomesticNonCommand: doublePrecision(
      "allocation_domestic_non_command"
    ),
    allocationDomesticPoorQuality: doublePrecision(
      "allocation_domestic_poor_quality"
    ),
    allocationDomesticTotal: doublePrecision("allocation_domestic_total"),

    allocationIndustryCommand: doublePrecision("allocation_industry_command"),
    allocationIndustryNonCommand: doublePrecision(
      "allocation_industry_non_command"
    ),
    allocationIndustryPoorQuality: doublePrecision(
      "allocation_industry_poor_quality"
    ),
    allocationIndustryTotal: doublePrecision("allocation_industry_total"),

    allocationTotalCommand: doublePrecision("allocation_total_command"),
    allocationTotalNonCommand: doublePrecision("allocation_total_non_command"),
    allocationTotalPoorQuality: doublePrecision(
      "allocation_total_poor_quality"
    ),
    allocationTotalTotal: doublePrecision("allocation_total_total"),

    // Area data
    areaRechargeWorthyTotal: doublePrecision("area_recharge_worthy_total"),
    areaRechargeWorthyCommand: doublePrecision("area_recharge_worthy_command"),
    areaRechargeWorthyNonCommand: doublePrecision(
      "area_recharge_worthy_non_command"
    ),
    areaRechargeWorthyPoorQuality: doublePrecision(
      "area_recharge_worthy_poor_quality"
    ),

    areaNonRechargeWorthyTotal: doublePrecision(
      "area_non_recharge_worthy_total"
    ),
    areaTotalTotal: doublePrecision("area_total_total"),

    // Report Summary (for aggregated counts at state/district level)
    reportSummary: jsonb("report_summary"),
  },
  (table) => [
    index("groundwater_data_location_id_idx").on(table.locationId),
    index("groundwater_data_year_idx").on(table.year),
    index("groundwater_data_location_year_idx").on(
      table.locationId,
      table.year
    ),
  ]
);

export const groundwaterDataRelations = relations(
  groundwaterData,
  ({ one }) => ({
    location: one(locations, {
      fields: [groundwaterData.locationId],
      references: [locations.id],
    }),
  })
);

// ==================== CHAT HISTORY SCHEMA ====================

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

// Messages table - stores individual messages in the single conversation
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    // Store visualizations (charts, tables, etc.) as JSON
    visualizations: jsonb("visualizations").$type<object[]>(),
    // Store suggestions for follow-up questions
    suggestions: jsonb("suggestions").$type<string[]>(),
    // Message order in the conversation
    sequenceNumber: integer("sequence_number").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Token count for context management
    tokenCount: integer("token_count"),
    // Metadata (tool calls, etc.)
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("messages_sequence_idx").on(table.sequenceNumber),
    index("messages_created_at_idx").on(table.createdAt),
  ]
);
