import type { PropNames } from "./frontmatter";
// Tipe inti domain. Tidak boleh mengimpor "obsidian".
import type { AiSettings } from "./ai/types";

export const STATUSES = ["benih", "tumbuh", "matang", "dibuang"] as const;
export type Status = (typeof STATUSES)[number];
export type ActiveStatus = Exclude<Status, "dibuang">;

export const TIPES = ["ide", "konsep"] as const;
export type Tipe = (typeof TIPES)[number];

export const GATE_IDS = ["socratic", "devil", "feynman"] as const;
export type GateId = (typeof GATE_IDS)[number];

export type Language = "id" | "en";

/** Ide/konsep yang valid. Tanggal berformat ISO "YYYY-MM-DD". */
export interface Idea {
	path: string;
	title: string;
	tipe: Tipe;
	status: Status;
	dibuat?: string;
	tinjau?: string;
	gerbang: GateId[];
	/** Nilai `gates` lain yang tidak dikenal plugin (mis. "premortem"); hanya dibaca, dipertahankan saat menulis. */
	gerbangLain?: string[];
	/** Asal catatan (mis. "capture"). */
	asal?: string;
	/** Tanggal lokal waktu ubah berkas (file.stat.mtime): dasar "macet" (keputusan Q1). Edit manual atau sinkronisasi mengubahnya. */
	tersentuh?: string;
}

/** Catatan yang punya properti bengkel-* tetapi nilainya salah. */
export interface InvalidIdea {
	path: string;
	title: string;
	reason: string;
}

export type ParsedNote =
	| { kind: "none" }
	| { kind: "idea"; idea: Idea }
	| { kind: "invalid"; invalid: InvalidIdea };

export interface FeynmanSettings {
	jargon: string[];
	maxSentenceWords: number;
	maxGaps: number;
	/** path catatan -> istilah (huruf kecil) yang diabaikan */
	ignored: Record<string, string[]>;
}

export interface Settings {
	language: Language;
	folderIde: string;
	folderKonsep: string;
	/** interval tinjau (hari) per status aktif */
	intervals: Record<ActiveStatus, number>;
	snoozeDays: number;
	gates: Record<GateId, boolean>;
	/** Jika false, konsep tidak wajib Devil's Advocate untuk tumbuh -> matang. */
	devilForKonsep: boolean;
	socraticMinChars: number;
	devilMinAnswered: number;
	feynman: FeynmanSettings;
	notifyOnStartup: boolean;
	/** Path file JSON di vault untuk bank pertanyaan kustom (kosong = nonaktif). */
	customBankPath: string;
	/** Fitur AI (Addendum 07). Mati secara default. */
	ai: AiSettings;
	/** Tangkapan dari ekstensi Seedbed Capture (obsidian://seedbed-capture). */
	capture: CaptureSettings;
	/** Nama properti frontmatter milik Seedbed (default: type, status, created, review, gates, source, origin). */
	properties: PropNames;
	/** Templat Obsidian milik Seedbed (Seedbed Idea.md / Seedbed Concept.md). */
	templates: TemplateSettings;
	/** Pre-mortem (gerbang opsional untuk catatan matang). */
	premortem: { enabled: boolean; minAnswered: number; minChars: number };
	/** Retrieval: latihan mengingat saat tinjau. */
	retrieval: { enabled: boolean; adjustInterval: boolean };
	/** Digest mingguan. */
	digest: { folder: string; stuckDays: number; reminder: { enabled: boolean; day: number }; lastReminded: string };
	/** Connect: hubungkan ide dengan catatan Seedbed lain. */
	connect: { enabled: boolean };
}

export interface TemplateSettings {
	/** Folder templat. Kosong = ikuti folder plugin inti Templates, selain itu `Templates`. */
	folder: string;
	/** Tawaran "Buat templat Seedbed" sudah ditampilkan sekali (apa pun jawabannya). */
	offered: boolean;
}

export interface CaptureSettings {
	/** Tampilkan modal konfirmasi sebelum menyimpan (default AKTIF: situs mana pun bisa membuka link obsidian://). */
	confirm: boolean;
	/** Buka catatan setelah tersimpan. */
	openAfter: boolean;
	/** Batas karakter kutipan di sisi plugin. */
	maxChars: number;
}
