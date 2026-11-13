/**
 * Normalisasi + escape + pembangun badan catatan. SALINAN yang sengaja identik dengan
 * `src/domain/captureValidator.ts` di root repo (plugin Seedbed), dipakai mode cadangan (obsidian://new)
 * dan pemotongan kutipan. Tes paritas (tests/parity.test.ts) memastikan keluarannya sama persis.
 * Murni: tanpa DOM, tanpa chrome.*.
 */

export type Lang = "id" | "en";

export const LIMITS = { title: 200, q: 300, a: 2000, url: 2000, fileBase: 80 } as const;
export const TRUNC_MARK = "…(dipotong)";

export interface CaptureData {
	text: string;
	truncated: boolean;
	url?: string;
	title: string;
	q: string;
	a: string;
	lang: Lang;
}

// Karakter kontrol kecuali \n dan \t, serta pemisah baris Unicode dan kontrol bidi.
// eslint-disable-next-line no-control-regex -- the regex must match control characters on purpose, to strip them from captured text
const CONTROL = new RegExp(
	"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f  ‪-‮⁦-⁩]",
	"g",
);

export function normalizeBlock(raw: string): string {
	return raw
		.replace(/\r\n?/g, "\n")
		.replace(CONTROL, "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function normalizeLine(raw: string): string {
	return raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
}

/** Potong per titik kode Unicode (tidak merusak pasangan surrogate). */
export function cut(s: string, max: number): { value: string; truncated: boolean } {
	const chars = Array.from(s);
	if (chars.length <= max) return { value: s, truncated: false };
	return { value: chars.slice(0, max).join("").trimEnd(), truncated: true };
}

/** Hanya http/https, tanpa kredensial, panjang wajar. Selain itu undefined. */
export function sanitizeUrl(raw: string | undefined): string | undefined {
	if (!raw) return undefined;
	const s = raw.trim();
	if (s.length === 0 || s.length > LIMITS.url) return undefined;
	let u: URL;
	try {
		u = new URL(s);
	} catch {
		return undefined;
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
	if (u.username || u.password) return undefined;
	if (!u.hostname) return undefined;
	return u.href;
}

export function escapeInline(s: string): string {
	return normalizeLine(s).replace(/([\\\[\]<>`*_|~#])/g, "\\$1");
}

export function escapeBlockLine(line: string): string {
	return line
		.replace(/^(\s*)\[!/, "$1\\[!")
		.replace(/\[\[/g, "\\[\\[")
		.replace(/!\[/g, "!\\[")
		.replace(/</g, "\\<")
		.replace(/%%/g, "%\\%")
		.replace(/^(\s*)>/, "$1\\>"); // cegah blockquote/callout bersarang dari teks halaman
}

export function markdownLinkUrl(href: string): string {
	return href.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function quoteLines(text: string): string[] {
	return text.split("\n").map((l) => {
		const e = escapeBlockLine(l);
		return e.length === 0 ? ">" : `> ${e}`;
	});
}

const LABELS = {
	id: { quote: "Kutipan", trigger: "Pertanyaan pemicu", answer: "Jawaban" },
	en: { quote: "Quote", trigger: "Trigger question", answer: "Answer" },
} as const;

function hostOf(href: string): string {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}

export function buildCaptureBody(d: CaptureData): string {
	const L = LABELS[d.lang];
	const heading = d.title ? `${L.quote} — ${escapeInline(d.title)}` : L.quote;
	const lines: string[] = [`> [!quote] ${heading}`, ...quoteLines(d.text)];
	if (d.url) {
		const label = d.title ? escapeInline(d.title) : escapeInline(hostOf(d.url));
		lines.push(`> — [${label}](${markdownLinkUrl(d.url)})`);
	}
	if (d.q || d.a) {
		lines.push("", `> [!trigger] ${L.trigger}`);
		if (d.q) lines.push(...quoteLines(d.q));
		if (d.a) {
			const [first = "", ...rest] = d.a.split("\n");
			lines.push(`> ${L.answer}: ${escapeBlockLine(first)}`.trimEnd());
			for (const l of rest) lines.push(l.length === 0 ? ">" : `> ${escapeBlockLine(l)}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function captureFileBase(d: CaptureData, today: string): string {
	const source = d.title || d.text.split("\n")[0] || "";
	let name = source
		.replace(CONTROL, " ")
		.replace(/[\\/:*?"<>|#^[\]]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	name = Array.from(name).slice(0, LIMITS.fileBase).join("");
	name = name.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
	if (name.length === 0) name = `Benih ${today}`;
	if (WINDOWS_RESERVED.test(name)) name = `${name}_`;
	return name;
}
