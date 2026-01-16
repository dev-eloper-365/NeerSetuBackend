import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./gw-schema";

// Build connection string from individual env vars or use DATABASE_URL
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'ingres'}`;

console.log('Connecting to database:', connectionString.replace(/:[^:@]+@/, ':****@'));

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
