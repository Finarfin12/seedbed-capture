import { isValidISODate } from "./dates";
import { GATE_IDS } from "./types";
import type { GateId, Idea, ParsedNote, Status, Tipe } from "./types";

/**
 * Properti catatan Seedbed (0.7.0): nama UMUM tanpa prefiks supaya mudah dipakai di template, nilai English,
 * sama untuk semua bahasa UI. Nama bisa diatur di pengaturan (PropNames). Karena nama umum mudah bentrok dengan
 * catatan/plugin lain, sebuah catatan dianggap milik Seedbed HANYA jika `type` bernilai `idea` atau `concept`
 * (atau memakai kunci format lama yang khas). Catatan lain tidak pernah dibaca, ditandai, atau ditulis.
 *
 * Format lama yang tetap DIBACA dan bisa dimigrasikan: 0.6 (`bengkel-tipe`, nilai Indonesia) dan build pengembangan
 * 0.7 (`seedbed-type`, nilai English).
 */
export const FIELDS = ["type", "status", "created", "review", "gates", "source", "origin"] as const;
export type PropField = (typeof FIELDS)[number];
export type PropNames = Record<PropField, string>;

export const DEFAULT_NAMES: PropNames = {
	type: "type",
	status: "status",
	created: "created",
	review: "review",
	gates: "gates",
	source: "source",
	origin: "origin",
};
/** Alias untuk tes dan kode yang memakai nama bawaan. */
export const KEY = DEFAULT_NAMES;

const LEGACY_SETS: Array<Record<PropField, string>> = [
	{
		type: "bengkel-tipe",
		status: "bengkel-status",
		created: "bengkel-dibuat",
		review: "bengkel-tinjau",
		gates: "bengkel-gerbang",
		source: "bengkel-sumber",
		origin: "bengkel-asal",
	},
	{
		type: "seedbed-type",
		status: "seedbed-status",
		created: "seedbed-created",
		review: "seedbed-review",
		gates: "seedbed-gates",
		source: "seedbed-source",
		origin: "seedbed-origin",
	},
];
export const LEGACY_KEY = LEGACY_SETS[0] as Record<PropField, string>;

type FM = Record<string, unknown>;

/** Nama properti yang boleh: huruf/angka/_/-/spasi di tengah, maks. 60, tanpa titik dua, #, atau baris baru. */
export const PROP_NAME_RE = /^[A-Za-z0-9_](?:[A-Za-z0-9_ -]{0,58}[A-Za-z0-9_])?$/;

/** Validasi pemetaan nama dari data tidak tepercaya: tiap nama sah dan unik (tanpa beda huruf); jika tidak, bawaan. */
export function sanitizeNames(raw: unknown): PropNames {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_NAMES };
	const r = raw as Record<string, unknown>;
	const out = { ...DEFAULT_NAMES };
	for (const f of FIELDS) {
		const v = typeof r[f] === "string" ? (r[f] as string).trim() : "";
		if (PROP_NAME_RE.test(v)) out[f] = v;
	}
	const seen = new Set<string>();
	for (const f of FIELDS) {
		const k = out[f].toLowerCase();
		if (seen.has(k)) return { ...DEFAULT_NAMES };
		seen.add(k);
	}
	return out;
}

/** Cek satu nama baru terhadap yang lain: mengembalikan alasan penolakan atau null. */
export function checkName(names: PropNames, field: PropField, value: string): "invalid" | "duplicate" | null {
	const v = value.trim();
	if (!PROP_NAME_RE.test(v)) return "invalid";
	for (const f of FIELDS) if (f !== field && names[f].toLowerCase() === v.toLowerCase()) return "duplicate";
	return null;
}

// Nilai internal (Indonesia) <-> nilai tersimpan di catatan (English).
const STATUS_STORED: Record<Status, string> = { benih: "seed", tumbuh: "growing", matang: "mature", dibuang: "discarded" };
const TIPE_STORED: Record<Tipe, string> = { ide: "idea", konsep: "concept" };

export const storedStatus = (s: Status): string => STATUS_STORED[s];
export const storedTipe = (t: Tipe): string => TIPE_STORED[t];

/** `legacy` = kunci format lama: terima juga nilai Indonesia. Kunci baru: hanya nilai English. */
function lookup<T extends string>(table: Record<T, string>, raw: unknown, legacy: boolean): T | undefined {
	if (typeof raw !== "string") return undefined;
	const v = raw.trim().toLowerCase();
	for (const k of Object.keys(table) as T[]) if (v === table[k] || (legacy && v === k)) return k;
	return undefined;
}
const normStatus = (raw: unknown, legacy: boolean): Status | undefined => lookup(STATUS_STORED, raw, legacy);
const normTipe = (raw: unknown, legacy: boolean): Tipe | undefined => lookup(TIPE_STORED, raw, legacy);

/** Kunci untuk satu bidang: nama baru jika ada di catatan, selain itu kunci lama pertama yang ada. */
function pickKey(fm: FM, f: PropField, names: PropNames): string | undefined {
	if (names[f] in fm) return names[f];
	for (const set of LEGACY_SETS) if (set[f] in fm && set[f] !== names[f]) return set[f];
	return undefined;
}

function asDate(v: unknown): string | undefined {
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	if (typeof v === "string") {
		const s = v.trim().slice(0, 10);
		return isValidISODate(s) ? s : undefined;
	}
	return undefined;
}

function otherGates(v: unknown): string[] {
	const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
	const out: string[] = [];
	for (const g of list) if (typeof g === "string" && !(GATE_IDS as readonly unknown[]).includes(g) && !out.includes(g)) out.push(g);
	return out;
}

function asGates(v: unknown): GateId[] {
	const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
	const out: GateId[] = [];
	for (const g of list) {
		if ((GATE_IDS as readonly unknown[]).includes(g) && !out.includes(g as GateId)) out.push(g as GateId);
	}
	return out;
}

/**
 * Baca frontmatter menjadi Idea. Tidak pernah melempar error (input = data pengguna).
 * - `none`: bukan catatan Seedbed (termasuk catatan lain yang kebetulan punya `status`, `created`, atau `type: book`).
 * - `invalid`: milik Seedbed (type idea/concept atau kunci lama) tetapi nilai type/status di luar daftar.
 */
export function parseIdeaNote(path: string, title: string, fm: FM | null | undefined, names: PropNames = DEFAULT_NAMES): ParsedNote {
	if (!fm) return { kind: "none" };
	const tk = pickKey(fm, "type", names);
	const sk = pickKey(fm, "status", names);
	const tLegacy = tk !== undefined && tk !== names.type;
	const sLegacy = sk !== undefined && sk !== names.status;
	const tipe = tk !== undefined ? normTipe(fm[tk], tLegacy) : undefined;
	const owned = (tk === names.type && tipe !== undefined) || tLegacy || sLegacy;
	if (!owned) return { kind: "none" };
	if (!tipe) return { kind: "invalid", invalid: { path, title, reason: `${tk ?? names.type}: ${String(tk ? fm[tk] : undefined)}` } };
	const status = sk !== undefined ? normStatus(fm[sk], sLegacy) : undefined;
	if (!status) return { kind: "invalid", invalid: { path, title, reason: `${sk ?? names.status}: ${String(sk ? fm[sk] : undefined)}` } };
	const get = (f: PropField): unknown => {
		const k = pickKey(fm, f, names);
		return k === undefined ? undefined : fm[k];
	};
	const origin = get("origin");
	const idea: Idea = {
		path,
		title,
		tipe,
		status,
		dibuat: asDate(get("created")),
		tinjau: asDate(get("review")),
		gerbang: asGates(get("gates")),
		...(otherGates(get("gates")).length ? { gerbangLain: otherGates(get("gates")) } : {}),
		asal: typeof origin === "string" ? origin : undefined,
	};
	return { kind: "idea", idea };
}

/** Ada properti format lama (kunci khas `bengkel-*` atau `seedbed-*` milik plugin) di frontmatter ini? */
export function hasLegacyProps(fm: FM | null | undefined, names: PropNames = DEFAULT_NAMES): boolean {
	if (!fm) return false;
	for (const set of LEGACY_SETS) for (const f of FIELDS) if (set[f] in fm && set[f] !== names[f]) return true;
	return false;
}

function convertValue(f: PropField, v: unknown): unknown {
	if (f === "type") {
		const t = normTipe(v, true);
		return t ? TIPE_STORED[t] : v;
	}
	if (f === "status") {
		const s = normStatus(v, true);
		return s ? STATUS_STORED[s] : v;
	}
	return v;
}
function sameValue(f: PropField, a: unknown, b: unknown): boolean {
	if (f === "type" || f === "status") return a === b;
	const norm = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : x);
	return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export interface MigrateResult {
	/** Frontmatter diubah. */
	changed: boolean;
	/** Dilewati: properti tujuan sudah berisi nilai lain (mis. `status: draft` dari template lain). Tidak ada yang diubah. */
	conflict: boolean;
}

/**
 * Ubah properti format lama milik plugin ke nama dan nilai baru, pada tempatnya (urutan dipertahankan).
 * - Hanya kunci lama yang dikenal yang disentuh; properti lain utuh.
 * - Jika properti tujuan sudah ada dengan nilai BERBEDA, tidak ada yang ditimpa: seluruh catatan dilewati (`conflict`).
 * - Jika properti tujuan sudah ada dengan nilai yang sama, kunci lama cukup dibuang.
 * - Type lama yang tidak dikenal (bukan idea/concept) juga dilewati (tetap tampil "tidak valid"). Status yang tidak dikenal
 *   dengan type sah disalin apa adanya (tetap tidak valid). Idempoten.
 */
export function migrateLegacy(fm: FM, names: PropNames = DEFAULT_NAMES): MigrateResult {
	if (!hasLegacyProps(fm, names)) return { changed: false, conflict: false };
	const target = new Map<string, PropField>();
	for (const set of LEGACY_SETS) for (const f of FIELDS) if (set[f] !== names[f]) target.set(set[f], f);
	// Deteksi konflik sebelum mengubah apa pun.
	const first = new Map<PropField, unknown>();
	for (const [k, v] of Object.entries(fm)) {
		const f = target.get(k);
		if (!f) continue;
		const cv = convertValue(f, v);
		if (names[f] in fm && !sameValue(f, fm[names[f]], cv)) return { changed: false, conflict: true };
		if (first.has(f) && !sameValue(f, first.get(f), cv)) return { changed: false, conflict: true };
		first.set(f, cv);
	}
	// Type lama yang bukan idea/concept: setelah dipindah ke nama baru catatan akan dianggap bukan milik Seedbed dan
	// hilang dari daftar "tidak valid". Jangan diubah; lewati dan laporkan.
	if (first.has("type") && normTipe(first.get("type"), false) === undefined) return { changed: false, conflict: true };
	const out: Array<[string, unknown]> = [];
	const emitted = new Set<PropField>();
	for (const [k, v] of Object.entries(fm)) {
		const f = target.get(k);
		if (!f) {
			out.push([k, v]);
			continue;
		}
		if (names[f] in fm || emitted.has(f)) continue;
		emitted.add(f);
		out.push([names[f], first.get(f)]);
	}
	for (const k of Object.keys(fm)) delete fm[k];
	for (const [k, v] of out) fm[k] = v;
	return { changed: true, conflict: false };
}

/** Perubahan yang boleh dilakukan plugin. undefined = biarkan; null = hapus properti. */
export interface IdeaPatch {
	tipe?: Tipe;
	status?: Status;
	dibuat?: string;
	tinjau?: string | null;
	gerbang?: GateId[];
	/** Nilai `gates` tambahan yang tidak ada di GateId (mis. "premortem"). */
	addGates?: string[];
	/** URL sumber (tangkapan dari ekstensi). */
	sumber?: string;
	/** Asal catatan, mis. "capture". */
	asal?: string;
}

/**
 * Terapkan patch ke objek frontmatter (dimutasi). Hanya menyentuh properti milik plugin (nama di `names` dan kunci lama).
 * Catatan format lama dikonversi seluruhnya lebih dulu dalam panggilan yang sama; jika ada konflik nilai, melempar
 * error dan tidak mengubah apa pun (dipanggil hanya untuk catatan yang terbaca sebagai milik Seedbed, jadi jarang terjadi).
 */
export function applyPatch(fm: FM, patch: IdeaPatch, names: PropNames = DEFAULT_NAMES): void {
	if (migrateLegacy(fm, names).conflict) throw new Error("property conflict: a Seedbed property already holds another value");
	if (patch.tipe !== undefined) fm[names.type] = storedTipe(patch.tipe);
	if (patch.status !== undefined) fm[names.status] = storedStatus(patch.status);
	if (patch.dibuat !== undefined) fm[names.created] = patch.dibuat;
	if (patch.tinjau === null) delete fm[names.review];
	else if (patch.tinjau !== undefined) fm[names.review] = patch.tinjau;
	if (patch.gerbang !== undefined || patch.addGates !== undefined) {
		// G-1: nilai `gates` yang tidak dikenal (mis. "premortem" dari skill) dipertahankan, tidak dihapus.
		const prev = fm[names.gates];
		const list = Array.isArray(prev) ? prev : typeof prev === "string" ? [prev] : [];
		const known = patch.gerbang !== undefined ? [...patch.gerbang] : list.filter((g): g is GateId => (GATE_IDS as readonly unknown[]).includes(g));
		const extra = list.filter((g) => typeof g === "string" && !(GATE_IDS as readonly unknown[]).includes(g));
		for (const g of patch.addGates ?? []) if (!extra.includes(g)) extra.push(g);
		fm[names.gates] = [...known, ...extra];
	}
	if (patch.sumber !== undefined) fm[names.source] = patch.sumber;
	if (patch.asal !== undefined) fm[names.origin] = patch.asal;
}

/**
 * Rencana "jadikan catatan ini ide/konsep" pada catatan yang BELUM milik Seedbed: `type` dan `status` tidak boleh
 * sudah ada (mungkin milik template lain; tidak ditimpa), dan properti lain (created, review, gates) hanya ditulis
 * bila belum ada. Mengembalikan patch yang aman, atau nama properti yang bentrok.
 */
export function planAdopt(
	fm: FM | null | undefined,
	patch: IdeaPatch,
	names: PropNames = DEFAULT_NAMES,
): { ok: true; patch: IdeaPatch } | { ok: false; key: string } {
	const has = (k: string): boolean => !!fm && k in fm;
	for (const f of ["type", "status"] as const) if (has(names[f])) return { ok: false, key: names[f] };
	for (const set of LEGACY_SETS) for (const f of ["type", "status"] as const) if (has(set[f])) return { ok: false, key: set[f] };
	const safe: IdeaPatch = { ...patch };
	if (has(names.created)) delete safe.dibuat;
	if (has(names.review)) delete safe.tinjau;
	if (has(names.gates)) delete safe.gerbang;
	return { ok: true, patch: safe };
}
