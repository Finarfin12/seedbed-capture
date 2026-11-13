/**
 * Validasi + pembangun catatan untuk tangkapan dari ekstensi Seedbed Capture (obsidian://seedbed-capture).
 * Murni (tanpa import obsidian). Prinsip: isi link TIDAK DIPERCAYA. Semua nilai divalidasi, dipotong, dan di-escape;
 * frontmatter tidak pernah dirangkai dari teks pengguna (hanya lewat processFrontMatter dengan nilai dari sini).
 */
import { nextReview } from "./scheduler";
import type { IdeaPatch } from "./frontmatter";
import type { Language, Settings } from "./types";

export const CAPTURE_VERSION = "1";

export const LIMITS = { title: 200, q: 300, a: 2000, url: 2000, fileBase: 80 } as const;

export type CaptureParams = Record<string, string | undefined>;

export interface CaptureData {
	text: string;
	truncated: boolean;
	/** URL http/https yang sudah dinormalisasi; undefined bila tidak ada/ditolak. */
	url?: string;
	title: string;
	q: string;
	a: string;
	lang: Language;
}

export type CaptureError = "bad-version" | "no-text";

export type CaptureValidation = { ok: true; data: CaptureData } | { ok: false; error: CaptureError };

// Karakter kontrol kecuali \n dan \t (dibuang). Termasuk \u0000-\u0008, \u000b, \u000c, \u000e-\u001f, \u007f, serta pemisah baris/paragraf Unicode.
// eslint-disable-next-line no-control-regex -- the regex must match control characters on purpose, to strip them from captured text
const CONTROL = new RegExp(
	"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029\u202a-\u202e\u2066-\u2069]",
	"g",
);

const TRUNC_MARK = "…(dipotong)";

/** Normalisasi blok teks: CRLF -> LF, buang karakter kontrol/bidi, rapikan baris kosong berlebih. */
export function normalizeBlock(raw: string): string {
	return raw
		.replace(/\r\n?/g, "\n")
		.replace(CONTROL, "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Satu baris: semua spasi/baris baru jadi satu spasi. */
export function normalizeLine(raw: string): string {
	return raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
}

function cut(s: string, max: number): { value: string; truncated: boolean } {
	const chars = Array.from(s); // jangan memotong di tengah pasangan surrogate
	if (chars.length <= max) return { value: s, truncated: false };
	return { value: chars.slice(0, max).join("").trimEnd(), truncated: true };
}

/** Hanya http/https, tanpa kredensial (user:pass@), panjang wajar. Selain itu undefined. */
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

export function validateCapture(params: CaptureParams, opts: { maxText: number; defaultLang: Language }): CaptureValidation {
	if (params.v !== CAPTURE_VERSION) return { ok: false, error: "bad-version" };
	const textRaw = normalizeBlock(params.text ?? "");
	if (textRaw.length === 0) return { ok: false, error: "no-text" };
	const t = cut(textRaw, opts.maxText);
	const text = t.truncated ? `${t.value}${TRUNC_MARK}` : t.value;
	const lang: Language = params.lang === "id" || params.lang === "en" ? params.lang : opts.defaultLang;
	return {
		ok: true,
		data: {
			text,
			truncated: t.truncated,
			url: sanitizeUrl(params.url),
			title: cut(normalizeLine(params.title ?? ""), LIMITS.title).value,
			q: cut(normalizeLine(params.q ?? ""), LIMITS.q).value,
			a: cut(normalizeBlock(params.a ?? ""), LIMITS.a).value,
			lang,
		},
	};
}

// ---------------- Escape ----------------

/** Escape untuk teks satu baris di posisi header callout / teks tautan Markdown. */
export function escapeInline(s: string): string {
	return normalizeLine(s).replace(/([\\\[\]<>`*_|~#])/g, "\\$1");
}

/**
 * Escape satu baris isi kutipan. Tujuannya mencegah teks halaman membuat struktur baru:
 * `[!tipe]` (callout), `[[wikilink]]` / `![[embed]]`, `<tag HTML>`, `%%komentar%%`.
 */
export function escapeBlockLine(line: string): string {
	return line
		.replace(/^(\s*)\[!/, "$1\\[!")
		.replace(/\[\[/g, "\\[\\[")
		.replace(/!\[/g, "!\\[")
		.replace(/</g, "\\<")
		.replace(/%%/g, "%\\%")
		.replace(/^(\s*)>/, "$1\\>"); // cegah blockquote/callout bersarang dari teks halaman
}

/** Tautan Markdown aman: tanda kurung di URL di-encode supaya tidak menutup tautan lebih awal. */
export function markdownLinkUrl(href: string): string {
	return href.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function quoteLines(text: string): string[] {
	return text.split("\n").map((l) => {
		const e = escapeBlockLine(l);
		return e.length === 0 ? ">" : `> ${e}`;
	});
}

// ---------------- Teks berbahasa untuk isi catatan ----------------

const LABELS = {
	id: { quote: "Kutipan", trigger: "Pertanyaan pemicu", answer: "Jawaban", source: "Sumber" },
	en: { quote: "Quote", trigger: "Trigger question", answer: "Answer", source: "Source" },
} as const;

/** Badan catatan (tanpa frontmatter). Selalu diawali `> [!quote]`, tidak pernah `---`. */
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

function hostOf(href: string): string {
	try {
		return new URL(href).hostname;
	} catch {
		return href;
	}
}

// ---------------- Nama file ----------------

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Nama dasar file yang aman di semua OS dan tidak bisa keluar folder / merusak tautan wiki. Selalu tidak kosong. */
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

// ---------------- Rencana tangkapan (murni) ----------------

export interface CapturePlan {
	data: CaptureData;
	base: string;
	body: string;
	patch: IdeaPatch & { sumber?: string; asal: string };
}

export function planCapture(
	params: CaptureParams,
	opts: { settings: Settings; today: string; maxText: number },
): { ok: true; plan: CapturePlan } | { ok: false; error: CaptureError } {
	const v = validateCapture(params, { maxText: opts.maxText, defaultLang: opts.settings.language });
	if (!v.ok) return v;
	const d = v.data;
	return {
		ok: true,
		plan: {
			data: d,
			base: captureFileBase(d, opts.today),
			body: buildCaptureBody(d),
			patch: {
				tipe: "ide",
				status: "benih",
				dibuat: opts.today,
				tinjau: nextReview("benih", opts.today, opts.settings),
				gerbang: [],
				...(d.url ? { sumber: d.url } : {}),
				asal: "capture",
			},
		},
	};
}

/**
 * Nama dasar unik terhadap daftar nama yang sudah ada di folder. Perbandingan TANPA membedakan huruf besar/kecil
 * (Windows dan macOS memperlakukan "Cache" dan "cache" sebagai file yang sama).
 * `existing` = nama dasar (tanpa .md) atau nama file (dengan .md).
 */
export function uniqueBase(base: string, existing: Iterable<string>): string {
	const taken = new Set<string>();
	for (const e of existing) taken.add(e.replace(/\.md$/i, "").toLowerCase());
	if (!taken.has(base.toLowerCase())) return base;
	let n = 2;
	while (taken.has(`${base} ${n}`.toLowerCase())) n++;
	return `${base} ${n}`;
}
