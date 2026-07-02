import { serveDir } from "@std/http/file-server";

/**
 * Small (contracted) kana are normalized to their base form only when
 * comparing the boundary characters between two words/readings.
 */
const SMALL_TO_LARGE: Record<string, string> = {
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
  "っ": "つ", "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ",
  "ァ": "ア", "ィ": "イ", "ゥ": "ウ", "ェ": "エ", "ォ": "オ",
  "ッ": "ツ", "ャ": "ヤ", "ュ": "ユ", "ョ": "ヨ", "ヮ": "ワ",
};

function normalizeEdgeChar(char: string): string {
  return SMALL_TO_LARGE[char] ?? char;
}

function isConnected(prevReading: string, nextReading: string): boolean {
  const prevLast = normalizeEdgeChar(prevReading.at(-1) ?? "");
  const nextFirst = normalizeEdgeChar(nextReading.at(0) ?? "");
  return prevLast === nextFirst;
}

function endsWithN(reading: string): boolean {
  const last = reading.at(-1);
  return last === "ん" || last === "ン";
}

/** Katakana row -> vowel (あ段/い段/う段/え段/お段), used to resolve "ー". */
const KANA_VOWEL: Record<string, string> = {
  "あ": "あ", "か": "あ", "さ": "あ", "た": "あ", "な": "あ", "は": "あ", "ま": "あ", "や": "あ", "ら": "あ", "わ": "あ",
  "が": "あ", "ざ": "あ", "だ": "あ", "ば": "あ", "ぱ": "あ",
  "い": "い", "き": "い", "し": "い", "ち": "い", "に": "い", "ひ": "い", "み": "い", "り": "い",
  "ぎ": "い", "じ": "い", "ぢ": "い", "び": "い", "ぴ": "い",
  "う": "う", "く": "う", "す": "う", "つ": "う", "ぬ": "う", "ふ": "う", "む": "う", "ゆ": "う", "る": "う",
  "ぐ": "う", "ず": "う", "づ": "う", "ぶ": "う", "ぷ": "う",
  "え": "え", "け": "え", "せ": "え", "て": "え", "ね": "え", "へ": "え", "め": "え", "れ": "え",
  "げ": "え", "ぜ": "え", "で": "え", "べ": "え", "ぺ": "え",
  "お": "お", "こ": "お", "そ": "お", "と": "お", "の": "お", "ほ": "お", "も": "お", "よ": "お", "ろ": "お", "を": "お",
  "ご": "お", "ぞ": "お", "ど": "お", "ぼ": "お", "ぽ": "お",
};

function katakanaToHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * Normalizes a kana reading for shiritori comparison:
 * - Katakana is folded to hiragana.
 * - Long vowel marks ("ー") are resolved to the vowel of the preceding kana
 *   (e.g. "タクシー" -> "たくしい"), since that's the sound actually used
 *   for the next word's connection in shiritori. Chained "ーー" resolves
 *   using the already-resolved previous vowel.
 * Small kana are left as-is here; boundary comparison opens them via
 * normalizeEdgeChar (isConnected/endsWithN).
 */
function normalizeKana(kana: string): string {
  const hira = katakanaToHiragana(kana);
  const result: string[] = [];
  for (const ch of hira) {
    if (ch === "ー") {
      const prev = result.at(-1);
      result.push((prev && KANA_VOWEL[prev]) || "ー");
    } else {
      result.push(ch);
    }
  }
  return result.join("");
}

interface YahooFuriganaWord {
  surface: string;
  furigana?: string;
  roman?: string;
}

interface YahooFuriganaResponse {
  id?: string;
  jsonrpc?: string;
  result?: { word: YahooFuriganaWord[] };
  error?: { code: number; message: string };
}

/**
 * Fetches the kana reading of `word` via Yahoo! JAPAN's Furigana API (V2).
 * Returns null when the API can't be used (no APP_ID, network error,
 * timeout, non-OK response, or an unexpected response shape) so callers
 * can fall back to the raw surface form instead of blocking gameplay.
 */
async function getReading(word: string): Promise<string | null> {
  const appId = Deno.env.get("YAHOO_APP_ID");
  if (!appId) return null;

  try {
    const res = await fetch("https://jlp.yahooapis.jp/FuriganaService/V2/furigana", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `Yahoo AppID: ${appId}`,
      },
      body: JSON.stringify({
        id: "1",
        jsonrpc: "2.0",
        method: "jlp.furiganaservice.furigana",
        params: { q: word, grade: 1 },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data: YahooFuriganaResponse = await res.json();
    const words = data.result?.word;
    if (!words || words.length === 0) return null;

    return normalizeKana(words.map((w) => w.furigana ?? w.surface).join(""));
  } catch {
    return null;
  }
}

/**
 * Returns true/false when Wikipedia confirms/denies the word exists, or
 * null when the check could not be performed (network error, timeout,
 * non-OK response). Callers treat null as "allow" (fail-open) so a
 * flaky API call never blocks gameplay.
 */
async function wordExists(word: string): Promise<boolean | null> {
  try {
    const url = new URL("https://ja.wikipedia.org/w/api.php");
    url.searchParams.set("action", "opensearch");
    url.searchParams.set("search", word);
    url.searchParams.set("limit", "5");
    url.searchParams.set("namespace", "0");
    url.searchParams.set("format", "json");

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    const titles: string[] = data[1] ?? [];
    return titles.includes(word);
  } catch {
    return null;
  }
}

type EndReason = "DUPLICATE" | "N_ENDING" | null;

interface GameState {
  wordHistories: string[];
  /** Kana reading for each entry in wordHistories, same index. */
  readingHistories: string[];
  isGameOver: boolean;
  endReason: EndReason;
}

const state: GameState = {
  wordHistories: [],
  readingHistories: [],
  isGameOver: false,
  endReason: null,
};

function currentWord(): string | null {
  return state.wordHistories.at(-1) ?? null;
}

function currentReading(): string | null {
  return state.readingHistories.at(-1) ?? null;
}

function publicState(extra: { errorCode?: string } = {}) {
  return {
    currentWord: currentWord(),
    history: state.wordHistories,
    isGameOver: state.isGameOver,
    endReason: state.endReason,
    errorCode: extra.errorCode ?? null,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleGetShiritori(): Promise<Response> {
  return json(publicState());
}

async function handlePostShiritori(req: Request): Promise<Response> {
  if (state.isGameOver) {
    return json(publicState({ errorCode: "GAME_OVER" }), 409);
  }

  let body: { nextWord?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(publicState({ errorCode: "INVALID_BODY" }), 400);
  }

  const nextWord = typeof body.nextWord === "string" ? body.nextWord.trim() : "";

  // 1. 入力が空でないか
  if (!nextWord) {
    return json(publicState({ errorCode: "EMPTY" }), 400);
  }

  // 2. 読みを取得。Yahoo APIが使えない場合は表記そのものにフォールバックする
  //    （フォールバック時は従来どおり表記の末尾・先頭で接続判定される）。
  const nextReading = (await getReading(nextWord)) ?? nextWord;

  // 3. 接続判定（読みベース。長音「ー」等はnormalizeKanaで正規化済み）
  const prevReading = currentReading();
  if (prevReading && !isConnected(prevReading, nextReading)) {
    return json(publicState({ errorCode: "NOT_CONNECTED" }), 400);
  }

  // 4. 実在チェック（表記ベース。API 失敗時は fail-open で通過させる）
  const exists = await wordExists(nextWord);
  if (exists === false) {
    return json(publicState({ errorCode: "NOT_FOUND" }), 400);
  }

  // 5. 既出チェック → 終了（表記ベース。同じ読みでも別表記なら既出扱いしない）
  if (state.wordHistories.includes(nextWord)) {
    state.isGameOver = true;
    state.endReason = "DUPLICATE";
    return json(publicState({ errorCode: "DUPLICATE" }));
  }

  // 6. 「ん」チェック → 終了（読みベース。表記が漢字でも読みが「ん」で終われば終了）
  if (endsWithN(nextReading)) {
    state.wordHistories.push(nextWord);
    state.readingHistories.push(nextReading);
    state.isGameOver = true;
    state.endReason = "N_ENDING";
    return json(publicState({ errorCode: "N_ENDING" }));
  }

  // 7. 通過で履歴追加・更新
  state.wordHistories.push(nextWord);
  state.readingHistories.push(nextReading);
  return json(publicState());
}

async function handlePostReset(): Promise<Response> {
  state.wordHistories = [];
  state.readingHistories = [];
  state.isGameOver = false;
  state.endReason = null;
  return json(publicState());
}

Deno.serve((req: Request) => {
  const { pathname } = new URL(req.url);

  if (pathname === "/shiritori" && req.method === "GET") {
    return handleGetShiritori();
  }
  if (pathname === "/shiritori" && req.method === "POST") {
    return handlePostShiritori(req);
  }
  if (pathname === "/reset" && req.method === "POST") {
    return handlePostReset();
  }

  return serveDir(req, { fsRoot: "public" });
});
