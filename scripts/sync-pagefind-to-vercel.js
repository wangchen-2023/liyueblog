import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const distPagefindDir = resolve("dist", "pagefind");
const vercelStaticDir = resolve(".vercel", "output", "static");
const vercelPagefindDir = resolve(vercelStaticDir, "pagefind");

if (!existsSync(distPagefindDir)) {
	console.log("[sync-pagefind] dist/pagefind not found, skip sync.");
	process.exit(0);
}

if (!existsSync(vercelStaticDir)) {
	console.log("[sync-pagefind] .vercel/output/static not found, skip sync.");
	process.exit(0);
}

mkdirSync(vercelPagefindDir, { recursive: true });
cpSync(distPagefindDir, vercelPagefindDir, { recursive: true, force: true });
console.log("[sync-pagefind] Synced dist/pagefind to .vercel/output/static/pagefind.");
