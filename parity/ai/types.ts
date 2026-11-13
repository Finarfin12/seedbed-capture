import type { Language } from "../types";

// ---- Pengaturan AI (Addendum 07 §7.4). AI MATI secara default. ----

export type ProviderId = "cli" | "local" | "api";
export type CliTool = "claude" | "codex" | "gemini";
export type LocalKind = "ollama" | "lmstudio";
export type SocraticMode = "adaptif" | "satu-tarikan";

export interface AiSettings {
	enabled: boolean;
	order: ProviderId[];
	providers: {
		cli: { enabled: boolean; tool: CliTool; model: string; approved: boolean };
		local: { enabled: boolean; kind: LocalKind; model: string; baseUrl: string; approved: boolean };
		api: { enabled: boolean; baseUrl: string; model: string; apiKey: string; approved: boolean };
	};
	socraticMode: SocraticMode;
	timeoutSec: number;
	maxContextChars: number;
	hintsPerQuestion: number;
}

export const PROVIDER_IDS: readonly ProviderId[] = ["cli", "local", "api"];

export const DEFAULT_AI: AiSettings = {
	enabled: false,
	order: ["cli", "local", "api"],
	providers: {
		cli: { enabled: false, tool: "claude", model: "", approved: false },
		local: { enabled: false, kind: "ollama", model: "", baseUrl: "", approved: false },
		api: { enabled: false, baseUrl: "", model: "", apiKey: "", approved: false },
	},
	socraticMode: "adaptif",
	timeoutSec: 20,
	maxContextChars: 4000,
	hintsPerQuestion: 2,
};

// ---- Sumber pertanyaan (R-6: transparansi) ----

export type SourceLabel =
	| { kind: "bank" }
	| { kind: "ai-local"; name: string }
	| { kind: "ai-cloud"; name: string };

export function formatSource(s: SourceLabel, lang: Language): string {
	if (s.kind === "bank") return "Bank";
	const where = s.kind === "ai-local" ? (lang === "id" ? "lokal" : "local") : "cloud";
	return `AI · ${where} (${s.name})`;
}

// ---- Kontrak penyedia ----

export interface Prompt {
	system: string;
	user: string;
}

export interface AiProvider {
	id: ProviderId;
	label: SourceLabel;
	/** Kembalikan teks mentah model. Wajib menghormati `signal` (batalkan/kill saat timeout). */
	complete(prompt: Prompt, opts: { signal: AbortSignal }): Promise<string>;
}

export interface PreviousAnswer {
	category: string;
	question: string;
	answer: string;
}

export interface AiContext {
	language: Language;
	/** Isi catatan aktif saja (F-52); dipotong oleh PromptBuilder. */
	noteText: string;
	previous?: PreviousAnswer[];
}
