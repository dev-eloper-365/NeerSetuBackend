import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/gw-schema.ts",
  out: "./src/db/drizzle",
  dbCredentials: {
    url: "postgresql://postgres:postgres@localhost:5432/ingres",
  },
});

