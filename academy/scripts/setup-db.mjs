import fs from "node:fs";
import { Pool } from "pg";

const DSN = process.env.DATABASE_URL;
if (!DSN) { console.error("DATABASE_URL 이 없습니다."); process.exit(1); }
const u = new URL(DSN); u.searchParams.delete("sslmode");

const pool = new Pool({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== "true" },
});
const sql = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await pool.query(sql);
const { rows } = await pool.query("select count(*)::int n from academy.posts");
console.log(`academy 스키마 적용 완료 · 현재 글 ${rows[0].n}개`);
await pool.end();
