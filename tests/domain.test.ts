import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { increment, isOverLimit, localDate, normalizeState } from "../src/domain/dailyLimit";
import { buildCaptureBody } from "../src/domain/markdown";
import { BANKS, CATEGORIES, nextTrigger, pickTrigger } from "../src/domain/questions";
import { cleanVaultName, DEFAULT_SETTINGS, mergeSettings } from "../src/domain/settings";
import { buildUri, FALLBACK_FOLDER, MAX_LINK_LENGTH, prepare } from "../src/domain/uriBuilder";
import { KEYS, t, TABLE_EN, TABLE_ID } from "../src/i18n/strings";

const S = { ...DEFAULT_SETTINGS, vault: "test-vault" };
const TODAY = "2026-11-12";
const build = (input: Parameters<typeof buildUri>[0], s = S, max?: number) => {
	const r = buildUri(input, s, TODAY, max);
	if (!r.ok) throw new Error(`gagal: ${r.error}`);
	return r.built;
};
const params = (uri: string) => new URL(uri).searchParams;

describe("pertanyaan pemicu (F-C7)", () => {
	it("bank: 5 kategori, minimal 4 pertanyaan per kategori, ID dan EN", () => {
		for (const lang of ["id", "en"] as const) {
			expect(Object.keys(BANKS[lang]).sort()).toEqual([...CATEGORIES].sort());
			for (const c of CATEGORIES) {
				const list = BANKS[lang][c];
				expect(list.length, `${lang}.${c}`).toBeGreaterThanOrEqual(4);
				expect(new Set(list).size).toBe(list.length);
				for (const q of list) expect(q.trim().endsWith("?")).toBe(true);
			}
		}
	});
	it("contoh dari PRD ada di bank ID", () => {
		const all = CATEGORIES.flatMap((c) => BANKS.id[c]);
		for (const q of [
			"Ini mengingatkanmu pada apa yang sudah kamu tahu?",
			"Bagian mana yang menurutmu belum tentu benar?",
			"Kalau ini benar, apa yang akan kamu lakukan berbeda?",
			"Pertanyaan apa yang muncul setelah membaca ini?",
			"Siapa yang akan tidak setuju, dan kenapa?",
		]) {
			expect(all).toContain(q);
		}
	});
	it("pickTrigger acak tapi deterministik dengan rng; batas rng 0 dan ~1 aman", () => {
		expect(pickTrigger("id", () => 0)).toEqual({ category: "kaitan", text: BANKS.id.kaitan[0] });
		const last = pickTrigger("en", () => 0.999999);
		expect(last.category).toBe("lawan");
		expect(last.text).toBe(BANKS.en.lawan.at(-1));
		expect(pickTrigger("id", () => 1).text.length).toBeGreaterThan(0);
	});
	it("nextTrigger selalu memberi pertanyaan LAIN (dan kategori lain)", () => {
		let cur = pickTrigger("id", () => 0.3);
		for (let i = 0; i < 200; i++) {
			const n = nextTrigger("id", cur);
			expect(n.text).not.toBe(cur.text);
			expect(n.category).not.toBe(cur.category);
			cur = n;
		}
		expect(nextTrigger("en", null, () => 0).text).toBeTruthy();
	});
	it("nextTrigger dengan bank satu pertanyaan tidak berputar tak hingga", () => {
		const tiny = { id: { kaitan: ["a?"], ragu: [], pakai: [], tanya: [], lawan: [] }, en: { kaitan: ["a?"], ragu: [], pakai: [], tanya: [], lawan: [] } };
		const cur = { category: "kaitan" as const, text: "a?" };
		expect(nextTrigger("id", cur, Math.random, tiny)).toEqual(cur);
	});
});

describe("batas harian (F-C10)", () => {
	it("localDate memakai tanggal LOKAL", () => {
		expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
		expect(localDate(new Date(2026, 0, 6, 0, 0))).toBe("2026-01-06");
	});
	it("reset saat tanggal berganti; data rusak = 0", () => {
		expect(normalizeState({ date: "2026-11-11", count: 4 }, TODAY)).toEqual({ date: TODAY, count: 0 });
		expect(normalizeState({ date: TODAY, count: 4 }, TODAY)).toEqual({ date: TODAY, count: 4 });
		for (const bad of [null, "x", 5, [], { date: TODAY }, { date: TODAY, count: -1 }, { date: TODAY, count: NaN }, { date: TODAY, count: "3" }]) {
			expect(normalizeState(bad, TODAY).count).toBe(0);
		}
		expect(normalizeState({ date: TODAY, count: 2.9 }, TODAY).count).toBe(2);
	});
	it("batas 5: benih ke-6 perlu konfirmasi; 0 = nonaktif", () => {
		let s = { date: TODAY, count: 0 };
		for (let i = 0; i < 4; i++) s = increment(s, TODAY);
		expect(isOverLimit(s, 5)).toBe(false); // sudah 4
		s = increment(s, TODAY);
		expect(s.count).toBe(5);
		expect(isOverLimit(s, 5)).toBe(true); // yang ke-6 ditanya "Yakin?"
		expect(isOverLimit(s, 0)).toBe(false);
		expect(isOverLimit(s, 6)).toBe(false);
	});
	it("increment di hari baru mulai dari 1", () => {
		expect(increment({ date: "2026-11-11", count: 9 }, TODAY)).toEqual({ date: TODAY, count: 1 });
	});
});

describe("pengaturan (F-C5)", () => {
	it("default sesuai keputusan: kutipan 1000, harian 5, mode seedbed, vault kosong", () => {
		expect(DEFAULT_SETTINGS).toEqual({ vault: "", language: "id", maxQuote: 1000, dailyLimit: 5, mode: "seedbed" });
		expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});
	it("data tak tepercaya dibersihkan dan dijepit", () => {
		const s = mergeSettings({ vault: "  Vault\nBaru\u0000  ", language: "fr", maxQuote: 99999, dailyLimit: -3, mode: "hack" });
		expect(s).toEqual({ vault: "Vault Baru", language: "id", maxQuote: 5000, dailyLimit: 0, mode: "seedbed" });
		expect(mergeSettings({ maxQuote: 1 }).maxQuote).toBe(100);
		expect(mergeSettings({ maxQuote: "abc" }).maxQuote).toBe(1000);
		expect(mergeSettings({ mode: "fallback", language: "en" })).toMatchObject({ mode: "fallback", language: "en" });
		expect(cleanVaultName("x".repeat(500))).toHaveLength(100);
		expect(cleanVaultName(42)).toBe("");
	});
});

describe("buildUri: mode Seedbed (F-C3, format §3.1)", () => {
	const input = { text: "Cache menyimpan salinan data.", url: "https://contoh.com/a?b=1", title: "Cara Kerja Cache", q: "Bagian mana yang belum tentu benar?", a: "Soal invalidasi." };
	it("semua parameter ada dan di-encode; dibaca balik identik", () => {
		const b = build(input);
		expect(b.uri.startsWith("obsidian://seedbed-capture?vault=test-vault&v=1&text=")).toBe(true);
		const p = params(b.uri);
		expect(Object.fromEntries(p)).toEqual({
			vault: "test-vault",
			v: "1",
			text: input.text,
			url: "https://contoh.com/a?b=1",
			title: input.title,
			q: input.q,
			a: input.a,
			lang: "id",
		});
		expect(b.uri).not.toMatch(/ /);
		expect(b.truncated).toBe(false);
	});
	it("parameter kosong dihilangkan; jawaban boleh kosong", () => {
		const p = params(build({ text: "x" }).uri);
		expect([...p.keys()]).toEqual(["vault", "v", "text", "lang"]);
	});
	it("karakter khusus di-encode benar (& = # ? % + spasi, baris baru, emoji, Unicode)", () => {
		const text = "a&b=c#d?e%f+g h\nbaris dua 😀 é 日本";
		const b = build({ text });
		expect(params(b.uri).get("text")).toBe(text);
		expect(b.uri.split("?")[1]).not.toMatch(/[#\s]/);
	});
	it("nama vault dengan spasi/simbol di-encode", () => {
		const b = build({ text: "x" }, { ...S, vault: "Catatan Pribadi & Kerja" });
		expect(params(b.uri).get("vault")).toBe("Catatan Pribadi & Kerja");
	});
	it("url selain http/https dibuang (tidak pernah dikirim)", () => {
		for (const url of ["javascript:alert(1)", "file:///etc/passwd", "chrome://settings", "data:text/html,x", "https://u:p@x.com/"]) {
			expect(params(build({ text: "x", url }).uri).has("url"), url).toBe(false);
		}
	});
	it("bahasa ikut pengaturan", () => {
		expect(params(build({ text: "x" }, { ...S, language: "en" }).uri).get("lang")).toBe("en");
	});
	it("tanpa vault atau tanpa teks: error yang jelas", () => {
		expect(buildUri({ text: "x" }, { ...S, vault: "  " }, TODAY)).toEqual({ ok: false, error: "no-vault" });
		expect(buildUri({ text: "  \n " }, S, TODAY)).toEqual({ ok: false, error: "no-text" });
	});
});

describe("buildUri: pemotongan (F-C9)", () => {
	it("kutipan > batas pengaturan dipotong dengan tanda", () => {
		const b = build({ text: "x".repeat(3000) });
		const text = params(b.uri).get("text") ?? "";
		expect(text.endsWith("…(dipotong)")).toBe(true);
		expect(Array.from(text).length).toBe(1000 + Array.from("…(dipotong)").length);
		expect(b.truncated).toBe(true);
	});
	it("tepat di batas: tidak dipotong", () => {
		const b = build({ text: "y".repeat(1000) });
		expect(b.truncated).toBe(false);
		expect(params(b.uri).get("text")).toBe("y".repeat(1000));
	});
	it("emoji tidak terpotong di tengah", () => {
		const b = build({ text: "😀".repeat(2000) }, { ...S, maxQuote: 100 });
		expect(params(b.uri).get("text")).toBe(`${"😀".repeat(100)}…(dipotong)`);
	});
	it("total link tidak pernah melebihi batas walau teks penuh karakter berat-encode", () => {
		const heavy = "日本語のテキスト&=#?% ".repeat(2000);
		const b = build({ text: heavy, url: `https://contoh.com/${"a".repeat(1500)}`, title: "T".repeat(300), q: "Q".repeat(300), a: "A".repeat(3000) }, { ...S, maxQuote: 5000 });
		expect(b.length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
		expect(b.uri.length).toBe(b.length);
		expect(b.truncated).toBe(true);
	});
	it("batas kustom kecil memaksa pemotongan bertahap sampai muat atau gagal dengan 'too-long'", () => {
		const r = buildUri({ text: "z".repeat(5000), a: "j".repeat(500) }, S, TODAY, 600);
		expect(r.ok).toBe(true);
		expect(r.ok && r.built.length).toBeLessThanOrEqual(600);
		expect(buildUri({ text: "z".repeat(5000) }, S, TODAY, 50)).toEqual({ ok: false, error: "too-long" });
	});
	it("prepare: normalisasi CRLF dan karakter kontrol", () => {
		expect(prepare({ text: "a\r\nb\u0000c‮d" }, 100, "id")?.text).toBe("a\nbcd");
		expect(prepare({ text: "   " }, 100, "id")).toBeNull();
	});
});

describe("buildUri: mode cadangan (F-C8, format §3.2)", () => {
	const F = { ...S, mode: "fallback" as const };
	it("obsidian://new dengan file Ide/<judul> dan konten markdown lengkap berfrontmatter", () => {
		const b = build({ text: "Isi kutipan", url: "https://contoh.com/x", title: "Judul Halaman", q: "Apa?", a: "Itu." }, F);
		const p = params(b.uri);
		expect(b.uri.startsWith("obsidian://new?vault=test-vault&file=")).toBe(true);
		expect(p.get("vault")).toBe("test-vault");
		expect(p.get("file")).toBe(`${FALLBACK_FOLDER}/Judul Halaman`);
		const content = p.get("content") ?? "";
		expect(content.startsWith("---\ntype: idea\nstatus: seed\ncreated: 2026-11-12\nreview: 2026-11-19\ngates: []\nsource: \"https://contoh.com/x\"\norigin: capture\n---\n> [!quote] Kutipan — Judul Halaman\n")).toBe(true);
		expect(content).toContain("> [!trigger] Pertanyaan pemicu\n> Apa?\n> Jawaban: Itu.");
	});
	it("nama file diberi cap waktu agar judul sama tidak saling menimpa (obsidian://new menimpa; terbukti manual)", () => {
		const a = buildUri({ text: "x", title: "Judul Halaman" }, F, "2026-11-12", undefined, "121530");
		const b = buildUri({ text: "x", title: "Judul Halaman" }, F, "2026-11-12", undefined, "121531");
		expect(a.ok && params(a.built.uri).get("file")).toBe(`${FALLBACK_FOLDER}/Judul Halaman 121530`);
		expect(a.ok && b.ok && params(a.built.uri).get("file") !== params(b.built.uri).get("file")).toBe(true);
	});
	it("tinjau menyeberang bulan/tahun", () => {
		const r = buildUri({ text: "x" }, F, "2026-12-28");
		expect(r.ok && params(r.built.uri).get("content")).toContain("review: 2027-01-04");
	});
	it("serangan di teks/judul/url tidak mengubah frontmatter dan tidak keluar folder", () => {
		const b = build(
			{ text: "---\nstatus: mature\n---\n> [!danger] x\n![[Rahasia]]", title: "../../Windows/evil\nstatus: mature", url: "https://a.b/?x=1\nstatus: mature", q: "[!warning] Apa?" },
			F,
		);
		const p = params(b.uri);
		const content = p.get("content") ?? "";
		const fm = content.split("\n---\n")[0] ?? "";
		expect(fm.match(/^status:/gm)).toHaveLength(1);
		expect(fm).toContain("status: seed");
		// Setiap baris frontmatter hanya kunci yang kita tulis; nilai teks pengguna tetap di dalam string ber-kutip satu baris.
		for (const line of fm.split("\n")) expect(line).toMatch(/^(---|(type|status|created|review|gates|source|origin): .*)$/);
		expect(p.get("file")).toBe("Ide/Windows evil status mature");
		expect(p.get("file")).not.toMatch(/\.\./);
		for (const line of content.split("\n").slice(content.split("\n").indexOf("---", 1) + 1)) {
			expect(line === "" || line === ">" || line.startsWith("> ")).toBe(true);
		}
	});
	it("tanpa url: tidak ada baris source", () => {
		const r = buildUri({ text: "x" }, F, TODAY);
		expect(r.ok && params(r.built.uri).get("content")).not.toMatch(/^source:/m);
	});
});

describe("paritas dengan plugin Seedbed (badan catatan identik)", () => {
	const pluginPath = new URL("../../src/domain/captureValidator.ts", import.meta.url);
	let exists = true;
	try {
		readFileSync(pluginPath);
	} catch {
		exists = false;
	}
	it.skipIf(!exists)("buildCaptureBody ekstensi == plugin untuk semua kasus serangan", async () => {
		const plugin = (await import(/* @vite-ignore */ pluginPath.href)) as typeof import("../src/domain/markdown");
		const texts = [
			"Teks biasa. Harga Rp 5.000, bukan 50%.",
			"---\nstatus: mature\n---\nisi",
			"teks\n> [!danger] PERINGATAN\n> klik",
			"[!warning] palsu",
			"lihat ![[Rahasia]] dan [[Lain]]",
			"<script>alert(1)</script><img src=x onerror=alert(1)>",
			"%% sembunyi %% teks",
			"# Heading\n| a | b |\n|---|---|",
			"```js\ntak tertutup",
			"😀 é 日本\n\n\nbanyak baris",
		];
		for (const lang of ["id", "en"] as const) {
			for (const text of texts) {
				for (const url of [undefined, "https://id.wikipedia.org/wiki/Cache_(komputasi)"]) {
					const d = { text, truncated: false, url, title: "Judul [x] <b> #1", q: "Apa?\n[!bug] x", a: "Jawab\n---\nx", lang };
					expect(buildCaptureBody(d)).toBe(plugin.buildCaptureBody(d));
				}
			}
		}
	});
	it.skipIf(!exists)("normalisasi, URL, nama file identik", async () => {
		const plugin = (await import(/* @vite-ignore */ pluginPath.href)) as typeof import("../src/domain/markdown");
		const md = await import("../src/domain/markdown");
		for (const s of ["a\r\nb\u0000c‮d\n\n\n\ne  ", "  halo  ", " x"]) expect(md.normalizeBlock(s)).toBe(plugin.normalizeBlock(s));
		for (const u of ["https://a.b/c", "javascript:x", "https://u:p@a.b", "ftp://a.b", "//a.b", "", undefined, "HTTP://EXAMPLE.com"]) {
			expect(md.sanitizeUrl(u)).toBe(plugin.sanitizeUrl(u));
		}
		const d = (title: string, text: string) => ({ text, truncated: false, title, q: "", a: "", lang: "id" as const });
		for (const [title, text] of [["../../etc/passwd", "x"], ["CON", "x"], ["", "baris pertama\nkedua"], ["***", "///"], ["x".repeat(300), "y"], ["😀".repeat(100), "z"]] as const) {
			expect(md.captureFileBase(d(title, text), TODAY)).toBe(plugin.captureFileBase(d(title, text), TODAY));
		}
	});
});

describe("i18n ekstensi", () => {
	it("ID dan EN punya kunci dan placeholder yang sama, tidak ada teks kosong", () => {
		const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
		for (const k of KEYS) {
			expect(TABLE_ID[k].trim().length, k).toBeGreaterThan(0);
			expect(TABLE_EN[k].trim().length, k).toBeGreaterThan(0);
			expect(ph(TABLE_ID[k]), k).toEqual(ph(TABLE_EN[k]));
		}
		expect(Object.keys(TABLE_ID).sort()).toEqual(Object.keys(TABLE_EN).sort());
	});
	it("placeholder jawaban = ajakan F-C12; t() mengganti variabel", () => {
		expect(t("id", "popup.answerPlaceholder")).toBe("Tulis 1 kalimat: kenapa ini menarik buatmu?");
		expect(t("id", "popup.limitWarn", { n: 5 })).toBe("Yakin? Kamu sudah menanam 5 benih hari ini.");
		expect(t("en", "popup.limitWarn", { n: 5 })).toContain("5 seeds");
	});
});

describe("manifest (NF-C1)", () => {
	const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
	it("MV3, izin seminimal mungkin, tanpa host_permissions/content_scripts/<all_urls>", () => {
		expect(m.manifest_version).toBe(3);
		expect([...m.permissions].sort()).toEqual(["activeTab", "contextMenus", "scripting", "storage"]);
		expect(m.host_permissions).toBeUndefined();
		expect(m.optional_host_permissions).toBeUndefined();
		expect(m.content_scripts).toBeUndefined();
		expect(JSON.stringify(m)).not.toContain("all_urls");
		expect(m.content_security_policy).toBeUndefined(); // CSP bawaan MV3 (tanpa inline script, tanpa eval)
	});
	it("pintasan bawaan Alt+Shift+S (F-C6)", () => {
		expect(m.commands["capture-selection"].suggested_key.default).toBe("Alt+Shift+S");
	});
	it("_locales id dan en punya semua pesan yang dipakai manifest", () => {
		for (const loc of ["en", "id"]) {
			const msgs = JSON.parse(readFileSync(new URL(`../_locales/${loc}/messages.json`, import.meta.url), "utf8"));
			for (const k of ["extName", "extDescription", "actionTitle", "cmdCapture"]) expect(msgs[k]?.message, `${loc}.${k}`).toBeTruthy();
		}
	});
});
