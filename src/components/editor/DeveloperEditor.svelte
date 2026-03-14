<script lang="ts">
import {
	getDraftById,
	listDrafts,
	listDraftTrash,
	migrateLegacyDraft,
	removeDraft,
	saveDraft,
} from "@utils/dev-draft-utils";
import {
	clearDeveloperModeAutoLock,
	getDeveloperModeEnabled,
	scheduleDeveloperModeAutoLock,
} from "@utils/setting-utils";
import { readStoredDevCredential } from "@utils/dev-auth-client";
import { onMount, tick } from "svelte";
import "@toast-ui/editor/dist/toastui-editor.css";

const AUTO_SAVE_INTERVAL = 12000;
const DEV_EDITOR_MARKDOWN_ONLY_STORAGE_KEY = "devEditorMarkdownOnlyMode";
const EDITOR_HEIGHT_RATIO = 0.68;
const EDITOR_MIN_HEIGHT = 520;
const EDITOR_MAX_HEIGHT = 820;

type EditorInstance = {
	getMarkdown: () => string;
	setMarkdown: (content: string) => void;
	on: (event: string, handler: () => void) => void;
	changeMode?: (mode: "markdown" | "wysiwyg", withoutFocus?: boolean) => void;
	destroy: () => void;
};

let editorHost: HTMLDivElement | null = null;
let editor: EditorInstance | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

let title = "";
let slug = "";
let originalSlug = "";
let description = "";
let tags = "";
let category = "";
let image = "";
let draft = false;
let published = "";

let isLocked = true;
let isSubmitting = false;
let statusText = "等待输入";
let notice = "";
let noticeType: "info" | "success" | "error" = "info";
let localSlugConflictMessage = "";
let dirty = false;
let userTouchedSlug = false;
let editorInitError = "";
let activeDraftId = "";
let pendingDraftToLoad: ReturnType<typeof getDraftById> = null;
let showLoadDraftPrompt = false;
let editorFocused = false;
let markdownOnlyMode = false;
let toolbarIconObserver: MutationObserver | null = null;

const TOOLBAR_ICON_STROKE_WIDTH = "2.05";
const DETAILS_PLACEHOLDER_TAG = "details-placeholder";
const MARKDOWN_ONLY_TAB_CLASS = "dev-markdown-only-tab";
const EDITOR_LINK_URL_INPUT_ID = "toastuiLinkUrlInput";
const URL_HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const DOMAIN_LIKE_URL_PATTERN =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#].*)?$/i;

function markDirty() {
	if (showLoadDraftPrompt) {
		pendingDraftToLoad = null;
		showLoadDraftPrompt = false;
	}
	dirty = true;
	statusText = "编辑中...";
}

function buildToolbarSvg(paths: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${TOOLBAR_ICON_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

const TOOLBAR_SVG_ICON_MAP: Record<string, string> = {
	heading: buildToolbarSvg('<path d="M8 6v12M16 6v12M8 12h8"></path>'),
	bold: buildToolbarSvg(
		'<path d="M14 12a4 4 0 0 0 0-8H8v8M15 20a4 4 0 0 0 0-8H8v8"></path>',
	),
	italic: buildToolbarSvg('<path d="M19 4h-9M14 20H5M15 4 9 20"></path>'),
	strike: buildToolbarSvg(
		'<path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16"></path>',
	),
	hrline: buildToolbarSvg(
		'<path d="M5 12h14M5 9h2M17 9h2M5 15h2M17 15h2"></path>',
	),
	quote: buildToolbarSvg(
		'<path d="M9 9H5v5h4l2-3V9Zm10 0h-4v5h4l2-3V9Z"></path>',
	),
	"bullet-list": buildToolbarSvg(
		'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>',
	),
	"ordered-list": buildToolbarSvg(
		'<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>',
	),
	"task-list": buildToolbarSvg(
		'<path d="M10 6h10M10 12h10M10 18h10M3.5 6.2l1.2 1.2 2.3-2.3M3.5 12.2l1.2 1.2 2.3-2.3M3.5 18.2l1.2 1.2 2.3-2.3"></path>',
	),
	indent: buildToolbarSvg(
		'<path d="M4 6h16M8 12h12M4 18h16M10 9l3 3-3 3"></path>',
	),
	outdent: buildToolbarSvg(
		'<path d="M4 6h16M4 12h12M4 18h16M10 9 7 12l3 3"></path>',
	),
	table: buildToolbarSvg(
		'<rect x="3.5" y="5" width="17" height="14" rx="1"></rect><path d="M3.5 10h17M9 5v14M15 5v14"></path>',
	),
	link: buildToolbarSvg(
		'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
	),
	image: buildToolbarSvg(
		'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>',
	),
	code: buildToolbarSvg('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"></path>'),
	codeblock: buildToolbarSvg(
		'<path d="m9 9-3 3 3 3M15 9l3 3-3 3M4 5h16M4 19h16"></path>',
	),
	more: buildToolbarSvg('<path d="M6 12h.01M12 12h.01M18 12h.01"></path>'),
};

type HtmlToken = {
	type: "openTag" | "closeTag" | "html" | "text";
	tagName?: string;
	content?: string;
	attributes?: Record<string, string>;
	outerNewLine?: boolean;
};

type CustomHtmlNode = {
	wysiwygNode?: boolean;
	literal?: string | null;
	attrs?: Record<string, string>;
	childrenHTML?: string;
};

function renderLiteralHtmlToken(
	node: CustomHtmlNode,
	outerNewLine = false,
): HtmlToken {
	return {
		type: "html",
		content: typeof node.literal === "string" ? node.literal : "",
		...(outerNewLine ? { outerNewLine: true } : {}),
	};
}

function renderWysiwygHtmlBlockTokens(
	tagName: string,
	node: CustomHtmlNode,
	outerNewLine = false,
): HtmlToken[] {
	const tokens: HtmlToken[] = [
		{
			type: "openTag",
			tagName,
			attributes: node.attrs || {},
			...(outerNewLine ? { outerNewLine: true } : {}),
		},
	];
	if (node.childrenHTML) {
		tokens.push({
			type: "html",
			content: node.childrenHTML,
		});
	}
	tokens.push({
		type: "closeTag",
		tagName,
		...(outerNewLine ? { outerNewLine: true } : {}),
	});
	return tokens;
}

const CUSTOM_DETAILS_HTML_RENDERER = {
	htmlBlock: {
		details: (node: CustomHtmlNode): HtmlToken | HtmlToken[] => {
			if (!node.wysiwygNode) {
				return renderLiteralHtmlToken(node, true);
			}
			return renderWysiwygHtmlBlockTokens("details", node, true);
		},
	},
};

function getToolbarIconName(button: Element): string | null {
	for (const className of button.classList) {
		if (
			className !== "toastui-editor-toolbar-icons" &&
			className !== "active"
		) {
			return className;
		}
	}
	return null;
}

function applyToolbarSvgIcons() {
	if (!editorHost) return;
	const buttons = editorHost.querySelectorAll<HTMLButtonElement>(
		".toastui-editor-defaultUI-toolbar .toastui-editor-toolbar-icons",
	);
	for (const button of buttons) {
		const iconName = getToolbarIconName(button);
		if (!iconName) continue;
		const iconSvg = TOOLBAR_SVG_ICON_MAP[iconName];
		if (!iconSvg) continue;
		if (button.dataset.svgIconName === iconName) continue;
		button.innerHTML = iconSvg;
		button.dataset.svgIconName = iconName;
	}
}

function syncToolbarSvgIconsSoon() {
	window.requestAnimationFrame(() => {
		applyToolbarSvgIcons();
	});
}

function startToolbarIconObserver() {
	if (!editorHost) return;
	const toolbar = editorHost.querySelector<HTMLElement>(
		".toastui-editor-defaultUI-toolbar",
	);
	if (!toolbar) return;
	if (toolbarIconObserver) {
		toolbarIconObserver.disconnect();
	}
	toolbarIconObserver = new MutationObserver(() => {
		syncToolbarSvgIconsSoon();
	});
	toolbarIconObserver.observe(toolbar, {
		childList: true,
		subtree: true,
	});
}

function stopToolbarIconObserver() {
	if (!toolbarIconObserver) return;
	toolbarIconObserver.disconnect();
	toolbarIconObserver = null;
}

function normalizeInsertedLinkUrl(input: string): string {
	const value = input.trim();
	if (!value) return "";
	if (value.startsWith("/") || value.startsWith("#")) {
		return value;
	}
	if (value.startsWith("//")) {
		return `https:${value}`;
	}
	if (URL_HAS_SCHEME_PATTERN.test(value)) {
		return value;
	}
	if (value.startsWith("www.") || DOMAIN_LIKE_URL_PATTERN.test(value)) {
		return `https://${value}`;
	}
	return value;
}

function normalizeLinkPopupInputValue(scope: ParentNode): void {
	const input = scope.querySelector<HTMLInputElement>(
		`#${EDITOR_LINK_URL_INPUT_ID}`,
	);
	if (!input) return;
	const normalizedUrl = normalizeInsertedLinkUrl(input.value);
	if (!normalizedUrl || normalizedUrl === input.value) return;
	input.value = normalizedUrl;
}

function bindLinkPopupUrlNormalization(host: HTMLElement): () => void {
	const handleLinkPopupClickCapture = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const okButton = target.closest(
			".toastui-editor-popup-add-link .toastui-editor-ok-button",
		);
		if (!okButton) return;
		normalizeLinkPopupInputValue(host);
	};

	const handleLinkInputEnterCapture = (event: KeyboardEvent) => {
		if (event.key !== "Enter") return;
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return;
		if (target.id !== EDITOR_LINK_URL_INPUT_ID) return;
		const normalizedUrl = normalizeInsertedLinkUrl(target.value);
		if (!normalizedUrl || normalizedUrl === target.value) return;
		target.value = normalizedUrl;
	};

	host.addEventListener("click", handleLinkPopupClickCapture, true);
	host.addEventListener("keydown", handleLinkInputEnterCapture, true);

	return () => {
		host.removeEventListener("click", handleLinkPopupClickCapture, true);
		host.removeEventListener("keydown", handleLinkInputEnterCapture, true);
	};
}

function readMarkdownOnlyModePreference(): boolean {
	const stored = localStorage.getItem(DEV_EDITOR_MARKDOWN_ONLY_STORAGE_KEY);
	return stored === "true";
}

function persistMarkdownOnlyModePreference(enabled: boolean): void {
	localStorage.setItem(
		DEV_EDITOR_MARKDOWN_ONLY_STORAGE_KEY,
		enabled ? "true" : "false",
	);
}

function setMarkdownOnlyMode(enabled: boolean): void {
	markdownOnlyMode = enabled;
	persistMarkdownOnlyModePreference(enabled);
	if (enabled) {
		editor?.changeMode?.("markdown", true);
	}
	window.requestAnimationFrame(() => {
		localizeModeSwitchLabels();
	});
}

function getStoredDevCredentialValue(): string {
	return readStoredDevCredential();
}

function armDeveloperModeAutoLock(): void {
	scheduleDeveloperModeAutoLock();
}

function showNotice(
	message: string,
	type: "info" | "success" | "error" = "info",
) {
	notice = message;
	noticeType = type;
	if (type === "error") {
		return;
	}
	setTimeout(() => {
		if (notice === message) {
			notice = "";
		}
	}, 2800);
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");
}

function getEffectiveSlugValue(rawSlug: string, rawTitle: string): string {
	return slugify((rawSlug || "").trim() || (rawTitle || "").trim());
}

function getLocalSlugConflictMessage(): string {
	const currentSlug = getEffectiveSlugValue(slug, title);
	if (!currentSlug) return "";

	const duplicateCount = listDrafts().filter((item) => {
		if (activeDraftId && item.id === activeDraftId) {
			return false;
		}
		return getEffectiveSlugValue(item.slug, item.title) === currentSlug;
	}).length;

	if (duplicateCount < 1) return "";
	return `草稿箱中还有 ${duplicateCount} 篇草稿使用 slug "${currentSlug}"`;
}

function createDraftId(): string {
	const base = slugify(slug || title) || "draft";
	const usedIds = new Set([
		...listDrafts().map((item) => item.id),
		...listDraftTrash().map((item) => item.id),
	]);
	if (!usedIds.has(base)) {
		return base;
	}

	let suffix = 2;
	while (usedIds.has(`${base}-${suffix}`)) {
		suffix += 1;
	}
	return `${base}-${suffix}`;
}

function buildDraftId(): string {
	if (activeDraftId) return activeDraftId;
	return createDraftId();
}

function buildDraftPayload() {
	return {
		id: buildDraftId(),
		title,
		slug,
		originalSlug,
		description,
		tags,
		category,
		image,
		draft,
		content: getEditorMarkdownNormalized(),
		published,
	};
}

function persistDraft(silent = false) {
	if (!editor) return;
	const payload = buildDraftPayload();
	activeDraftId = payload.id;
	saveDraft(payload);
	dirty = false;
	statusText = `已自动保存 ${new Date().toLocaleTimeString()}`;
	if (!silent) {
		showNotice("草稿已自动保存", "success");
	}
}

function applyDraft(payload: ReturnType<typeof getDraftById>) {
	if (!payload) return;
	activeDraftId = payload.id || "";
	title = payload.title || "";
	slug = payload.slug || "";
	originalSlug = payload.originalSlug || "";
	description = payload.description || "";
	tags = payload.tags || "";
	category = payload.category || "";
	image = payload.image || "";
	draft = Boolean(payload.draft);
	published = payload.published || "";
	if (editor) {
		editor.setMarkdown(cleanupLegacyDetailsArtifacts(payload.content || ""));
	}
	dirty = false;
	pendingDraftToLoad = null;
	showLoadDraftPrompt = false;
	statusText = "已加载本地草稿";
}

function loadPendingDraft() {
	if (!pendingDraftToLoad) return;
	applyDraft(pendingDraftToLoad);
}

function skipPendingDraft() {
	pendingDraftToLoad = null;
	showLoadDraftPrompt = false;
	statusText = "已忽略本地草稿";
}

function tryLoadDraft() {
	if (!editor) return;
	const params = new URLSearchParams(window.location.search);
	const draftIdFromQuery = params.get("id");
	if (draftIdFromQuery) {
		const target = getDraftById(draftIdFromQuery);
		if (target) {
			applyDraft(target);
		}
		return;
	}
	const latest = listDrafts()[0] || null;
	if (!latest) return;
	pendingDraftToLoad = latest;
	showLoadDraftPrompt = true;
	statusText = "检测到本地草稿";
}

function localizeModeSwitchLabels() {
	if (!editorHost) return;
	const modeSwitch = editorHost.querySelector<HTMLElement>(
		".toastui-editor-mode-switch",
	);
	if (!modeSwitch) return;
	const tabs = editorHost.querySelectorAll<HTMLElement>(
		".toastui-editor-mode-switch .tab-item",
	);
	if (tabs.length < 2) return;
	const markdownTab = tabs[0];
	const wwTab = tabs[1];
	if (!markdownTab || !wwTab) return;
	markdownTab.textContent = "Markdown";
	markdownTab.setAttribute("aria-label", "Markdown");
	if (!wwTab) return;
	wwTab.textContent = "可视化编辑";
	wwTab.setAttribute("aria-label", "可视化编辑");

	if (!markdownTab.dataset.mdOnlyHooked) {
		markdownTab.dataset.mdOnlyHooked = "true";
		markdownTab.addEventListener("click", () => {
			if (markdownOnlyMode) {
				setMarkdownOnlyMode(false);
			}
		});
	}
	if (!wwTab.dataset.mdOnlyHooked) {
		wwTab.dataset.mdOnlyHooked = "true";
		wwTab.addEventListener("click", () => {
			if (markdownOnlyMode) {
				setMarkdownOnlyMode(false);
			}
		});
	}

	let markdownOnlyTab = modeSwitch.querySelector<HTMLElement>(
		`.tab-item.${MARKDOWN_ONLY_TAB_CLASS}`,
	);
	if (!markdownOnlyTab) {
		const cloned = markdownTab.cloneNode(false);
		if (!(cloned instanceof HTMLElement)) {
			return;
		}
		markdownOnlyTab = cloned;
		markdownOnlyTab.classList.add(MARKDOWN_ONLY_TAB_CLASS);
		markdownOnlyTab.classList.remove("active");
		markdownOnlyTab.removeAttribute("data-type");
		markdownOnlyTab.textContent = "纯编辑";
		markdownOnlyTab.setAttribute("aria-label", "纯编辑");
		markdownOnlyTab.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			setMarkdownOnlyMode(true);
		});
		modeSwitch.append(markdownOnlyTab);
	}

	markdownOnlyTab.textContent = "纯编辑";
	markdownOnlyTab.setAttribute("aria-label", "纯编辑");
	markdownOnlyTab.classList.toggle("active", markdownOnlyMode);
	markdownOnlyTab.setAttribute(
		"aria-selected",
		markdownOnlyMode ? "true" : "false",
	);
	if (markdownOnlyMode) {
		markdownTab.classList.remove("active");
		wwTab.classList.remove("active");
		editor?.changeMode?.("markdown", true);
	}
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanupLegacyDetailsArtifacts(markdown: string): string {
	const placeholderPattern = new RegExp(
		`<${DETAILS_PLACEHOLDER_TAG}\\b[^>]*>(?:\\s|&nbsp;)*<\\/${DETAILS_PLACEHOLDER_TAG}>`,
		"gi",
	);
	const selfClosingPattern = new RegExp(
		`<${DETAILS_PLACEHOLDER_TAG}\\b[^>]*/>`,
		"gi",
	);
	const legacyTokenPattern = new RegExp(
		`^\\s*${escapeRegex("DETAILSBLOCKTOKEN")}\\d+X\\d+END\\s*$`,
		"gim",
	);
	return markdown
		.replace(placeholderPattern, "")
		.replace(selfClosingPattern, "")
		.replace(legacyTokenPattern, "");
}

function getEditorMarkdownNormalized(): string {
	if (!editor) return "";
	return cleanupLegacyDetailsArtifacts(editor.getMarkdown());
}

function getEditorHeight(): string {
	if (typeof window === "undefined") {
		return `${EDITOR_MIN_HEIGHT}px`;
	}
	const scaled = Math.round(window.innerHeight * EDITOR_HEIGHT_RATIO);
	const fixed = Math.min(
		EDITOR_MAX_HEIGHT,
		Math.max(EDITOR_MIN_HEIGHT, scaled),
	);
	return `${fixed}px`;
}

function cleanupStaleDetailsInMarkdownPreview() {
	if (!editorHost || !editor) return;
	const markdown = editor.getMarkdown();
	if (/<details[\s>]/i.test(markdown) || /<summary[\s>]/i.test(markdown)) {
		return;
	}
	const preview = editorHost.querySelector<HTMLElement>(
		".toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents",
	);
	if (!preview) return;
	const staleDetails = preview.querySelectorAll("details");
	for (const node of staleDetails) {
		node.remove();
	}
}

async function publishPost() {
	if (isSubmitting) return;
	if (!editor) {
		showNotice("编辑器还没加载完成，请稍等", "error");
		return;
	}
	if (!getDeveloperModeEnabled()) {
		showNotice("开发者模式未解锁", "error");
		return;
	}
	const devCodeHash = getStoredDevCredentialValue();
	if (!devCodeHash) {
		showNotice("缺少开发者口令，请重新解锁开发者模式", "error");
		return;
	}
	const content = getEditorMarkdownNormalized().trim();
	if (!title.trim()) {
		showNotice("标题不能为空", "error");
		return;
	}
	if (!content) {
		showNotice("正文不能为空", "error");
		return;
	}

	isSubmitting = true;
	statusText = "正在发布...";
	try {
		const response = await fetch("/api/dev/publish", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				title,
				slug,
				originalSlug,
				description,
				tags,
				category,
				image,
				draft,
				content,
				published,
				devCodeHash,
			}),
		});

		const result = (await response.json().catch(() => ({}))) as {
			ok?: boolean;
			message?: string;
			path?: string;
			commitUrl?: string;
			deployed?: boolean;
		};
		if (!response.ok || !result.ok) {
			throw new Error(result.message || "发布失败");
		}
		statusText = "发布成功，等待部署";
		dirty = false;
		if (activeDraftId) {
			removeDraft(activeDraftId);
			activeDraftId = "";
		}
		showNotice(`发布成功：${result.path || "新文章"}`, "success");
		setTimeout(() => {
			window.location.href = "/";
		}, 900);
	} catch (error) {
		const message = error instanceof Error ? error.message : "发布失败";
		statusText = "发布失败";
		showNotice(message, "error");
	} finally {
		isSubmitting = false;
	}
}

$: if (title && !userTouchedSlug && !originalSlug) {
	slug = slugify(title);
}

$: localSlugConflictMessage = getLocalSlugConflictMessage();

onMount(() => {
	let disposed = false;
	let editorInitializing = false;
	let unbindEditorFocusTracking: (() => void) | null = null;
	let unbindLinkPopupUrlNormalization: (() => void) | null = null;
	markdownOnlyMode = readMarkdownOnlyModePreference();
	const handleWindowResize = () => {
		syncToolbarSvgIconsSoon();
	};
	const handleEditorFocusIn = () => {
		editorFocused = true;
	};
	const handleEditorFocusOut = () => {
		window.requestAnimationFrame(() => {
			if (!editorHost) {
				editorFocused = false;
				return;
			}
			editorFocused = editorHost.contains(document.activeElement);
		});
	};

	const teardownEditorRuntime = () => {
		if (unbindEditorFocusTracking) {
			unbindEditorFocusTracking();
			unbindEditorFocusTracking = null;
		}
		if (unbindLinkPopupUrlNormalization) {
			unbindLinkPopupUrlNormalization();
			unbindLinkPopupUrlNormalization = null;
		}
		stopToolbarIconObserver();
		editorFocused = false;
		if (autoSaveTimer) {
			clearInterval(autoSaveTimer);
			autoSaveTimer = null;
		}
		if (editor) {
			editor.destroy();
			editor = null;
		}
	};

	const initEditor = async () => {
		if (disposed || isLocked || editor || editorInitializing) {
			return;
		}
		editorInitializing = true;
		try {
			clearDeveloperModeAutoLock();
			migrateLegacyDraft();
			await tick();
			if (disposed || isLocked) {
				return;
			}
			if (!editorHost) {
				editorInitError = "编辑器容器加载失败";
				statusText = "编辑器加载失败";
				showNotice(editorInitError, "error");
				return;
			}

			const hostForFocusTracking = editorHost;
			hostForFocusTracking.addEventListener("focusin", handleEditorFocusIn);
			hostForFocusTracking.addEventListener("focusout", handleEditorFocusOut);
			unbindEditorFocusTracking = () => {
				hostForFocusTracking.removeEventListener(
					"focusin",
					handleEditorFocusIn,
				);
				hostForFocusTracking.removeEventListener(
					"focusout",
					handleEditorFocusOut,
				);
			};

			try {
				const [editorModule] = await Promise.all([
					import("@toast-ui/editor"),
					import("@toast-ui/editor/dist/i18n/zh-cn"),
				]);
				if (disposed || isLocked || editorHost !== hostForFocusTracking) {
					return;
				}
				const Editor = editorModule.Editor;
				editor = new Editor({
					el: hostForFocusTracking,
					height: getEditorHeight(),
					initialEditType: "markdown",
					previewStyle: "vertical",
					language: "zh-CN",
					usageStatistics: false,
					placeholder: "在这里写下你的文章...",
					linkAttributes: {
						target: "_blank",
						rel: "noopener noreferrer",
					},
					customHTMLRenderer: CUSTOM_DETAILS_HTML_RENDERER,
					toolbarItems: [
						["heading", "bold", "italic", "strike"],
						["hr", "quote"],
						["ul", "ol", "task", "indent", "outdent"],
						["table", "link", "image"],
						["code", "codeblock"],
					],
				}) as EditorInstance;
				unbindLinkPopupUrlNormalization =
					bindLinkPopupUrlNormalization(hostForFocusTracking);
				if (markdownOnlyMode) {
					editor.changeMode?.("markdown", true);
				}
				editorInitError = "";
				statusText = "编辑器已就绪";
				window.requestAnimationFrame(() => {
					localizeModeSwitchLabels();
					applyToolbarSvgIcons();
				});
				window.setTimeout(() => {
					applyToolbarSvgIcons();
				}, 0);
				window.setTimeout(() => {
					applyToolbarSvgIcons();
				}, 60);
				startToolbarIconObserver();
				tryLoadDraft();
				editor.on("change", () => {
					markDirty();
					window.requestAnimationFrame(() => {
						cleanupStaleDetailsInMarkdownPreview();
					});
				});

				autoSaveTimer = setInterval(() => {
					if (dirty) {
						persistDraft(true);
					}
				}, AUTO_SAVE_INTERVAL);
			} catch (error) {
				editorInitError =
					error instanceof Error ? error.message : "编辑器初始化失败";
				statusText = "编辑器初始化失败";
				showNotice(editorInitError, "error");
				teardownEditorRuntime();
			}
		} finally {
			editorInitializing = false;
		}
	};

	const applyDeveloperModeState = async (enabled: boolean) => {
		const nextLocked = !enabled;
		if (nextLocked === isLocked) {
			return;
		}
		isLocked = nextLocked;
		if (nextLocked) {
			statusText = "等待输入";
			editorInitError = "";
			teardownEditorRuntime();
			return;
		}
		await initEditor();
	};

	const handleDeveloperModeChange = (event: Event) => {
		const enabled = Boolean((event as CustomEvent<boolean>).detail);
		void applyDeveloperModeState(enabled);
	};

	const syncDeveloperModeState = () => {
		void applyDeveloperModeState(getDeveloperModeEnabled());
	};

	window.addEventListener(
		"developer-mode-change",
		handleDeveloperModeChange as EventListener,
	);
	window.addEventListener("resize", handleWindowResize);
	window.addEventListener("focus", syncDeveloperModeState);
	document.addEventListener("visibilitychange", syncDeveloperModeState);

	const init = async () => {
		isLocked = !getDeveloperModeEnabled();
		if (isLocked) {
			return;
		}
		await initEditor();
	};

	void init();

	return () => {
		disposed = true;
		window.removeEventListener(
			"developer-mode-change",
			handleDeveloperModeChange as EventListener,
		);
		window.removeEventListener("resize", handleWindowResize);
		window.removeEventListener("focus", syncDeveloperModeState);
		document.removeEventListener("visibilitychange", syncDeveloperModeState);
		teardownEditorRuntime();
		armDeveloperModeAutoLock();
	};
});
</script>

<div
	class="editor-shell card-base p-4 md:p-6 rounded-[var(--radius-large)]"
	class:editor-focused={editorFocused}
	class:markdown-only={markdownOnlyMode}
>
	<div class="editor-top">
		<div>
			<h1 class="text-xl font-bold text-[var(--btn-content)]">文章编辑器</h1>
			<p class="text-sm text-neutral-400 mt-1">支持完整 Markdown，自动保存草稿</p>
		</div>
		<div class="top-actions">
			<a class="drafts-btn" href="/drafts">草稿箱</a>
			{#if !isLocked}
				<button class="submit-btn" on:click={publishPost} disabled={isSubmitting}>
					{isSubmitting ? "提交中..." : "提交发布"}
				</button>
			{/if}
		</div>
	</div>

	{#if isLocked}
		<div class="locked-tip">开发者模式未开启，请在背景设置面板输入口令并回车解锁。</div>
	{:else}
		<div class="meta-grid">
			<input class="meta-input" type="text" placeholder="标题" bind:value={title} on:input={markDirty} />
			<div class="meta-field">
				<input
					class="meta-input"
					type="text"
					placeholder="Slug（留空自动生成）"
					bind:value={slug}
					on:input={() => {
						userTouchedSlug = true;
						markDirty();
					}}
				/>
				{#if localSlugConflictMessage}
					<div class="meta-warning">{localSlugConflictMessage}</div>
				{/if}
			</div>
			<input class="meta-input" type="text" placeholder="描述" bind:value={description} on:input={markDirty} />
			<input class="meta-input" type="text" placeholder="标签（逗号分隔）" bind:value={tags} on:input={markDirty} />
			<input class="meta-input" type="text" placeholder="分类（可选）" bind:value={category} on:input={markDirty} />
			<input class="meta-input" type="text" placeholder="封面图 URL（可选）" bind:value={image} on:input={markDirty} />
		</div>
		<div class="editor-options">
			<label class="draft-toggle">
				<input type="checkbox" bind:checked={draft} on:change={markDirty} />
				<span>设为草稿（不会在首页展示）</span>
			</label>
		</div>
		<div bind:this={editorHost} class="editor-host">
			{#if !editor && !editorInitError}
				<div class="editor-loading" aria-label="编辑器加载中"></div>
			{/if}
			{#if !editor && editorInitError}
				<div class="editor-error">{editorInitError}</div>
			{/if}
		</div>
		<div class="editor-foot">
			<div class="status-wrap">
				<span>{statusText}</span>
				{#if showLoadDraftPrompt}
					<div class="load-draft-prompt">
						<span class="load-draft-text">是否加载草稿</span>
						<button class="draft-choice-btn" type="button" on:click={loadPendingDraft}>加载</button>
						<button class="draft-choice-btn secondary" type="button" on:click={skipPendingDraft}>跳过</button>
					</div>
				{/if}
			</div>
			<button class="save-btn" on:click={() => persistDraft()} disabled={!editor}>立即保存</button>
		</div>
	{/if}

	{#if notice}
		<div class={`notice ${noticeType}`}>{notice}</div>
	{/if}
</div>

<style lang="stylus">
.editor-shell
  color var(--btn-content)
  overflow visible
  --editor-content-color rgba(38, 54, 55, 0.9)
  --editor-placeholder-color rgba(85, 104, 106, 0.62)
  --editor-active-content-color rgba(18, 31, 36, 0.96)
  --editor-active-placeholder-color rgba(52, 72, 74, 0.74)
  --editor-glow-color var(--primary)
  --editor-glow-shadow var(--editor-glow-color)
  --editor-toolbar-bg-a rgba(248, 251, 249, 0.94)
  --editor-toolbar-bg-b rgba(242, 247, 245, 0.94)
  --editor-toolbar-border rgba(122, 149, 144, 0.32)
  --editor-toolbar-divider rgba(122, 149, 144, 0.28)
  --editor-toolbar-btn-bg rgba(255, 255, 255, 0)
  --editor-toolbar-btn-hover rgba(255, 255, 255, 0.84)
  --editor-toolbar-btn-active rgba(214, 232, 226, 0.9)
  --editor-toolbar-btn-border rgba(120, 146, 141, 0)
  --editor-toolbar-btn-border-hover rgba(90, 134, 124, 0.38)
  --editor-toolbar-pattern-dot rgba(97, 132, 124, 0)
  --editor-toolbar-group-bg rgba(255, 255, 255, 0.58)
  --editor-toolbar-focus-ring rgba(49, 145, 120, 0.34)
  --editor-tooltip-bg rgba(255, 255, 255, 0.98)
  --editor-tooltip-text rgba(18, 31, 36, 0.96)
  --editor-tooltip-shadow rgba(15, 23, 42, 0.18)
  --editor-tooltip-border rgba(120, 146, 141, 0.35)
  --editor-paper-bg rgba(255, 255, 255, 0.9)
  --editor-paper-line rgba(141, 170, 162, 0.12)
  --editor-popup-bg rgba(247, 250, 247, 0.98)
  --editor-popup-border rgba(115, 164, 150, 0.62)
  --editor-popup-text rgba(28, 47, 52, 0.96)
  --editor-popup-text-dim rgba(66, 102, 99, 0.86)
  --editor-popup-input-bg rgba(234, 243, 239, 0.82)
  --editor-popup-input-border rgba(132, 178, 166, 0.55)
  --editor-popup-placeholder rgba(93, 131, 126, 0.62)
  --editor-popup-accent rgba(42, 146, 118, 0.94)
  --editor-popup-accent-soft rgba(42, 146, 118, 0.18)
  --editor-popup-cancel-bg rgba(220, 233, 228, 0.85)
  --editor-popup-tab-active-bg rgba(160, 207, 193, 0.34)
  --editor-code-fence-bg rgba(226, 238, 251, 0.98)
  --editor-code-fence-border rgba(84, 123, 170, 0.9)
  --editor-code-fence-text rgba(19, 45, 76, 0.98)
  --editor-code-fence-meta rgba(57, 98, 147, 0.98)
  --editor-code-preview-bg rgba(234, 243, 253, 0.98)
  --editor-code-preview-border rgba(120, 156, 201, 0.85)
  --editor-code-preview-text rgba(22, 45, 73, 0.98)
  --editor-code-inline-bg rgba(209, 226, 245, 0.88)
  --editor-code-inline-text rgba(39, 84, 135, 0.98)
  --editor-code-lang-bg rgba(196, 216, 240, 0.92)
  --editor-code-lang-text rgba(45, 73, 104, 0.98)
  --editor-table-picker-cell-bg rgba(255, 255, 255, 0.94)
  --editor-table-picker-cell-border rgba(186, 202, 220, 0.82)
  --editor-table-picker-cell-header-bg rgba(233, 241, 250, 0.96)
  --editor-table-picker-selection-border rgba(76, 126, 182, 0.95)
  --editor-table-picker-selection-bg rgba(96, 142, 194, 0.2)
  --editor-table-picker-text rgba(36, 54, 76, 0.95)
  --editor-table-border rgba(63, 93, 130, 0.98)
  --editor-table-header-bg rgba(115, 149, 188, 0.85)
  --editor-table-cell-bg rgba(255, 255, 255, 0.99)
  --editor-table-row-alt-bg rgba(232, 241, 252, 0.95)
  --editor-table-row-hover-bg rgba(208, 225, 246, 0.95)
  --editor-table-shadow rgba(27, 56, 93, 0.18)
  --editor-md-table-delimiter rgba(57, 101, 151, 0.98)
  --editor-md-table-text rgba(16, 35, 58, 0.98)
  --editor-scrollbar-track unquote('oklch(0.9 0.024 var(--hue) / 0.58)')
  --editor-scrollbar-thumb unquote('oklch(0.66 0.09 var(--hue) / 0.62)')
  --editor-scrollbar-thumb-hover unquote('oklch(0.6 0.11 var(--hue) / 0.8)')
  --mode-switch-bg rgba(244, 247, 252, 0.98)
  --mode-switch-border rgba(192, 206, 224, 0.88)
  --mode-switch-tab-color rgba(56, 74, 98, 0.88)
  --mode-switch-tab-active-bg var(--primary)
  --mode-switch-tab-active-color rgba(249, 255, 252, 0.98)
  --mode-switch-tab-active-border var(--primary)

:global(html.dark) .editor-shell
  --editor-content-color rgba(210, 224, 228, 0.92)
  --editor-placeholder-color rgba(171, 191, 198, 0.58)
  --editor-active-content-color rgba(244, 250, 252, 0.98)
  --editor-active-placeholder-color rgba(206, 224, 230, 0.72)
  --editor-toolbar-bg-a rgba(23, 34, 40, 0.95)
  --editor-toolbar-bg-b rgba(27, 39, 45, 0.95)
  --editor-toolbar-border rgba(104, 134, 138, 0.42)
  --editor-toolbar-divider rgba(120, 150, 155, 0.3)
  --editor-toolbar-btn-bg rgba(28, 44, 51, 0)
  --editor-toolbar-btn-hover rgba(40, 60, 68, 0.88)
  --editor-toolbar-btn-active rgba(61, 92, 98, 0.94)
  --editor-toolbar-btn-border rgba(110, 143, 148, 0)
  --editor-toolbar-btn-border-hover rgba(122, 178, 163, 0.54)
  --editor-toolbar-pattern-dot rgba(154, 191, 183, 0)
  --editor-toolbar-group-bg rgba(18, 31, 36, 0.42)
  --editor-toolbar-focus-ring rgba(88, 197, 170, 0.34)
  --editor-tooltip-bg rgba(18, 22, 27, 0.96)
  --editor-tooltip-text rgba(248, 252, 255, 0.98)
  --editor-tooltip-shadow rgba(4, 8, 14, 0.5)
  --editor-tooltip-border rgba(124, 177, 163, 0.24)
  --editor-paper-bg rgba(20, 29, 33, 0.9)
  --editor-paper-line rgba(107, 149, 138, 0.18)
  --editor-popup-bg rgba(13, 24, 30, 0.97)
  --editor-popup-border rgba(94, 171, 149, 0.72)
  --editor-popup-text rgba(224, 243, 238, 0.96)
  --editor-popup-text-dim rgba(166, 216, 199, 0.9)
  --editor-popup-input-bg rgba(29, 47, 53, 0.72)
  --editor-popup-input-border rgba(100, 168, 148, 0.58)
  --editor-popup-placeholder rgba(143, 188, 175, 0.65)
  --editor-popup-accent rgba(75, 198, 164, 0.95)
  --editor-popup-accent-soft rgba(75, 198, 164, 0.22)
  --editor-popup-cancel-bg rgba(50, 80, 79, 0.6)
  --editor-popup-tab-active-bg rgba(64, 124, 112, 0.42)
  --editor-code-fence-bg rgba(20, 34, 49, 0.98)
  --editor-code-fence-border rgba(125, 175, 230, 0.88)
  --editor-code-fence-text rgba(224, 240, 255, 0.99)
  --editor-code-fence-meta rgba(171, 209, 247, 0.99)
  --editor-code-preview-bg rgba(16, 28, 40, 0.98)
  --editor-code-preview-border rgba(118, 168, 225, 0.66)
  --editor-code-preview-text rgba(226, 241, 255, 0.99)
  --editor-code-inline-bg rgba(47, 71, 96, 0.88)
  --editor-code-inline-text rgba(181, 219, 255, 0.99)
  --editor-code-lang-bg rgba(54, 83, 113, 0.93)
  --editor-code-lang-text rgba(216, 235, 255, 0.99)
  --editor-table-picker-cell-bg rgba(30, 42, 54, 0.92)
  --editor-table-picker-cell-border rgba(94, 122, 154, 0.62)
  --editor-table-picker-cell-header-bg rgba(38, 54, 70, 0.95)
  --editor-table-picker-selection-border rgba(129, 189, 255, 0.95)
  --editor-table-picker-selection-bg rgba(114, 171, 233, 0.32)
  --editor-table-picker-text rgba(222, 237, 255, 0.96)
  --editor-table-border rgba(182, 221, 255, 0.94)
  --editor-table-header-bg rgba(83, 123, 166, 0.92)
  --editor-table-cell-bg rgba(22, 36, 48, 0.98)
  --editor-table-row-alt-bg rgba(30, 49, 66, 0.98)
  --editor-table-row-hover-bg rgba(40, 67, 91, 0.98)
  --editor-table-shadow rgba(4, 8, 16, 0.55)
  --editor-md-table-delimiter rgba(171, 212, 255, 0.99)
  --editor-md-table-text rgba(237, 246, 255, 0.99)
  --editor-scrollbar-track unquote('oklch(0.28 0.018 var(--hue) / 0.76)')
  --editor-scrollbar-thumb unquote('oklch(0.74 0.085 var(--hue) / 0.7)')
  --editor-scrollbar-thumb-hover unquote('oklch(0.81 0.1 var(--hue) / 0.9)')
  --mode-switch-bg rgba(16, 24, 33, 0.96)
  --mode-switch-border rgba(74, 96, 122, 0.58)
  --mode-switch-tab-color rgba(178, 201, 226, 0.94)
  --mode-switch-tab-active-bg var(--primary)
  --mode-switch-tab-active-color rgba(236, 250, 246, 0.98)
  --mode-switch-tab-active-border var(--primary)

.editor-shell.editor-focused
  --editor-content-color var(--editor-active-content-color)
  --editor-placeholder-color var(--editor-active-placeholder-color)

.editor-top
  display flex
  justify-content space-between
  align-items flex-start
  gap 1rem
  margin-bottom 1rem

.top-actions
  display inline-flex
  align-items center
  gap 0.6rem

.drafts-btn
  display inline-flex
  align-items center
  justify-content center
  height 2.65rem
  padding 0 1rem
  line-height 1
  font-size 1.05rem
  border 1px solid var(--primary)
  color var(--btn-content)
  border-radius 12px
  font-weight 700
  background transparent
  transition transform 0.2s ease, background 0.2s ease, opacity 0.2s ease
  &:hover
    background var(--btn-regular-bg)
    transform translateY(-1px)

.submit-btn
  display inline-flex
  align-items center
  justify-content center
  height 2.65rem
  padding 0 1.05rem
  line-height 1
  font-size 1.05rem
  border 1px solid var(--primary)
  background var(--primary)
  color white
  border-radius 12px
  font-weight 700
  box-shadow 0 8px 20px rgba(59, 130, 246, 0.2)
  transition transform 0.2s ease, filter 0.2s ease, opacity 0.2s ease
  &:hover
    transform translateY(-1px)
    filter brightness(1.05)
  &:disabled
    opacity 0.55
    filter saturate(0.75)
    cursor not-allowed

.locked-tip
  margin-top 0.5rem
  border 1px dashed var(--primary)
  border-radius 0.9rem
  padding 1rem
  color var(--btn-content)

.meta-grid
  display grid
  grid-template-columns repeat(2, minmax(0, 1fr))
  gap 0.75rem
  margin-bottom 0.75rem

.meta-field
  min-width 0
  display flex
  flex-direction column
  gap 0.35rem

.meta-input
  width 100%
  height 2.45rem
  border-radius 0.65rem
  padding 0 0.75rem
  background var(--btn-regular-bg)
  border 1px solid rgba(148, 163, 184, 0.24)
  color var(--btn-content)
  outline none
  transition border-color 0.18s ease, box-shadow 0.18s ease
  &:focus
    border-color rgba(148, 163, 184, 0.36)
    box-shadow none

.meta-warning
  padding 0 0.1rem
  font-size 0.8rem
  line-height 1.4
  color unquote('color-mix(in oklab, var(--primary) 78%, var(--btn-content))')

.editor-options
  display flex
  flex-wrap wrap
  align-items center
  gap 0.95rem
  margin-bottom 0.8rem

.draft-toggle
  display inline-flex
  align-items center
  gap 0.45rem
  font-size 0.88rem

.editor-host
  --editor-host-border-color var(--btn-regular-bg-hover)
  --editor-host-outline-shadow none
  border-radius 0.9rem
  overflow visible
  min-height 24rem
  position relative
  background linear-gradient(150deg, rgba(255, 255, 255, 0.58) 0%, rgba(223, 243, 236, 0.4) 100%)
  transition background 0.2s ease

.editor-host::after
  content ''
  position absolute
  inset 0
  border-radius inherit
  border 1px solid var(--editor-host-border-color)
  box-shadow var(--editor-host-outline-shadow)
  pointer-events none
  z-index 12

.editor-shell.editor-focused .editor-host
  --editor-host-border-color var(--editor-glow-color)
  --editor-host-outline-shadow 0 0 0 1px var(--editor-glow-color), 0 0 18px var(--editor-glow-shadow)
  background linear-gradient(150deg, rgba(255, 255, 255, 0.72) 0%, rgba(214, 238, 229, 0.55) 100%)

:global(html.dark) .editor-host
  background linear-gradient(160deg, rgba(29, 45, 52, 0.72) 0%, rgba(18, 57, 50, 0.58) 100%)

:global(html.dark) .editor-shell.editor-focused .editor-host
  background linear-gradient(160deg, rgba(34, 55, 62, 0.82) 0%, rgba(24, 66, 58, 0.66) 100%)

.editor-loading
  position absolute
  inset 0
  display flex
  align-items center
  justify-content center
  color var(--btn-content)
  opacity 0.9
  pointer-events none

.editor-loading::before
  content ''
  width 1.5rem
  height 1.5rem
  border-radius 9999px
  border 2px solid rgba(120, 146, 141, 0.35)
  border-top-color var(--primary)
  animation editor-loading-spin 0.9s linear infinite

@keyframes editor-loading-spin
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)

.editor-error
  position absolute
  inset 0
  display flex
  align-items center
  justify-content center
  color rgba(248, 113, 113, 0.95)
  font-size 0.95rem
  padding 1rem
  text-align center

.editor-foot
  margin-top 0.75rem
  display flex
  flex-wrap wrap
  align-items center
  justify-content space-between
  gap 0.75rem
  font-size 0.86rem
  color var(--btn-content)

.status-wrap
  display inline-flex
  align-items center
  flex-wrap wrap
  gap 0.45rem
  min-height 2.05rem

.load-draft-prompt
  display inline-flex
  align-items center
  gap 0.35rem
  padding 0.16rem 0.45rem
  border 1px solid rgba(120, 146, 141, 0.35)
  border-radius 999px
  background rgba(240, 248, 244, 0.7)

.load-draft-text
  font-size 0.8rem
  color rgba(55, 81, 76, 0.88)

.draft-choice-btn
  display inline-flex
  align-items center
  justify-content center
  min-width 2.3rem
  height 1.55rem
  padding 0 0.45rem
  line-height 1
  border 1px solid var(--primary)
  border-radius 999px
  font-size 0.74rem
  background var(--primary)
  color #fff
  transition filter 0.2s ease, opacity 0.2s ease
  &:hover
    filter brightness(1.05)

.draft-choice-btn.secondary
  background transparent
  color var(--btn-content)

.save-btn
  display inline-flex
  align-items center
  justify-content center
  margin-left auto
  height 2.25rem
  padding 0 0.82rem
  line-height 1
  border 1px solid var(--primary)
  background transparent
  border-radius 0.55rem

:global(html.dark) .load-draft-prompt
  background rgba(18, 34, 37, 0.78)
  border-color rgba(95, 136, 127, 0.52)

:global(html.dark) .load-draft-text
  color rgba(192, 219, 210, 0.9)

.notice
  margin-top 0.75rem
  border-radius 0.65rem
  padding 0.55rem 0.75rem
  font-size 0.88rem
  border 1px solid transparent

.notice.info
  background rgba(71, 85, 105, 0.25)

.notice.success
  background rgba(22, 163, 74, 0.2)

.notice.error
  background rgba(254, 226, 226, 0.96) !important
  color rgb(244, 71, 71) !important
  border-color rgba(244, 71, 71, 0.56) !important
  box-shadow 0 0.8rem 2rem rgba(244, 71, 71, 0.12)

:global(html.dark) .notice.error
  background rgba(244, 71, 71, 0.16) !important
  color rgb(255, 170, 170) !important
  border-color rgba(244, 71, 71, 0.64) !important
  box-shadow 0 1rem 2.2rem rgba(244, 71, 71, 0.16)

:global(.toastui-editor-defaultUI)
  border none !important
  border-radius calc(0.9rem - 1px) !important
  overflow visible !important
  width 100% !important
  box-sizing border-box !important
  background var(--editor-paper-bg) !important

:global(.toastui-editor-defaultUI > .toastui-editor-main)
  border-bottom-left-radius calc(0.9rem - 1px)
  border-bottom-right-radius calc(0.9rem - 1px)
  overflow hidden

:global(.toastui-editor-defaultUI-toolbar)
  display block !important
  width 100% !important
  box-sizing border-box !important
  height auto !important
  position relative
  overflow visible
  border-top-left-radius calc(0.9rem - 1px) !important
  border-top-right-radius calc(0.9rem - 1px) !important
  background linear-gradient(180deg, var(--editor-toolbar-bg-a) 0%, var(--editor-toolbar-bg-b) 100%) !important
  border-bottom 1px solid var(--editor-toolbar-border) !important
  padding 0.5rem 0.58rem !important

:global(.toastui-editor-defaultUI-toolbar::before)
  display none

:global(.toastui-editor-toolbar)
  display flex !important
  width 100%
  min-width 0
  justify-content flex-start
  align-items center
  flex-wrap wrap
  height auto !important
  gap 0.28rem
  overflow visible
  white-space normal

:global(.toastui-editor-toolbar-group)
  display inline-flex
  flex 0 0 auto
  align-items center
  gap 0.16rem
  margin-right 0.2rem
  margin-bottom 0.1rem
  padding 0.14rem
  border-radius 0.62rem
  background var(--editor-toolbar-group-bg)

:global(.toastui-editor-toolbar-group:last-child)
  margin-right 0

:global(.toastui-editor-toolbar-divider)
  width 1px !important
  height 1.05rem !important
  margin 0 0.1rem !important
  background var(--editor-toolbar-divider) !important

:global(.toastui-editor-defaultUI-toolbar button)
  display inline-flex !important
  align-items center
  justify-content center
  width 2.04rem !important
  height 2.04rem !important
  margin 0 !important
  padding 0 !important
  border-radius 0.58rem !important
  border 1px solid var(--editor-toolbar-btn-border) !important
  background-color var(--editor-toolbar-btn-bg) !important
  color var(--editor-content-color) !important
  box-shadow none !important
  outline none !important
  transition background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease

:global(.toastui-editor-defaultUI-toolbar button.link::before)
  content none !important
  display none !important
  background none !important

:global(.toastui-editor-defaultUI-toolbar button:not(:disabled):hover)
  background-color var(--editor-toolbar-btn-hover) !important
  border-color var(--editor-toolbar-btn-border-hover) !important
  box-shadow inset 0 0 0 1px var(--editor-toolbar-btn-border-hover) !important

:global(.toastui-editor-defaultUI-toolbar button:focus-visible)
  border-color var(--editor-toolbar-btn-border-hover) !important
  box-shadow 0 0 0 3px var(--editor-toolbar-focus-ring) !important

:global(.toastui-editor-defaultUI-toolbar button:disabled)
  opacity 0.38 !important

:global(.toastui-editor-toolbar-icons[data-svg-icon-name]:not(:disabled).active)
  background-color var(--editor-toolbar-btn-active) !important
  border-color var(--editor-toolbar-btn-border-hover) !important
  box-shadow inset 0 0 0 1px var(--editor-toolbar-btn-border-hover) !important

:global(.toastui-editor-toolbar-icons[data-svg-icon-name])
  border-radius inherit !important
  background none !important
  background-image none !important
  text-indent 0 !important

:global(.toastui-editor-toolbar-icons[data-svg-icon-name] svg)
  width 1.02rem
  height 1.02rem
  stroke-width 2.05
  flex-shrink 0
  pointer-events none

:global(.toastui-editor-defaultUI-toolbar .toastui-editor-tooltip)
  position absolute !important
  z-index 9999 !important
  border-radius 0.56rem !important
  padding 0.36rem 0.56rem !important
  line-height 1 !important
  white-space nowrap !important
  border 1px solid var(--editor-tooltip-border) !important
  background var(--editor-tooltip-bg) !important
  color var(--editor-tooltip-text) !important
  box-shadow 0 10px 20px var(--editor-tooltip-shadow) !important
  transform translate(calc(1.02rem - 6px - 50%), calc(-100% - 46px)) !important
  pointer-events none !important

:global(.toastui-editor-defaultUI-toolbar .toastui-editor-tooltip .arrow)
  display none !important
  width 8px !important
  height 8px !important
  left 50% !important
  top auto !important
  bottom -4px !important
  margin-left -4px !important
  background var(--editor-tooltip-bg) !important
  border-right 1px solid var(--editor-tooltip-border) !important
  border-bottom 1px solid var(--editor-tooltip-border) !important
  transform rotate(45deg) !important
  z-index -1 !important

:global(.toastui-editor-md-container)
  background var(--editor-paper-bg) !important

:global(.toastui-editor-main-container)
  color var(--editor-content-color) !important
  background var(--editor-paper-bg) !important
  background-image repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--editor-paper-line) 31px, var(--editor-paper-line) 32px) !important

:global(.toastui-editor-ww-container)
  background var(--editor-paper-bg) !important

:global(.toastui-editor-ww-container > .toastui-editor)
  background var(--editor-paper-bg) !important

:global(.toastui-editor-ww-container .toastui-editor-contents)
  background var(--editor-paper-bg) !important

:global(.toastui-editor-md-container .toastui-editor-md-preview)
  background var(--editor-paper-bg) !important

:global(.toastui-editor-md-tab-container)
  background transparent !important
  border-bottom 1px solid var(--btn-regular-bg-hover) !important

:global(.toastui-editor-mode-switch)
  height 2.2rem !important
  padding-right 0.35rem !important
  border-top 1px solid var(--mode-switch-border) !important
  background var(--mode-switch-bg) !important

:global(.toastui-editor-mode-switch .tab-item)
  display inline-flex !important
  align-items center
  justify-content center
  min-width 8.2rem
  font-family "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans CJK SC", sans-serif !important
  margin 0 !important
  height 100% !important
  line-height 1 !important
  border 1px solid transparent !important
  border-radius 0.45rem !important
  background transparent !important
  color var(--mode-switch-tab-color) !important
  opacity 1

:global(.toastui-editor-mode-switch .tab-item.active)
  color var(--mode-switch-tab-active-color) !important
  opacity 1
  background var(--mode-switch-tab-active-bg) !important
  border-color var(--mode-switch-tab-active-border) !important

:global(.toastui-editor-mode-switch .tab-item.dev-markdown-only-tab)
  min-width 6.6rem

:global(.editor-shell.markdown-only .toastui-editor-mode-switch .tab-item.active:not(.dev-markdown-only-tab))
  background transparent !important
  border-color transparent !important
  color var(--mode-switch-tab-color) !important

:global(.editor-shell.markdown-only .toastui-editor-md-container .toastui-editor)
  width 100% !important
  border-right none !important

:global(.editor-shell.markdown-only .toastui-editor-md-container .toastui-editor-md-splitter)
  display none !important

:global(.editor-shell.markdown-only .toastui-editor-md-container .toastui-editor-md-preview)
  display none !important

:global(.toastui-editor-contents-placeholder::before)
  color var(--editor-placeholder-color) !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-contents-placeholder::before)
  color var(--editor-placeholder-color) !important

:global(.toastui-editor-ww-container .ProseMirror .placeholder)
  color var(--editor-placeholder-color) !important

:global(.toastui-editor-md-container .toastui-editor)
  color var(--editor-content-color) !important

:global(.toastui-editor-md-container .toastui-editor *)
  color var(--editor-content-color) !important

:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents)
  color var(--editor-content-color) !important
  overflow-wrap anywhere !important
  word-break break-word !important

:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents *)
  color var(--editor-content-color) !important

:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents pre),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents pre *),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents code)
  overflow-wrap normal !important
  word-break normal !important

:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents blockquote),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents blockquote *)
  color var(--editor-placeholder-color) !important

:global(.toastui-editor-ww-container .ProseMirror)
  color var(--editor-content-color) !important
  caret-color var(--editor-content-color) !important

:global(.toastui-editor-ww-container .ProseMirror *)
  color var(--editor-content-color) !important

:global(.toastui-editor-md-container .toastui-editor),
:global(.toastui-editor-md-container .toastui-editor-md-preview),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents),
:global(.toastui-editor-ww-container .toastui-editor),
:global(.toastui-editor-ww-container .toastui-editor-contents)
  scrollbar-width thin
  scrollbar-color var(--editor-scrollbar-thumb) var(--editor-scrollbar-track)

:global(.toastui-editor-md-container .toastui-editor::-webkit-scrollbar),
:global(.toastui-editor-md-container .toastui-editor-md-preview::-webkit-scrollbar),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents::-webkit-scrollbar),
:global(.toastui-editor-ww-container .toastui-editor::-webkit-scrollbar),
:global(.toastui-editor-ww-container .toastui-editor-contents::-webkit-scrollbar)
  width 10px
  height 10px

:global(.toastui-editor-md-container .toastui-editor::-webkit-scrollbar-track),
:global(.toastui-editor-md-container .toastui-editor-md-preview::-webkit-scrollbar-track),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents::-webkit-scrollbar-track),
:global(.toastui-editor-ww-container .toastui-editor::-webkit-scrollbar-track),
:global(.toastui-editor-ww-container .toastui-editor-contents::-webkit-scrollbar-track)
  background var(--editor-scrollbar-track)
  border-radius 999px

:global(.toastui-editor-md-container .toastui-editor::-webkit-scrollbar-thumb),
:global(.toastui-editor-md-container .toastui-editor-md-preview::-webkit-scrollbar-thumb),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents::-webkit-scrollbar-thumb),
:global(.toastui-editor-ww-container .toastui-editor::-webkit-scrollbar-thumb),
:global(.toastui-editor-ww-container .toastui-editor-contents::-webkit-scrollbar-thumb)
  background var(--editor-scrollbar-thumb)
  border-radius 999px
  border 2px solid transparent
  background-clip padding-box

:global(.toastui-editor-md-container .toastui-editor::-webkit-scrollbar-thumb:hover),
:global(.toastui-editor-md-container .toastui-editor-md-preview::-webkit-scrollbar-thumb:hover),
:global(.toastui-editor-md-container .toastui-editor-md-preview .toastui-editor-contents::-webkit-scrollbar-thumb:hover),
:global(.toastui-editor-ww-container .toastui-editor::-webkit-scrollbar-thumb:hover),
:global(.toastui-editor-ww-container .toastui-editor-contents::-webkit-scrollbar-thumb:hover)
  background var(--editor-scrollbar-thumb-hover)

:global(.toastui-editor-contents)
  color var(--editor-content-color) !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block-line-background)
  background var(--editor-code-fence-bg) !important
  box-shadow inset 3px 0 0 var(--editor-code-fence-border)

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block-line-background.start)
  border-top-right-radius 0.5rem

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block-line-background.end)
  border-bottom-right-radius 0.5rem

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block),
:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block .toastui-editor-md-marked-text)
  color var(--editor-code-fence-text) !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block .toastui-editor-md-meta),
:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code.toastui-editor-md-delimiter)
  color var(--editor-code-fence-meta) !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block .toastui-editor-md-meta)
  display inline-flex !important
  align-items center
  min-height 1.45rem
  padding 0.08rem 0.46rem !important
  border-radius 0.45rem
  background var(--editor-code-lang-bg)
  line-height 1.15 !important
  vertical-align middle

:global(.toastui-editor-contents pre)
  background var(--editor-code-preview-bg) !important
  border 1px solid var(--editor-code-preview-border) !important
  border-radius 0.75rem !important
  box-shadow inset 0 0 0 1px var(--editor-code-preview-border)

:global(.toastui-editor-contents pre code)
  color var(--editor-code-preview-text) !important

:global(.toastui-editor-md-preview .toastui-editor-contents code):not(pre code)
  background var(--editor-code-inline-bg) !important
  color var(--editor-code-inline-text) !important
  border-radius 0.33rem
  padding 0.04rem 0.24rem !important

:global(.toastui-editor-contents .toastui-editor-ww-code-block code)
  background transparent !important
  color var(--editor-code-preview-text) !important
  border-radius 0 !important
  padding 0 !important
  box-shadow none !important

:global(.toastui-editor-contents .toastui-editor-ww-code-block:after)
  color var(--editor-code-lang-text) !important
  background var(--editor-code-lang-bg) !important
  border 1px solid var(--editor-code-preview-border) !important
  border-radius 0.5rem
  top 0.55rem !important
  right 0.55rem !important
  left auto !important
  height auto !important
  min-height 1.52rem
  padding 0.14rem 0.56rem !important
  line-height 1.15 !important
  font-size 0.82rem !important
  display inline-flex !important
  align-items center
  justify-content center
  background-image none !important
  background-position initial !important
  background-size auto !important

:global(.toastui-editor-contents .toastui-editor-ww-code-block *):not(:after)
  background transparent !important

:global(.toastui-editor-contents table)
  border-collapse collapse !important
  border 1px solid var(--editor-table-border) !important
  background var(--editor-table-cell-bg) !important
  box-shadow 0 10px 24px var(--editor-table-shadow), inset 0 0 0 1px var(--editor-table-border)

:global(.toastui-editor-contents table th),
:global(.toastui-editor-contents table td)
  border 1px solid var(--editor-table-border) !important
  background var(--editor-table-cell-bg) !important
  color var(--editor-content-color) !important
  padding 0.48rem 0.62rem !important
  min-height 2.05rem !important
  min-width 2.35rem !important
  vertical-align top !important
  box-shadow inset 0 0 0 1px var(--editor-table-border)

:global(.toastui-editor-contents table th)
  background var(--editor-table-header-bg) !important
  font-weight 700 !important

:global(.toastui-editor-contents table tbody tr:nth-child(even) td)
  background var(--editor-table-row-alt-bg) !important

:global(.toastui-editor-contents table tbody tr:hover td)
  background var(--editor-table-row-hover-bg) !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-table),
:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-table.toastui-editor-md-delimiter)
  color var(--editor-md-table-delimiter) !important
  opacity 1 !important
  text-shadow 0 0 0.5px currentColor

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-table .toastui-editor-md-table-cell)
  color var(--editor-md-table-text) !important
  font-weight 600 !important

:global(.toastui-editor-md-container .toastui-editor .toastui-editor-md-table .toastui-editor-md-delimiter)
  color var(--editor-md-table-delimiter) !important
  font-weight 700 !important

:global(.toastui-editor-defaultUI .toastui-editor-contents table th),
:global(.toastui-editor-defaultUI .toastui-editor-contents table td)
  border-color var(--editor-table-border) !important
  background-color var(--editor-table-cell-bg) !important

:global(.toastui-editor-defaultUI .toastui-editor-md-container .toastui-editor .toastui-editor-md-table .toastui-editor-md-table-cell)
  color var(--editor-md-table-text) !important

:global(.toastui-editor-defaultUI .toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block),
:global(.toastui-editor-defaultUI .toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block .toastui-editor-md-marked-text)
  color var(--editor-code-fence-text) !important

:global(.toastui-editor-defaultUI .toastui-editor-md-container .toastui-editor .toastui-editor-md-code-block .toastui-editor-md-meta),
:global(.toastui-editor-defaultUI .toastui-editor-md-container .toastui-editor .toastui-editor-md-code.toastui-editor-md-delimiter)
  color var(--editor-code-fence-meta) !important

:global(.toastui-editor-contents details)
  margin 0.9rem 0
  border 1px solid var(--line-divider) !important
  border-radius 0.8rem
  overflow hidden
  background var(--editor-paper-bg)

:global(.toastui-editor-ww-container .toastui-editor-contents details:focus),
:global(.toastui-editor-ww-container .toastui-editor-contents details:focus-visible),
:global(.toastui-editor-ww-container .toastui-editor-contents details > summary:focus),
:global(.toastui-editor-ww-container .toastui-editor-contents details > summary:focus-visible)
  outline none !important
  box-shadow none !important

:global(.toastui-editor-ww-container .ProseMirror details.ProseMirror-selectednode),
:global(.toastui-editor-ww-container .ProseMirror details > summary.ProseMirror-selectednode)
  outline none !important
  box-shadow none !important
  border-color var(--line-divider) !important

:global(.toastui-editor-contents details > summary)
  position relative
  list-style none
  cursor pointer
  padding 0.65rem 0.9rem 0.92rem 2.1rem
  font-weight 700
  color var(--editor-content-color) !important
  background rgba(128, 134, 146, 0.12)

:global(.toastui-editor-contents details > summary::marker)
  content ''

:global(.toastui-editor-contents details > summary::-webkit-details-marker)
  display none

:global(.toastui-editor-contents details > summary::before)
  content '▸'
  position absolute
  left 0.88rem
  top 50%
  transform translateY(-52%)
  font-size 0.9rem
  line-height 1
  color var(--editor-content-color)
  opacity 0.88
  transition transform 0.16s ease

:global(.toastui-editor-contents details > summary::after)
  content ''
  position absolute
  left 0.75rem
  right 0.75rem
  bottom 0.33rem
  height 0.33rem
  border-radius 999px
  background rgba(128, 134, 146, 0.45)
  pointer-events none

:global(.toastui-editor-contents details[open] > summary::before)
  transform translateY(-52%) rotate(90deg)

:global(.toastui-editor-contents details[open] > summary)
  border-bottom 1px solid var(--line-divider)

:global(.toastui-editor-contents details > :not(summary))
  padding 0.72rem 0.9rem 0.9rem

:global(.toastui-editor-contents details > :not(summary) > :first-child)
  margin-top 0 !important

:global(.toastui-editor-contents details > :not(summary) > :last-child)
  margin-bottom 0 !important

:global(.toastui-editor-popup)
  background var(--editor-popup-bg) !important
  border 1px solid var(--editor-popup-border) !important
  border-radius 1.15rem !important
  box-shadow 0 20px 56px rgba(10, 6, 20, 0.58) !important
  color var(--editor-popup-text) !important

:global(.toastui-editor-popup-body)
  padding 1.12rem 1.2rem !important

:global(.toastui-editor-popup-body label)
  color var(--editor-popup-text) !important
  font-size 1.08rem !important
  font-weight 700 !important
  margin-bottom 0.56rem !important

:global(.toastui-editor-popup-body input[type='text'])
  height 2.82rem !important
  border-radius 0.72rem !important
  border 1px solid var(--editor-popup-input-border) !important
  background var(--editor-popup-input-bg) !important
  color var(--editor-popup-text) !important
  padding 0 0.84rem !important

:global(.toastui-editor-popup-body input[type='text']::placeholder)
  color var(--editor-popup-placeholder) !important

:global(.toastui-editor-popup-body input[type='text']:focus)
  border-color var(--editor-popup-accent) !important
  box-shadow 0 0 0 1px var(--editor-popup-accent), 0 0 0 4px var(--editor-popup-accent-soft) !important
  outline none !important

:global(.toastui-editor-popup-body .toastui-editor-button-container)
  margin-top 1rem !important
  display flex !important
  justify-content flex-end !important
  gap 0.56rem !important

:global(.toastui-editor-defaultUI .toastui-editor-close-button)
  min-width 5.8rem !important
  height 2.72rem !important
  border-radius 0.68rem !important
  border 1px solid var(--editor-popup-input-border) !important
  background var(--editor-popup-cancel-bg) !important
  color var(--editor-popup-text) !important

:global(.toastui-editor-defaultUI .toastui-editor-close-button:hover)
  border-color var(--editor-popup-accent) !important
  background rgba(95, 71, 130, 0.52) !important

:global(.toastui-editor-defaultUI .toastui-editor-ok-button)
  min-width 5.8rem !important
  height 2.72rem !important
  border-radius 0.68rem !important
  border 1px solid var(--editor-popup-accent) !important
  background var(--editor-popup-accent) !important
  color #fff !important

:global(.toastui-editor-defaultUI .toastui-editor-ok-button:hover)
  filter brightness(1.06)

:global(.toastui-editor-popup-add-image .toastui-editor-tabs)
  display flex !important
  gap 0.44rem !important
  border-bottom 1px solid var(--editor-popup-input-border) !important
  margin-bottom 0.96rem !important

:global(.toastui-editor-popup-add-image .toastui-editor-tabs .tab-item)
  height auto !important
  padding 0.5rem 0.78rem !important
  margin 0 !important
  border none !important
  border-radius 0.6rem 0.6rem 0 0 !important
  color var(--editor-popup-text-dim) !important
  background transparent !important
  font-weight 700 !important

:global(.toastui-editor-popup-add-image .toastui-editor-tabs .tab-item.active)
  color var(--editor-popup-accent) !important
  background var(--editor-popup-tab-active-bg) !important
  border-bottom 2px solid var(--editor-popup-accent) !important

:global(.toastui-editor-popup-add-image .toastui-editor-file-name)
  height 2.72rem !important
  border-radius 0.68rem !important
  border 1px solid var(--editor-popup-input-border) !important
  background var(--editor-popup-input-bg) !important
  color var(--editor-popup-placeholder) !important

:global(.toastui-editor-popup-add-image .toastui-editor-file-select-button)
  height 2.72rem !important
  border-radius 0.68rem !important
  border 1px solid var(--editor-popup-input-border) !important
  background var(--editor-popup-cancel-bg) !important
  color var(--editor-popup-text) !important

:global(.toastui-editor-popup-add-image .toastui-editor-file-select-button:hover)
  border-color var(--editor-popup-accent) !important

:global(.toastui-editor-popup-add-table .toastui-editor-table-cell)
  border-color var(--editor-table-picker-cell-border) !important
  background var(--editor-table-picker-cell-bg) !important

:global(.toastui-editor-popup-add-table .toastui-editor-table-cell.header)
  background var(--editor-table-picker-cell-header-bg) !important

:global(.toastui-editor-popup-add-table .toastui-editor-table-selection-layer)
  border-color var(--editor-table-picker-selection-border) !important
  background var(--editor-table-picker-selection-bg) !important

:global(.toastui-editor-popup-add-table .toastui-editor-table-description)
  margin-top 0.62rem !important
  color var(--editor-table-picker-text) !important
  font-size 0.95rem !important
  font-weight 700 !important
  letter-spacing 0.02em

:global(.toastui-editor-popup-add-table .toastui-editor-table-description *),
:global(.toastui-editor-dropdown-toolbar .toastui-editor-table-description),
:global(.toastui-editor-dropdown-toolbar .toastui-editor-table-description *)
  color var(--editor-table-picker-text) !important
  opacity 1 !important

:global(.toastui-editor-dropdown-toolbar.toastui-editor-popup-add-table),
:global(.toastui-editor-dropdown-toolbar .toastui-editor-popup-add-table)
  background var(--editor-popup-bg) !important
  border 1px solid var(--editor-popup-border) !important
  border-radius 1rem !important

:global(.toastui-editor-dropdown-toolbar.toastui-editor-popup-add-table .toastui-editor-table-description),
:global(.toastui-editor-dropdown-toolbar .toastui-editor-popup-add-table .toastui-editor-table-description)
  display inline-flex !important
  align-items center
  justify-content center
  min-height 1.65rem
  padding 0.12rem 0.56rem
  border-radius 999px
  background rgba(92, 128, 170, 0.18)
  text-shadow 0 0 0.5px currentColor

:global(.toastui-editor-dropdown-toolbar .toastui-editor-table-description)
  display inline-flex !important
  align-items center
  justify-content center
  min-height 1.65rem
  padding 0.12rem 0.56rem
  border-radius 999px
  background rgba(92, 128, 170, 0.18)

@media (max-width: 860px)
  .meta-grid
    grid-template-columns 1fr

  .editor-top
    flex-direction column
    align-items flex-start

  :global(.toastui-editor-defaultUI-toolbar)
    padding 0.42rem 0.45rem !important

  :global(.toastui-editor-toolbar)
    gap 0.2rem

  :global(.toastui-editor-toolbar-group)
    gap 0.1rem
    margin-right 0.14rem
    padding 0.1rem

  :global(.toastui-editor-defaultUI-toolbar button)
    width 1.9rem !important
    height 1.9rem !important

  :global(.toastui-editor-toolbar-divider)
    margin 0 0.05rem !important
</style>
