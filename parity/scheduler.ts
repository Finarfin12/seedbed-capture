import { addDays, isValidISODate } from "./dates";
import type { Idea, Settings, Status } from "./types";

/** Tanggal tinjau berikutnya; `dibuang` tidak punya tanggal tinjau. */
export function nextReview(status: Status, today: string, settings: Settings): string | null {
	if (status === "dibuang") return null;
	return addDays(today, settings.intervals[status]);
}

/** Tunda = hari ini + n hari. */
export function snooze(today: string, days: number): string {
	return addDays(today, days);
}

/** Jatuh tempo jika bukan `dibuang` dan (tanggal tinjau <= hari ini, atau belum ada). */
export function isDue(idea: Idea, today: string): boolean {
	if (idea.status === "dibuang") return false;
	if (!isValidISODate(idea.tinjau)) return true;
	return idea.tinjau <= today;
}
