import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distPagefindDir = resolve("dist", "pagefind");
const vercelStaticDir = resolve(".vercel", "output", "static");
const vercelPagefindDir = resolve(vercelStaticDir, "pagefind");
const vercelConfigPath = resolve(".vercel", "output", "config.json");

const DOWNLOAD_CLIENT_PATTERN =
	"(?i).*(idm|internet download manager|aria2|aria2c|xunlei|thunder|fdm|free download manager|motrix|bitcomet|wget|curl|python-requests|okhttp|go-http-client|powershell).*";

const downloadGuardRoute = {
	src: "^/(.*)$",
	has: [
		{
			type: "header",
			key: "user-agent",
			value: DOWNLOAD_CLIENT_PATTERN,
		},
	],
	dest: "/403.html",
	status: 403,
};

function isDownloadGuardRoute(route) {
	if (!route || route.src !== "^/(.*)$" || route.dest !== "/403.html") {
		return false;
	}
	if (route.status !== 403 || !Array.isArray(route.has)) {
		return false;
	}
	return route.has.some(
		(item) =>
			item &&
			item.type === "header" &&
			item.key === "user-agent" &&
			item.value === DOWNLOAD_CLIENT_PATTERN,
	);
}

function patchVercelConfig() {
	if (!existsSync(vercelConfigPath)) {
		console.log("[sync-pagefind] .vercel/output/config.json not found, skip guard route.");
		return;
	}

	const raw = readFileSync(vercelConfigPath, "utf-8");
	const config = JSON.parse(raw);
	const routes = Array.isArray(config.routes) ? config.routes : [];
	const filteredRoutes = routes.filter((route) => !isDownloadGuardRoute(route));

	config.routes = [downloadGuardRoute, ...filteredRoutes];
	writeFileSync(vercelConfigPath, `${JSON.stringify(config, null, "\t")}\n`, "utf-8");
	console.log("[sync-pagefind] Added download-client guard route to .vercel/output/config.json.");
}

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
patchVercelConfig();
