import Fuse from "fuse.js";
import { db } from "../db/gw-db";
import { locations, groundwaterData } from "../db/gw-schema";
import { eq } from "drizzle-orm";

export interface LocationRecord {
  id: string;
  externalId: string | null;
  name: string;
  type: "COUNTRY" | "STATE" | "DISTRICT" | "TALUK";
  parentId: string | null;
}

let locationCache: LocationRecord[] = [];
let fuse: Fuse<LocationRecord> | null = null;

export async function initLocationSearch(retries = 5, delay = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      locationCache = await db.select().from(locations);

      fuse = new Fuse(locationCache, {
        keys: ["name"],
        threshold: 0.4,
        includeScore: true,
        ignoreLocation: true,
      });
      
      console.log(`Location search initialized with ${locationCache.length} locations`);
      return;
    } catch (error) {
      console.error(`Failed to initialize location search (attempt ${i + 1}/${retries}):`, error);
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed to initialize location search after ${retries} attempts`);
      }
    }
  }
}

export interface SearchResult {
  location: LocationRecord;
  score: number;
}

export function searchLocation(
  query: string,
  type?: "COUNTRY" | "STATE" | "DISTRICT" | "TALUK",
  parentName?: string
): SearchResult[] {
  if (!fuse) {
    throw new Error(
      "Location search not initialized. Call initLocationSearch first."
    );
  }

  const normalizedQuery = query.replace(/[_-]/g, " ").trim();
  const results = fuse.search(normalizedQuery);

  let filtered = results;
  if (type) {
    filtered = results.filter((r) => r.item.type === type);
  }

  if (parentName && type === "DISTRICT") {
    const normalizedParent = parentName
      .replace(/[_-]/g, " ")
      .trim()
      .toLowerCase();
    const stateResults = fuse.search(normalizedParent);
    const matchingStateIds = stateResults
      .filter((r) => r.item.type === "STATE")
      .slice(0, 3)
      .map((r) => r.item.id);

    if (matchingStateIds.length > 0) {
      const parentFiltered = filtered.filter((r) =>
        matchingStateIds.includes(r.item.parentId ?? "")
      );
      if (parentFiltered.length > 0) {
        filtered = parentFiltered;
      }
    }
  }

  if (parentName && type === "TALUK") {
    const normalizedParent = parentName
      .replace(/[_-]/g, " ")
      .trim()
      .toLowerCase();
    const districtResults = fuse.search(normalizedParent);
    const matchingDistrictIds = districtResults
      .filter((r) => r.item.type === "DISTRICT")
      .slice(0, 3)
      .map((r) => r.item.id);

    if (matchingDistrictIds.length > 0) {
      const parentFiltered = filtered.filter((r) =>
        matchingDistrictIds.includes(r.item.parentId ?? "")
      );
      if (parentFiltered.length > 0) {
        filtered = parentFiltered;
      }
    }
  }

  return filtered.slice(0, 5).map((r) => ({
    location: r.item,
    score: 1 - (r.score ?? 0),
  }));
}

export function searchState(query: string): SearchResult[] {
  return searchLocation(query, "STATE");
}

export function searchDistrict(
  query: string,
  stateName?: string
): SearchResult[] {
  return searchLocation(query, "DISTRICT", stateName);
}

export function searchTaluk(
  query: string,
  districtName?: string
): SearchResult[] {
  return searchLocation(query, "TALUK", districtName);
}

export async function getLocationById(
  id: string
): Promise<LocationRecord | null> {
  const result = await db
    .select()
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getLocationByExternalId(
  externalId: string
): Promise<LocationRecord | null> {
  const result = await db
    .select()
    .from(locations)
    .where(eq(locations.externalId, externalId))
    .limit(1);
  return result[0] ?? null;
}

export async function getChildren(parentId: string): Promise<LocationRecord[]> {
  return db.select().from(locations).where(eq(locations.parentId, parentId));
}

export async function getLocationHierarchy(
  locationId: string
): Promise<LocationRecord[]> {
  const hierarchy: LocationRecord[] = [];
  let currentId: string | null = locationId;

  while (currentId) {
    const location = await getLocationById(currentId);
    if (!location) break;
    hierarchy.unshift(location);
    currentId = location.parentId;
  }

  return hierarchy;
}

export function getAllStates(): LocationRecord[] {
  return locationCache.filter((l) => l.type === "STATE");
}

export function getAllDistricts(): LocationRecord[] {
  return locationCache.filter((l) => l.type === "DISTRICT");
}

export function getDistrictsOfState(stateId: string): LocationRecord[] {
  return locationCache.filter(
    (l) => l.type === "DISTRICT" && l.parentId === stateId
  );
}

export function getTaluksOfDistrict(districtId: string): LocationRecord[] {
  return locationCache.filter(
    (l) => l.type === "TALUK" && l.parentId === districtId
  );
}

export async function getAvailableYears(): Promise<string[]> {
  const result = await db
    .selectDistinct({ year: groundwaterData.year })
    .from(groundwaterData);
  return result.map((r) => r.year).sort();
}

export function getLocationsByNameAndType(
  name: string,
  type: "COUNTRY" | "STATE" | "DISTRICT" | "TALUK"
): LocationRecord[] {
  const normalizedName = name.replace(/[_-]/g, " ").trim().toLowerCase();
  return locationCache.filter(
    (l) =>
      l.type === type &&
      l.name.replace(/[_-]/g, " ").trim().toLowerCase() === normalizedName
  );
}
