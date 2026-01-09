CREATE TYPE "public"."category" AS ENUM('safe', 'semi_critical', 'critical', 'over_exploited', 'salinity', 'hilly_area', 'no_data');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('COUNTRY', 'STATE', 'DISTRICT', 'TALUK');--> statement-breakpoint
CREATE TABLE "groundwater_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"rainfall_command" double precision,
	"rainfall_non_command" double precision,
	"rainfall_poor_quality" double precision,
	"rainfall_total" double precision,
	"category_command" text,
	"category_non_command" text,
	"category_poor_quality" text,
	"category_total" text,
	"recharge_rainfall_command" double precision,
	"recharge_rainfall_non_command" double precision,
	"recharge_rainfall_poor_quality" double precision,
	"recharge_rainfall_total" double precision,
	"recharge_canal_command" double precision,
	"recharge_canal_non_command" double precision,
	"recharge_canal_poor_quality" double precision,
	"recharge_canal_total" double precision,
	"recharge_surface_irrigation_command" double precision,
	"recharge_surface_irrigation_non_command" double precision,
	"recharge_surface_irrigation_poor_quality" double precision,
	"recharge_surface_irrigation_total" double precision,
	"recharge_gw_irrigation_command" double precision,
	"recharge_gw_irrigation_non_command" double precision,
	"recharge_gw_irrigation_poor_quality" double precision,
	"recharge_gw_irrigation_total" double precision,
	"recharge_water_body_command" double precision,
	"recharge_water_body_non_command" double precision,
	"recharge_water_body_poor_quality" double precision,
	"recharge_water_body_total" double precision,
	"recharge_artificial_structure_command" double precision,
	"recharge_artificial_structure_non_command" double precision,
	"recharge_artificial_structure_poor_quality" double precision,
	"recharge_artificial_structure_total" double precision,
	"recharge_total_command" double precision,
	"recharge_total_non_command" double precision,
	"recharge_total_poor_quality" double precision,
	"recharge_total_total" double precision,
	"loss_command" double precision,
	"loss_non_command" double precision,
	"loss_poor_quality" double precision,
	"loss_total" double precision,
	"baseflow_lateral_command" double precision,
	"baseflow_lateral_non_command" double precision,
	"baseflow_lateral_poor_quality" double precision,
	"baseflow_lateral_total" double precision,
	"baseflow_vertical_command" double precision,
	"baseflow_vertical_non_command" double precision,
	"baseflow_vertical_poor_quality" double precision,
	"baseflow_vertical_total" double precision,
	"evaporation_command" double precision,
	"evaporation_non_command" double precision,
	"evaporation_poor_quality" double precision,
	"evaporation_total" double precision,
	"transpiration_command" double precision,
	"transpiration_non_command" double precision,
	"transpiration_poor_quality" double precision,
	"transpiration_total" double precision,
	"extractable_command" double precision,
	"extractable_non_command" double precision,
	"extractable_poor_quality" double precision,
	"extractable_total" double precision,
	"total_gw_availability_command" double precision,
	"total_gw_availability_non_command" double precision,
	"total_gw_availability_poor_quality" double precision,
	"total_gw_availability_total" double precision,
	"availability_future_command" double precision,
	"availability_future_non_command" double precision,
	"availability_future_poor_quality" double precision,
	"availability_future_total" double precision,
	"draft_agriculture_command" double precision,
	"draft_agriculture_non_command" double precision,
	"draft_agriculture_poor_quality" double precision,
	"draft_agriculture_total" double precision,
	"draft_domestic_command" double precision,
	"draft_domestic_non_command" double precision,
	"draft_domestic_poor_quality" double precision,
	"draft_domestic_total" double precision,
	"draft_industry_command" double precision,
	"draft_industry_non_command" double precision,
	"draft_industry_poor_quality" double precision,
	"draft_industry_total" double precision,
	"draft_total_command" double precision,
	"draft_total_non_command" double precision,
	"draft_total_poor_quality" double precision,
	"draft_total_total" double precision,
	"stage_of_extraction_command" double precision,
	"stage_of_extraction_non_command" double precision,
	"stage_of_extraction_poor_quality" double precision,
	"stage_of_extraction_total" double precision,
	"allocation_domestic_command" double precision,
	"allocation_domestic_non_command" double precision,
	"allocation_domestic_poor_quality" double precision,
	"allocation_domestic_total" double precision,
	"allocation_industry_command" double precision,
	"allocation_industry_non_command" double precision,
	"allocation_industry_poor_quality" double precision,
	"allocation_industry_total" double precision,
	"allocation_total_command" double precision,
	"allocation_total_non_command" double precision,
	"allocation_total_poor_quality" double precision,
	"allocation_total_total" double precision,
	"area_recharge_worthy_total" double precision,
	"area_recharge_worthy_command" double precision,
	"area_recharge_worthy_non_command" double precision,
	"area_recharge_worthy_poor_quality" double precision,
	"area_non_recharge_worthy_total" double precision,
	"area_total_total" double precision,
	"report_summary" jsonb,
	CONSTRAINT "groundwater_data_location_id_unique" UNIQUE("location_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"type" "location_type" NOT NULL,
	"parent_id" uuid,
	"year" text NOT NULL,
	CONSTRAINT "locations_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
DROP TABLE "annexure1" CASCADE;--> statement-breakpoint
DROP TABLE "annexure2" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3a_state_categorization" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3b_district_categorization" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3c_state_extractable_resource" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3d_district_extractable_resource" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3e_state_area_categorization" CASCADE;--> statement-breakpoint
DROP TABLE "annexure3f_district_area_categorization" CASCADE;--> statement-breakpoint
DROP TABLE "annexure4a_categorized_units" CASCADE;--> statement-breakpoint
DROP TABLE "annexure4b_quality_problems" CASCADE;--> statement-breakpoint
DROP TABLE "attribute_detailed" CASCADE;--> statement-breakpoint
DROP TABLE "attribute_summary" CASCADE;--> statement-breakpoint
DROP TABLE "central_report" CASCADE;--> statement-breakpoint
DROP TABLE "state_report" CASCADE;--> statement-breakpoint
ALTER TABLE "groundwater_data" ADD CONSTRAINT "groundwater_data_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groundwater_data_location_id_idx" ON "groundwater_data" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "locations_parent_id_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_type_idx" ON "locations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "locations_year_idx" ON "locations" USING btree ("year");--> statement-breakpoint
CREATE INDEX "locations_external_id_idx" ON "locations" USING btree ("external_id");