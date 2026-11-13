import type { Lang } from "./markdown";

export type Mode = "seedbed" | "fallback";

export interface Settings {
	/** Nama vault Obsidian tujuan (wajib diisi). */
	vault: string;
	language: Lang;
	/** Batas karakter kutipan sebelum dikirim. */
	maxQuote: number;
	/** Batas benih per hari; 0 = nonaktif. */
	dailyLimit: number;
	/** seedbed = obsidian://seedbed-capture; fallback = obsidian://new (tanpa plugin Seedbed). */
	mode: Mode;
}

export const DEFAULT_SETTINGS: Settings = {
	vault: "",
	language: "id",
	maxQuote: 1000,
	dailyLimit: 5,
	mode: "seedbed",
};

export const SETTINGS_RANGE = { maxQuote: [100, 5000], dailyLimit: [0, 100] } as const;

function clampInt(v: unknown, fallback: number, [min, max]: readonly [number, number]): number {
	if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, Math.round(v)));
}

/** Nama vault: satu baris, tanpa karakter kontrol, maks. 100 karakter. */
export function cleanVaultName(v: unknown): string {
	if (typeof v !== "string") return "";
	// eslint-disable-next-line no-control-regex -- the regex must match control characters on purpose, to strip them from the vault name
	return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export function mergeSettings(raw: unknown): Settings {
	const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	const d = DEFAULT_SETTINGS;
	return {
		vault: cleanVaultName(r.vault),
		language: r.language === "en" ? "en" : r.language === "id" ? "id" : d.language,
		maxQuote: clampInt(r.maxQuote, d.maxQuote, SETTINGS_RANGE.maxQuote),
		dailyLimit: clampInt(r.dailyLimit, d.dailyLimit, SETTINGS_RANGE.dailyLimit),
		mode: r.mode === "fallback" ? "fallback" : "seedbed",
	};
}
