import { sql } from "drizzle-orm";
import { db } from "./gw-db";

export async function runMigrations() {
  console.log("Running database migrations...");

  try {
    // Create enums
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE location_type AS ENUM ('COUNTRY', 'STATE', 'DISTRICT', 'TALUK');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE category AS ENUM ('safe', 'semi_critical', 'critical', 'over_exploited', 'salinity', 'hilly_area', 'no_data');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create locations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id TEXT UNIQUE,
        name TEXT NOT NULL,
        type location_type NOT NULL,
        parent_id UUID REFERENCES locations(id)
      );
    `);

    // Create indexes for locations
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_parent_id_idx ON locations(parent_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_type_idx ON locations(type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_external_id_idx ON locations(external_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_type_parent_idx ON locations(type, parent_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_name_idx ON locations(name);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS locations_name_type_idx ON locations(name, type);`);

    // Create groundwater_data table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS groundwater_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
        year TEXT NOT NULL,
        rainfall_command DOUBLE PRECISION,
        rainfall_non_command DOUBLE PRECISION,
        rainfall_poor_quality DOUBLE PRECISION,
        rainfall_total DOUBLE PRECISION,
        category_command TEXT,
        category_non_command TEXT,
        category_poor_quality TEXT,
        category_total TEXT,
        recharge_rainfall_command DOUBLE PRECISION,
        recharge_rainfall_non_command DOUBLE PRECISION,
        recharge_rainfall_poor_quality DOUBLE PRECISION,
        recharge_rainfall_total DOUBLE PRECISION,
        recharge_canal_command DOUBLE PRECISION,
        recharge_canal_non_command DOUBLE PRECISION,
        recharge_canal_poor_quality DOUBLE PRECISION,
        recharge_canal_total DOUBLE PRECISION,
        recharge_surface_irrigation_command DOUBLE PRECISION,
        recharge_surface_irrigation_non_command DOUBLE PRECISION,
        recharge_surface_irrigation_poor_quality DOUBLE PRECISION,
        recharge_surface_irrigation_total DOUBLE PRECISION,
        recharge_gw_irrigation_command DOUBLE PRECISION,
        recharge_gw_irrigation_non_command DOUBLE PRECISION,
        recharge_gw_irrigation_poor_quality DOUBLE PRECISION,
        recharge_gw_irrigation_total DOUBLE PRECISION,
        recharge_water_body_command DOUBLE PRECISION,
        recharge_water_body_non_command DOUBLE PRECISION,
        recharge_water_body_poor_quality DOUBLE PRECISION,
        recharge_water_body_total DOUBLE PRECISION,
        recharge_artificial_structure_command DOUBLE PRECISION,
        recharge_artificial_structure_non_command DOUBLE PRECISION,
        recharge_artificial_structure_poor_quality DOUBLE PRECISION,
        recharge_artificial_structure_total DOUBLE PRECISION,
        recharge_total_command DOUBLE PRECISION,
        recharge_total_non_command DOUBLE PRECISION,
        recharge_total_poor_quality DOUBLE PRECISION,
        recharge_total_total DOUBLE PRECISION,
        loss_command DOUBLE PRECISION,
        loss_non_command DOUBLE PRECISION,
        loss_poor_quality DOUBLE PRECISION,
        loss_total DOUBLE PRECISION,
        baseflow_lateral_command DOUBLE PRECISION,
        baseflow_lateral_non_command DOUBLE PRECISION,
        baseflow_lateral_poor_quality DOUBLE PRECISION,
        baseflow_lateral_total DOUBLE PRECISION,
        baseflow_vertical_command DOUBLE PRECISION,
        baseflow_vertical_non_command DOUBLE PRECISION,
        baseflow_vertical_poor_quality DOUBLE PRECISION,
        baseflow_vertical_total DOUBLE PRECISION,
        evaporation_command DOUBLE PRECISION,
        evaporation_non_command DOUBLE PRECISION,
        evaporation_poor_quality DOUBLE PRECISION,
        evaporation_total DOUBLE PRECISION,
        transpiration_command DOUBLE PRECISION,
        transpiration_non_command DOUBLE PRECISION,
        transpiration_poor_quality DOUBLE PRECISION,
        transpiration_total DOUBLE PRECISION,
        extractable_command DOUBLE PRECISION,
        extractable_non_command DOUBLE PRECISION,
        extractable_poor_quality DOUBLE PRECISION,
        extractable_total DOUBLE PRECISION,
        total_gw_availability_command DOUBLE PRECISION,
        total_gw_availability_non_command DOUBLE PRECISION,
        total_gw_availability_poor_quality DOUBLE PRECISION,
        total_gw_availability_total DOUBLE PRECISION,
        availability_future_command DOUBLE PRECISION,
        availability_future_non_command DOUBLE PRECISION,
        availability_future_poor_quality DOUBLE PRECISION,
        availability_future_total DOUBLE PRECISION,
        draft_agriculture_command DOUBLE PRECISION,
        draft_agriculture_non_command DOUBLE PRECISION,
        draft_agriculture_poor_quality DOUBLE PRECISION,
        draft_agriculture_total DOUBLE PRECISION,
        draft_domestic_command DOUBLE PRECISION,
        draft_domestic_non_command DOUBLE PRECISION,
        draft_domestic_poor_quality DOUBLE PRECISION,
        draft_domestic_total DOUBLE PRECISION,
        draft_industry_command DOUBLE PRECISION,
        draft_industry_non_command DOUBLE PRECISION,
        draft_industry_poor_quality DOUBLE PRECISION,
        draft_industry_total DOUBLE PRECISION,
        draft_total_command DOUBLE PRECISION,
        draft_total_non_command DOUBLE PRECISION,
        draft_total_poor_quality DOUBLE PRECISION,
        draft_total_total DOUBLE PRECISION,
        stage_of_extraction_command DOUBLE PRECISION,
        stage_of_extraction_non_command DOUBLE PRECISION,
        stage_of_extraction_poor_quality DOUBLE PRECISION,
        stage_of_extraction_total DOUBLE PRECISION,
        allocation_domestic_command DOUBLE PRECISION,
        allocation_domestic_non_command DOUBLE PRECISION,
        allocation_domestic_poor_quality DOUBLE PRECISION,
        allocation_domestic_total DOUBLE PRECISION,
        allocation_industry_command DOUBLE PRECISION,
        allocation_industry_non_command DOUBLE PRECISION,
        allocation_industry_poor_quality DOUBLE PRECISION,
        allocation_industry_total DOUBLE PRECISION,
        allocation_total_command DOUBLE PRECISION,
        allocation_total_non_command DOUBLE PRECISION,
        allocation_total_poor_quality DOUBLE PRECISION,
        allocation_total_total DOUBLE PRECISION,
        area_recharge_worthy_total DOUBLE PRECISION,
        area_recharge_worthy_command DOUBLE PRECISION,
        area_recharge_worthy_non_command DOUBLE PRECISION,
        area_recharge_worthy_poor_quality DOUBLE PRECISION,
        area_non_recharge_worthy_total DOUBLE PRECISION,
        area_total_total DOUBLE PRECISION,
        report_summary JSONB
      );
    `);

    // Create indexes for groundwater_data
    await db.execute(sql`CREATE INDEX IF NOT EXISTS groundwater_data_location_id_idx ON groundwater_data(location_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS groundwater_data_year_idx ON groundwater_data(year);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS groundwater_data_location_year_idx ON groundwater_data(location_id, year);`);

    // Create messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role message_role NOT NULL,
        content TEXT NOT NULL,
        visualizations JSONB,
        suggestions JSONB,
        sequence_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        token_count INTEGER,
        metadata JSONB
      );
    `);

    // Create indexes for messages
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_sequence_idx ON messages(sequence_number);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);`);

    console.log("Database migrations completed successfully!");
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}
