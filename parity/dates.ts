// Tanggal sebagai string ISO "YYYY-MM-DD" (tanpa zona waktu), supaya tes deterministik.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(s: unknown): s is string {
	if (typeof s !== "string") return false;
	const m = ISO_RE.exec(s);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const dt = new Date(Date.UTC(y, mo - 1, d));
	return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Tanggal lokal dari objek Date. */
export function toISODate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Selisih hari dari `a` ke `b` (positif jika b setelah a). */
export function daysBetween(a: string, b: string): number {
	const pa = ISO_RE.exec(a);
	const pb = ISO_RE.exec(b);
	if (!pa || !pb) return 0;
	return Math.round((Date.UTC(+pb[1]!, +pb[2]! - 1, +pb[3]!) - Date.UTC(+pa[1]!, +pa[2]! - 1, +pa[3]!)) / 86400000);
}

export function addDays(iso: string, days: number): string {
	const m = ISO_RE.exec(iso);
	if (!m) throw new Error(`Tanggal tidak valid: ${iso}`);
	const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
	return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
