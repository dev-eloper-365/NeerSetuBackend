import { Router, type IRouter } from "express";
import { db } from "../db/gw-db";
import { groundwaterData, locations } from "../db/gw-schema";
import { eq, and } from "drizzle-orm";
import { searchLocation } from "../services/locationSearch";

const router: IRouter = Router();
const LATEST_YEAR = "2024-2025";

interface MapLocationData {
  id: string;
  name: string;
  type: string;
  category: string | null;
  stageOfExtraction: number | null;
  extractable: number | null;
  extraction: number | null;
  rainfall: number | null;
}

// Get all states with their groundwater status
router.get("/states", async (req, res) => {
  try {
    const year = (req.query.year as string) || LATEST_YEAR;

    const result = await db
      .select({
        id: locations.id,
        externalId: locations.externalId,
        name: locations.name,
        type: locations.type,
        year: groundwaterData.year,
        category: groundwaterData.categoryTotal,
        stageOfExtraction: groundwaterData.stageOfExtractionTotal,
        extractable: groundwaterData.extractableTotal,
        extraction: groundwaterData.draftTotalTotal,
        rainfall: groundwaterData.rainfallTotal,
      })
      .from(locations)
      .leftJoin(
        groundwaterData,
        and(
          eq(locations.id, groundwaterData.locationId),
          eq(groundwaterData.year, year)
        )
      )
      .where(eq(locations.type, "STATE"));

    res.json(result);
  } catch (error) {
    console.error("Error fetching states:", error);
    res.status(500).json({ error: "Failed to fetch states" });
  }
});

// Get districts of a state
router.get("/states/:stateId/districts", async (req, res) => {
  try {
    const { stateId } = req.params;
    const year = (req.query.year as string) || LATEST_YEAR;

    const result = await db
      .select({
        id: locations.id,
        externalId: locations.externalId,
        name: locations.name,
        type: locations.type,
        year: groundwaterData.year,
        category: groundwaterData.categoryTotal,
        stageOfExtraction: groundwaterData.stageOfExtractionTotal,
        extractable: groundwaterData.extractableTotal,
        extraction: groundwaterData.draftTotalTotal,
        rainfall: groundwaterData.rainfallTotal,
      })
      .from(locations)
      .leftJoin(
        groundwaterData,
        and(
          eq(locations.id, groundwaterData.locationId),
          eq(groundwaterData.year, year)
        )
      )
      .where(
        and(eq(locations.type, "DISTRICT"), eq(locations.parentId, stateId))
      );

    res.json(result);
  } catch (error) {
    console.error("Error fetching districts:", error);
    res.status(500).json({ error: "Failed to fetch districts" });
  }
});

// Get taluks of a district
router.get("/districts/:districtId/taluks", async (req, res) => {
  try {
    const { districtId } = req.params;
    const year = (req.query.year as string) || LATEST_YEAR;

    const result = await db
      .select({
        id: locations.id,
        externalId: locations.externalId,
        name: locations.name,
        type: locations.type,
        year: groundwaterData.year,
        category: groundwaterData.categoryTotal,
        stageOfExtraction: groundwaterData.stageOfExtractionTotal,
        extractable: groundwaterData.extractableTotal,
        extraction: groundwaterData.draftTotalTotal,
        rainfall: groundwaterData.rainfallTotal,
      })
      .from(locations)
      .leftJoin(
        groundwaterData,
        and(
          eq(locations.id, groundwaterData.locationId),
          eq(groundwaterData.year, year)
        )
      )
      .where(
        and(eq(locations.type, "TALUK"), eq(locations.parentId, districtId))
      );

    res.json(result);
  } catch (error) {
    console.error("Error fetching taluks:", error);
    res.status(500).json({ error: "Failed to fetch taluks" });
  }
});

// Get detailed data for multiple locations (for comparison)
router.post("/locations/details", async (req, res) => {
  try {
    const { locationIds, year } = req.body as {
      locationIds: string[];
      year?: string;
    };
    const targetYear = year || LATEST_YEAR;

    if (!locationIds || !Array.isArray(locationIds)) {
      return res.status(400).json({ error: "locationIds array required" });
    }

    const results = [];
    for (const id of locationIds) {
      const result = await db
        .select()
        .from(groundwaterData)
        .innerJoin(locations, eq(groundwaterData.locationId, locations.id))
        .where(and(eq(locations.id, id), eq(groundwaterData.year, targetYear)))
        .limit(1);

      if (result.length > 0) {
        results.push({
          location: {
            id: result[0].locations.id,
            name: result[0].locations.name,
            type: result[0].locations.type,
          },
          year: result[0].groundwater_data.year,
          data: result[0].groundwater_data,
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching location details:", error);
    res.status(500).json({ error: "Failed to fetch location details" });
  }
});

// Search locations by name (for highlighting from chat)
router.get("/search", async (req, res) => {
  try {
    const { query, type } = req.query as { query: string; type?: string };

    if (!query) {
      return res.status(400).json({ error: "query parameter required" });
    }

    const locationType = type?.toUpperCase() as
      | "STATE"
      | "DISTRICT"
      | "TALUK"
      | undefined;
    const results = searchLocation(query, locationType);

    res.json(
      results.map((r) => ({
        id: r.location.id,
        name: r.location.name,
        type: r.location.type,
        score: r.score,
      }))
    );
  } catch (error) {
    console.error("Error searching locations:", error);
    res.status(500).json({ error: "Failed to search locations" });
  }
});

// Get location hierarchy (for breadcrumb navigation)
router.get("/locations/:locationId/hierarchy", async (req, res) => {
  try {
    const { locationId } = req.params;
    const hierarchy: { id: string; name: string; type: string }[] = [];

    let currentId: string | null = locationId;
    while (currentId) {
      const result = await db
        .select()
        .from(locations)
        .where(eq(locations.id, currentId))
        .limit(1);

      if (result.length === 0) break;

      hierarchy.unshift({
        id: result[0].id,
        name: result[0].name,
        type: result[0].type,
      });

      currentId = result[0].parentId;
    }

    res.json(hierarchy);
  } catch (error) {
    console.error("Error fetching hierarchy:", error);
    res.status(500).json({ error: "Failed to fetch hierarchy" });
  }
});

export default router;
