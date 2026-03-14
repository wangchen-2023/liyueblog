import type { APIRoute } from "astro";
import { matchDevCredential } from "@utils/dev-auth-server";

export const prerender = false;

type TrashAction = "list" | "move" | "restore" | "delete";

type TrashRequest = {
	action?: TrashAction;
	postId?: string;
	devCode?: string;
	devCodeHash?: string;
};

type GitHubFile = {
	sha: string;
	content: string;
};

type TrashedPost = {
	id: string;
	slug: string;
	title: string;
	published: string;
	trashedAt: string;
};

const POSTS_ROOT = "src/content/posts/";

function encodeGitHubPath(path: string): string {
	return path
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function json(status: number, payload: Record<string, unknown>) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
		},
	});
}

async function parseTrashRequest(request: Request): Promise<TrashRequest> {
	const raw = await request.text();
	if (!raw) return {};
	try {
		return JSON.parse(raw) as TrashRequest;
	} catch {
		const params = new URLSearchParams(raw);
		return {
			action: (params.get("action") || "") as TrashAction,
			postId: params.get("postId") || "",
			devCode: params.get("devCode") || "",
			devCodeHash: params.get("devCodeHash") || "",
		};
	}
}

function toYamlString(input: string): string {
	return `"${input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function sanitizePostId(input: string | undefined): string {
	if (!input) return "";
	const normalized = input.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	if (!normalized.endsWith(".md")) return "";
	if (normalized.includes("..")) return "";
	if (normalized.startsWith("src/content/posts/")) {
		return normalized.slice(POSTS_ROOT.length);
	}
	return normalized;
}

function toRepoPath(postId: string): string {
	return `${POSTS_ROOT}${postId}`;
}

function decodeGithubBase64(content: string): string {
	return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeGithubBase64(content: string): string {
	return Buffer.from(content, "utf8").toString("base64");
}

function splitFrontmatter(markdown: string): {
	frontmatter: string;
	body: string;
} | null {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return null;
	return {
		frontmatter: match[1] || "",
		body: markdown.slice(match[0].length),
	};
}

function upsertFrontmatterLine(
	lines: string[],
	key: string,
	value: string | null,
): string[] {
	const keyPattern = new RegExp(`^\\s*${key}\\s*:`);
	const nextLines: string[] = [];
	let found = false;

	for (const line of lines) {
		if (keyPattern.test(line)) {
			found = true;
			if (value !== null) {
				nextLines.push(`${key}: ${value}`);
			}
			continue;
		}
		nextLines.push(line);
	}

	if (!found && value !== null) {
		nextLines.push(`${key}: ${value}`);
	}

	while (nextLines.length > 0 && nextLines[nextLines.length - 1]?.trim() === "") {
		nextLines.pop();
	}

	return nextLines;
}

function applyTrashFlag(markdown: string, trashed: boolean): string {
	const parsed = splitFrontmatter(markdown);
	if (!parsed) {
		throw new Error("文章内容缺少 frontmatter");
	}

	let frontmatterLines = parsed.frontmatter.split(/\r?\n/);
	frontmatterLines = upsertFrontmatterLine(
		frontmatterLines,
		"trashed",
		trashed ? "true" : "false",
	);
	frontmatterLines = upsertFrontmatterLine(
		frontmatterLines,
		"trashedAt",
		trashed ? toYamlString(new Date().toISOString()) : null,
	);

	const normalizedBody = parsed.body.replace(/^\r?\n/, "");
	const rebuilt = `---\n${frontmatterLines.join("\n")}\n---\n\n${normalizedBody}`;
	return rebuilt.replace(/\n*$/, "\n");
}

function parseFrontmatterValue(frontmatter: string, key: string): string {
	const matched = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
	if (!matched) return "";
	return matched[1]?.trim() || "";
}

function unquoteYamlValue(rawValue: string): string {
	const value = rawValue.trim();
	if (!value) return "";
	if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
		return value
			.slice(1, -1)
			.replace(/\\"/g, '"')
			.replace(/\\\\/g, "\\");
	}
	if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
		return value.slice(1, -1).replace(/''/g, "'");
	}
	return value;
}

function parseFrontmatterBool(frontmatter: string, key: string): boolean {
	const value = parseFrontmatterValue(frontmatter, key).toLowerCase();
	return value === "true";
}

function toSlugFromRepoPath(path: string): string {
	let slug = path
		.replace(new RegExp(`^${POSTS_ROOT}`), "")
		.replace(/\.md$/i, "");
	if (slug.endsWith("/index")) {
		slug = slug.slice(0, -"/index".length);
	}
	return slug;
}

async function readRepoFile(params: {
	githubBase: string;
	path: string;
	branch: string;
	headers: Record<string, string>;
}): Promise<GitHubFile | null> {
	const response = await fetch(
		`${params.githubBase}/contents/${encodeGitHubPath(params.path)}?ref=${encodeURIComponent(params.branch)}`,
		{
			headers: params.headers,
		},
	);

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`读取 GitHub 文件失败: ${response.status} ${errText}`);
	}

	const result = (await response.json()) as {
		sha?: string;
		content?: string;
	};

	if (!result.sha || !result.content) {
		throw new Error("GitHub 返回文件数据不完整");
	}

	return {
		sha: result.sha,
		content: decodeGithubBase64(result.content),
	};
}

async function writeRepoFile(params: {
	githubBase: string;
	path: string;
	branch: string;
	headers: Record<string, string>;
	sha: string;
	content: string;
	commitMessage: string;
}): Promise<string> {
	const response = await fetch(
		`${params.githubBase}/contents/${encodeGitHubPath(params.path)}`,
		{
		method: "PUT",
		headers: {
			...params.headers,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message: params.commitMessage,
			content: encodeGithubBase64(params.content),
			branch: params.branch,
			sha: params.sha,
		}),
	},
	);

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`提交 GitHub 失败: ${response.status} ${errText}`);
	}

	const result = (await response.json()) as {
		commit?: { html_url?: string };
	};

	return result.commit?.html_url || "";
}

async function deleteRepoFile(params: {
	githubBase: string;
	path: string;
	branch: string;
	headers: Record<string, string>;
	sha: string;
	commitMessage: string;
}): Promise<string> {
	const response = await fetch(
		`${params.githubBase}/contents/${encodeGitHubPath(params.path)}`,
		{
		method: "DELETE",
		headers: {
			...params.headers,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message: params.commitMessage,
			branch: params.branch,
			sha: params.sha,
		}),
	},
	);

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`删除 GitHub 文件失败: ${response.status} ${errText}`);
	}

	const result = (await response.json()) as {
		commit?: { html_url?: string };
	};

	return result.commit?.html_url || "";
}

function extractTrashedPost(path: string, markdown: string): TrashedPost | null {
	const parsed = splitFrontmatter(markdown);
	if (!parsed) return null;
	if (!parseFrontmatterBool(parsed.frontmatter, "trashed")) return null;

	const slug = toSlugFromRepoPath(path);
	const titleRaw = parseFrontmatterValue(parsed.frontmatter, "title");
	const title = unquoteYamlValue(titleRaw) || slug || "未命名文章";
	const publishedRaw = parseFrontmatterValue(parsed.frontmatter, "published");
	const trashedAtRaw = parseFrontmatterValue(parsed.frontmatter, "trashedAt");

	return {
		id: path.replace(new RegExp(`^${POSTS_ROOT}`), ""),
		slug,
		title,
		published: unquoteYamlValue(publishedRaw),
		trashedAt: unquoteYamlValue(trashedAtRaw),
	};
}

async function listTrashedPosts(params: {
	githubBase: string;
	branch: string;
	headers: Record<string, string>;
}): Promise<TrashedPost[]> {
	const treeResponse = await fetch(
		`${params.githubBase}/git/trees/${encodeURIComponent(params.branch)}?recursive=1`,
		{
			headers: params.headers,
		},
	);

	if (!treeResponse.ok) {
		const errText = await treeResponse.text();
		throw new Error(`读取仓库目录失败: ${treeResponse.status} ${errText}`);
	}

	const treePayload = (await treeResponse.json()) as {
		tree?: Array<{ path?: string; type?: string }>;
	};

	const postPaths = (treePayload.tree || [])
		.filter((item) => item.type === "blob" && typeof item.path === "string")
		.map((item) => item.path || "")
		.filter((path) => path.startsWith(POSTS_ROOT) && path.endsWith(".md"));

	const trashedPosts: TrashedPost[] = [];
	for (const path of postPaths) {
		const file = await readRepoFile({
			githubBase: params.githubBase,
			path,
			branch: params.branch,
			headers: params.headers,
		});
		if (!file) continue;
		const parsed = extractTrashedPost(path, file.content);
		if (parsed) {
			trashedPosts.push(parsed);
		}
	}

	return trashedPosts.sort((a, b) => {
		const timeA = a.trashedAt ? new Date(a.trashedAt).getTime() : 0;
		const timeB = b.trashedAt ? new Date(b.trashedAt).getTime() : 0;
		return timeB - timeA;
	});
}

async function triggerDeployHook(hookUrl: string | undefined): Promise<boolean> {
	if (!hookUrl) return false;
	try {
		const response = await fetch(hookUrl, { method: "POST" });
		return response.ok;
	} catch {
		return false;
	}
}

export const POST: APIRoute = async ({ request }) => {
	const githubToken = import.meta.env.GITHUB_TOKEN;
	const githubOwner = import.meta.env.GITHUB_OWNER;
	const githubRepo = import.meta.env.GITHUB_REPO;
	const githubBranch = import.meta.env.GITHUB_BRANCH || "main";
	const vercelDeployHook = import.meta.env.VERCEL_DEPLOY_HOOK_URL;
	const expectedCode = import.meta.env.DEV_EDITOR_CODE || "liyue233";

	if (!githubToken || !githubOwner || !githubRepo) {
		return json(500, {
			ok: false,
			message:
				"缺少发布环境变量：GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO",
		});
	}

	let body: TrashRequest;
	try {
		body = await parseTrashRequest(request);
	} catch {
		return json(400, { ok: false, message: "请求体不是有效 JSON" });
	}

	if (
		!matchDevCredential({
			devCode: body.devCode,
			devCodeHash: body.devCodeHash,
			expectedCode,
		})
	) {
		return json(403, { ok: false, message: "开发者口令校验失败" });
	}

	const action = body.action || "list";
	if (!["list", "move", "restore", "delete"].includes(action)) {
		return json(400, { ok: false, message: "不支持的动作" });
	}

	const githubBase = `https://api.github.com/repos/${githubOwner}/${githubRepo}`;
	const commonHeaders = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${githubToken}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};

	try {
		if (action === "list") {
			const posts = await listTrashedPosts({
				githubBase,
				branch: githubBranch,
				headers: commonHeaders,
			});
			return json(200, { ok: true, posts });
		}

		const postId = sanitizePostId(body.postId);
		if (!postId) {
			return json(400, { ok: false, message: "postId 无效" });
		}

		const path = toRepoPath(postId);
		const existingFile = await readRepoFile({
			githubBase,
			path,
			branch: githubBranch,
			headers: commonHeaders,
		});
		if (!existingFile) {
			return json(404, { ok: false, message: "文章文件不存在" });
		}

		if (action === "delete") {
			const commitUrl = await deleteRepoFile({
				githubBase,
				path,
				branch: githubBranch,
				headers: commonHeaders,
				sha: existingFile.sha,
				commitMessage: `chore(post): delete ${postId}`,
			});
			const deployed = await triggerDeployHook(vercelDeployHook);
			return json(200, {
				ok: true,
				action,
				path,
				postId,
				commitUrl,
				deployed,
			});
		}

		const shouldTrash = action === "move";
		const nextMarkdown = applyTrashFlag(existingFile.content, shouldTrash);
		if (nextMarkdown === existingFile.content) {
			return json(200, {
				ok: true,
				action,
				path,
				postId,
				commitUrl: "",
				deployed: false,
			});
		}

		const commitUrl = await writeRepoFile({
			githubBase,
			path,
			branch: githubBranch,
			headers: commonHeaders,
			sha: existingFile.sha,
			content: nextMarkdown,
			commitMessage: `chore(post): ${shouldTrash ? "trash" : "restore"} ${postId}`,
		});
		const deployed = await triggerDeployHook(vercelDeployHook);

		return json(200, {
			ok: true,
			action,
			path,
			postId,
			commitUrl,
			deployed,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "垃圾桶操作失败";
		return json(502, { ok: false, message });
	}
};

export const GET: APIRoute = async () => {
	return json(200, {
		ok: true,
		message: "Use POST with action=list|move|restore|delete.",
	});
};
