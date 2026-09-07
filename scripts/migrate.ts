import postgres from "postgres";
import { readFileSync } from "node:fs";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL");
const sql = postgres(url, { max: 1 });
await sql.begin(async (tx) => {
  await tx.unsafe(
    readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
  );
});
await sql.end();
console.log("TypeGrid schema is ready.");
