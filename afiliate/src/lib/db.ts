import { mkdir } from "node:fs/promises";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type GlobalDb = {
  afiliatePool?: pg.Pool;
  afiliateLocal?: Promise<PGlite>;
};

const g = globalThis as unknown as GlobalDb;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    g.afiliatePool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await g.afiliatePool.query(text, params)).rows as T[];
  }
  g.afiliateLocal ??= startLocal().catch((error: unknown) => {
    g.afiliateLocal = undefined;
    throw error;
  });
  return (await g.afiliateLocal).query<T>(text, params).then((result) => result.rows);
}

async function startLocal(): Promise<PGlite> {
  await mkdir("data", { recursive: true });
  const db = new PGlite("data/afiliate");
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}

export function asBuffer(value: unknown): Buffer | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  return null;
}
