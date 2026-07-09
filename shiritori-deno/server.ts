import { serveDir } from "@std/http/file-server";

/** Word list for 語彙力診断モード, keyed by leading hiragana character. */
let vocabWords: Record<string, string[]> = {};

/**
 * Loads data/words.json once at startup. On failure, logs the error and
 * leaves vocabWords empty so CPU-vocabulary features degrade gracefully
 * (pickCpuWord will simply find no candidates) instead of crashing the server.
 */
async function loadVocabWords(): Promise<void> {
  try {
    const url = new URL("./data/words.json", import.meta.url);
    const text = await Deno.readTextFile(url);
    vocabWords = JSON.parse(text);
    const total = Object.values(vocabWords).reduce((sum, words) => sum + words.length, 0);
    console.log(`[vocab] loaded ${total} words across ${Object.keys(vocabWords).length} keys from data/words.json`);
  } catch (err) {
    console.error("[vocab] failed to load data/words.json; 語彙力診断モード will have no CPU candidates:", err);
    vocabWords = {};
  }
}

await loadVocabWords();

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
  if (!appId) {
    console.error("[getReading] YAHOO_APP_ID is not set; falling back to surface form");
    return null;
  }

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
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error(`[getReading] Yahoo API returned ${res.status} ${res.statusText} for "${word}": ${bodyText}`);
      return null;
    }

    const data: YahooFuriganaResponse = await res.json();
    if (data.error) {
      console.error(`[getReading] Yahoo API error for "${word}": ${data.error.code} ${data.error.message}`);
      return null;
    }
    const words = data.result?.word;
    if (!words || words.length === 0) {
      console.error(`[getReading] Yahoo API returned no words for "${word}"`);
      return null;
    }

    return normalizeKana(words.map((w) => w.furigana ?? w.surface).join(""));
  } catch (err) {
    console.error(`[getReading] fetch failed for "${word}":`, err);
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

interface JishoJapaneseEntry {
  word?: string;
  reading?: string;
}

interface JishoDataEntry {
  japanese?: JishoJapaneseEntry[];
}

interface JishoResponse {
  data?: JishoDataEntry[];
}

/**
 * Checks whether `word` is a real Japanese word via Jisho's public
 * dictionary API (JMdict-backed). Jisho's search itself does loose
 * substring/fuzzy matching (e.g. searching a nonsense string can return
 * unrelated entries that merely share a prefix), so this requires an EXACT
 * match against a returned entry's headword or reading rather than treating
 * "got any results" as existence.
 *
 * Jisho stores the reading of loanwords/proper nouns (e.g. country names)
 * in katakana (e.g. "エジプト"), so a hiragana entry's reading is compared
 * against `normalizedReading` (the already katakana->hiragana normalized
 * reading of the player's input, from getReading+normalizeKana) rather than
 * against `word` directly - this lets hiragana, katakana, and kanji input
 * all match the same dictionary entry. Returns null when the check could
 * not be performed (network error, timeout, non-OK response).
 */
async function wordExistsInDictionary(
  word: string,
  normalizedReading: string,
): Promise<boolean | null> {
  try {
    const url = new URL("https://jisho.org/api/v1/search/words");
    url.searchParams.set("keyword", word);

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data: JishoResponse = await res.json();
    const entries = data.data ?? [];
    return entries.some((entry) =>
      (entry.japanese ?? []).some((j) =>
        j.word === word ||
        j.reading === word ||
        (j.reading != null && normalizeKana(j.reading) === normalizedReading)
      )
    );
  } catch {
    return null;
  }
}

/**
 * Combines the dictionary (Jisho) and encyclopedia (Wikipedia) existence
 * checks used by both game modes: a hiragana-only common noun very often has
 * no hiragana-titled Wikipedia article (wordExists alone rejects it), and a
 * country/proper-noun name typed in hiragana or kanji won't exact-match its
 * katakana-titled Wikipedia article either, while Jisho covers common
 * dictionary words but not everything Wikipedia might (proper nouns, newer
 * terms). A word is accepted if EITHER source confirms it, and rejected only
 * when BOTH definitively say it doesn't exist; anything less conclusive
 * (timeouts, errors) fails open.
 */
async function checkWordExists(word: string, normalizedReading: string): Promise<boolean | null> {
  const dictResult = await wordExistsInDictionary(word, normalizedReading);
  if (dictResult === true) return true;

  const wikiResult = await wordExists(word);
  if (wikiResult === true) return true;

  if (dictResult === false && wikiResult === false) return false;
  return null;
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

// ---- 語彙力診断モード ----

interface VocabGameState {
  wordHistories: string[];
  /** Kana reading for each entry in wordHistories, same index. */
  readingHistories: string[];
  isGameOver: boolean;
  winner: "player" | "cpu" | null;
  currentTurn: "player" | "cpu";
  turnStartedAt: number | null;
  score: number;
  turnCount: number;
}

type VocabErrorCode =
  | "VOCAB_NOT_CONNECTED"
  | "VOCAB_NOT_REAL_WORD"
  | "VOCAB_TOO_SHORT"
  | "VOCAB_ALREADY_USED"
  | "VOCAB_ENDS_WITH_N"
  | "VOCAB_TIMEOUT";

interface VocabPlayerRequest {
  nextWord: string;
  elapsedSeconds: number;
  isTimeout: boolean;
}

interface VocabPlayerResponse {
  cpuWord: string | null;
  wordHistories: string[];
  isGameOver: boolean;
  winner: "player" | "cpu" | null;
  isCpuLose: boolean;
  errorCode?: VocabErrorCode | null;
  finalScore?: number;
  turnCount?: number;
}

function freshVocabState(): VocabGameState {
  return {
    wordHistories: [],
    readingHistories: [],
    isGameOver: false,
    winner: null,
    currentTurn: "cpu",
    turnStartedAt: null,
    score: 0,
    turnCount: 0,
  };
}

let vocabState: VocabGameState = freshVocabState();

/**
 * Maps 濁音/半濁音 kana to their 清音 (plain) equivalent. Used as a fallback CPU
 * word source when a voiced key has no candidates: ぢ and づ never have real
 * Japanese words (modern kana usage confines them to mid-word rendaku, e.g.
 * 「はなぢ」「つづく」, so no word actually starts with them), and other voiced
 * keys are sparse enough to run dry during a long game. Falling back to the
 * plain-kana pool (ぢ→ち, づ→つ, etc.) keeps the CPU able to respond instead of
 * forfeiting on a technicality.
 */
const DAKUTEN_TO_SEION: Record<string, string> = {
  "が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ",
  "ざ": "さ", "じ": "し", "ず": "す", "ぜ": "せ", "ぞ": "そ",
  "だ": "た", "ぢ": "ち", "づ": "つ", "で": "て", "ど": "と",
  "ば": "は", "び": "ひ", "ぶ": "ふ", "べ": "へ", "ぼ": "ほ",
  "ぱ": "は", "ぴ": "ひ", "ぷ": "ふ", "ぺ": "へ", "ぽ": "ほ",
};

function candidatesFor(key: string, usedWords: string[]): string[] {
  return (vocabWords[key] ?? []).filter((w) => !usedWords.includes(w));
}

/**
 * True when `word` is one of our curated hiragana vocabulary entries. Used to
 * skip the Wikipedia existence check for words we already know are real:
 * Wikipedia's opensearch matches article titles exactly, and most common
 * hiragana-only nouns have no hiragana-titled article or redirect (e.g.
 * "びょういん" has zero results even though 病院 is real), so relying on it
 * alone rejects a lot of legitimate answers in a game whose CPU speaks
 * entirely in hiragana.
 */
function isKnownVocabWord(word: string): boolean {
  return Object.values(vocabWords).some((words) => words.includes(word));
}

/**
 * Picks a random CPU word starting with `lastChar` that hasn't been used yet.
 * Falls back to the 清音 (plain) equivalent key when `lastChar` is a voiced
 * kana with no remaining candidates (see DAKUTEN_TO_SEION). Returns null only
 * when both the exact key and its fallback have no candidates (CPU loses).
 */
function pickCpuWord(lastChar: string, usedWords: string[]): string | null {
  const candidates = candidatesFor(lastChar, usedWords);
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const seion = DAKUTEN_TO_SEION[lastChar];
  if (seion) {
    const seionCandidates = candidatesFor(seion, usedWords);
    if (seionCandidates.length > 0) {
      return seionCandidates[Math.floor(Math.random() * seionCandidates.length)];
    }
  }

  return null;
}

/** Picks a uniformly random word across the entire vocabulary, or null if empty. */
function pickRandomWord(): string | null {
  const allWords = Object.values(vocabWords).flat();
  if (allWords.length === 0) return null;
  return allWords[Math.floor(Math.random() * allWords.length)];
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

  // 3. 文字数チェック（表記の文字数ではなく、ひらがな読みが1文字の単語を禁止する。
  //    例えば「犬」は表記1文字だが読み「いぬ」は2文字なので通過する。
  //    「血」→「ち」のような単漢字読みへの逃げを防ぐのが目的）
  if (nextReading.length < 2) {
    return json(publicState({ errorCode: "TOO_SHORT" }), 400);
  }

  // 4. 接続判定（読みベース。長音「ー」等はnormalizeKanaで正規化済み）
  const prevReading = currentReading();
  if (prevReading && !isConnected(prevReading, nextReading)) {
    return json(publicState({ errorCode: "NOT_CONNECTED" }), 400);
  }

  // 5. 実在チェック（ひらがな・カタカナ・漢字のどの表記で入力されても同じ語
  //    として判定できるよう、正規化した読みも併用して辞書とWikipediaの両方
  //    を確認する。API 失敗時は fail-open で通過させる）
  const normalizedNextReading = normalizeKana(nextReading);
  const exists = await checkWordExists(nextWord, normalizedNextReading);
  if (exists === false) {
    return json(publicState({ errorCode: "NOT_FOUND" }), 400);
  }

  // 6. 既出チェック → 終了（表記ベース。同じ読みでも別表記なら既出扱いしない）
  if (state.wordHistories.includes(nextWord)) {
    state.isGameOver = true;
    state.endReason = "DUPLICATE";
    return json(publicState({ errorCode: "DUPLICATE" }));
  }

  // 7. 「ん」チェック → 終了（読みベース。表記が漢字でも読みが「ん」で終われば終了）
  if (endsWithN(nextReading)) {
    state.wordHistories.push(nextWord);
    state.readingHistories.push(nextReading);
    state.isGameOver = true;
    state.endReason = "N_ENDING";
    return json(publicState({ errorCode: "N_ENDING" }));
  }

  // 8. 通過で履歴追加・更新
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

// ---- 語彙力診断モード エンドポイント ----

function vocabPublicState(extra: { errorCode?: string } = {}) {
  return {
    currentWord: vocabState.wordHistories.at(-1) ?? null,
    wordHistories: vocabState.wordHistories,
    isGameOver: vocabState.isGameOver,
    winner: vocabState.winner,
    currentTurn: vocabState.currentTurn,
    errorCode: extra.errorCode ?? null,
  };
}

async function handleGetVocab(): Promise<Response> {
  return json(vocabPublicState());
}

async function handlePostVocabStart(): Promise<Response> {
  vocabState = freshVocabState();

  const cpuWord = pickRandomWord();
  if (cpuWord === null) {
    // words.json が読み込めなかった場合などの防御的フォールバック。
    vocabState.isGameOver = true;
    vocabState.winner = "player";
    const response: VocabPlayerResponse = {
      cpuWord: null,
      wordHistories: vocabState.wordHistories,
      isGameOver: true,
      winner: "player",
      isCpuLose: true,
    };
    return json(response);
  }

  vocabState.wordHistories.push(cpuWord);
  vocabState.readingHistories.push(cpuWord); // 語彙リストの単語はひらがな表記なので読み取得は不要
  vocabState.currentTurn = "player";
  vocabState.turnStartedAt = Date.now();

  const response: VocabPlayerResponse = {
    cpuWord,
    wordHistories: vocabState.wordHistories,
    isGameOver: false,
    winner: null,
    isCpuLose: false,
  };
  return json(response);
}

const VOCAB_BASE_SCORE = 100;

function computeTurnScore(elapsedSeconds: number): number {
  const clamped = Math.max(0, elapsedSeconds);
  const timeBonus = Math.max(0, Math.floor((10 - clamped) * 10));
  return VOCAB_BASE_SCORE + timeBonus;
}

async function handlePostVocabPlayer(req: Request): Promise<Response> {
  if (vocabState.isGameOver) {
    return json({ errorCode: null, errorMessage: "ゲームはすでに終了しています。リセットしてください。" }, 409);
  }

  let body: Partial<VocabPlayerRequest>;
  try {
    body = await req.json();
  } catch {
    return json({ errorCode: "VOCAB_NOT_REAL_WORD", errorMessage: "通信エラーが発生しました。" }, 400);
  }

  // 1. タイムアウト → プレイヤーの負け
  if (body.isTimeout === true) {
    vocabState.isGameOver = true;
    vocabState.winner = "cpu";
    const response: VocabPlayerResponse = {
      cpuWord: null,
      wordHistories: vocabState.wordHistories,
      isGameOver: true,
      winner: "cpu",
      isCpuLose: false,
      errorCode: "VOCAB_TIMEOUT",
      finalScore: vocabState.score,
      turnCount: vocabState.turnCount,
    };
    return json(response);
  }

  const nextWord = typeof body.nextWord === "string" ? body.nextWord.trim() : "";

  // 2. 入力が空でないか
  if (!nextWord) {
    return json({ errorCode: "VOCAB_NOT_REAL_WORD", errorMessage: "単語を入力してください。" }, 400);
  }

  // 3. 接続判定（読みベース。API失敗時は表記そのものにフォールバック）
  const nextReading = (await getReading(nextWord)) ?? nextWord;

  // 3.5 文字数チェック（表記の文字数ではなく、ひらがな読みが1文字の単語を禁止する。
  //    例えば「犬」は表記1文字だが読み「いぬ」は2文字なので通過する。
  //    「血」→「ち」のような単漢字読みへの逃げを防ぎ、語彙力診断としての意味を保つため）
  if (nextReading.length < 2) {
    return json({
      errorCode: "VOCAB_TOO_SHORT",
      errorMessage: "読みがひらがな1文字の単語は使えません。ひらがなで2文字以上の単語を入力してください。",
    }, 400);
  }

  const prevReading = vocabState.readingHistories.at(-1) ?? null;
  if (prevReading && !isConnected(prevReading, nextReading)) {
    return json({
      errorCode: "VOCAB_NOT_CONNECTED",
      errorMessage: "前の単語に続いていません。",
    }, 400);
  }

  // 4. 実在チェック（ひらがな・カタカナ・漢字のどの表記で入力されても
  //    同じ語として判定できるよう、正規化した読みも併用する。
  //    自前の単語データベースにあれば即通過。無ければ辞書(Jisho)と
  //    Wikipediaの両方で確認し、どちらも「存在しない」と判定した場合の
  //    み却下する。API失敗時はfail-openで通過）
  const normalizedNextReading = normalizeKana(nextReading);
  if (!isKnownVocabWord(nextWord) && !isKnownVocabWord(normalizedNextReading)) {
    const exists = await checkWordExists(nextWord, normalizedNextReading);
    if (exists === false) {
      return json({
        errorCode: "VOCAB_NOT_REAL_WORD",
        errorMessage: "実在する単語として見つかりませんでした。",
      }, 400);
    }
  }

  // 5. 既出チェック → プレイヤーの負け
  if (vocabState.wordHistories.includes(nextWord)) {
    vocabState.isGameOver = true;
    vocabState.winner = "cpu";
    const response: VocabPlayerResponse = {
      cpuWord: null,
      wordHistories: vocabState.wordHistories,
      isGameOver: true,
      winner: "cpu",
      isCpuLose: false,
      errorCode: "VOCAB_ALREADY_USED",
      finalScore: vocabState.score,
      turnCount: vocabState.turnCount,
    };
    return json(response);
  }

  // 6. 「ん」チェック → プレイヤーの負け
  if (endsWithN(nextReading)) {
    vocabState.wordHistories.push(nextWord);
    vocabState.readingHistories.push(nextReading);
    vocabState.isGameOver = true;
    vocabState.winner = "cpu";
    const response: VocabPlayerResponse = {
      cpuWord: null,
      wordHistories: vocabState.wordHistories,
      isGameOver: true,
      winner: "cpu",
      isCpuLose: false,
      errorCode: "VOCAB_ENDS_WITH_N",
      finalScore: vocabState.score,
      turnCount: vocabState.turnCount,
    };
    return json(response);
  }

  // 7. 全通過 → 履歴追加・スコア加算
  vocabState.wordHistories.push(nextWord);
  vocabState.readingHistories.push(nextReading);

  const elapsedSeconds = typeof body.elapsedSeconds === "number" ? body.elapsedSeconds : 10;
  vocabState.score += computeTurnScore(elapsedSeconds);
  vocabState.turnCount += 1;

  // 8. CPUの単語選択
  const lastChar = normalizeEdgeChar(nextReading.at(-1) ?? "");
  const cpuWord = pickCpuWord(lastChar, vocabState.wordHistories);

  if (cpuWord === null) {
    vocabState.isGameOver = true;
    vocabState.winner = "player";
    const response: VocabPlayerResponse = {
      cpuWord: null,
      wordHistories: vocabState.wordHistories,
      isGameOver: true,
      winner: "player",
      isCpuLose: true,
      errorCode: null,
      finalScore: vocabState.score,
      turnCount: vocabState.turnCount,
    };
    return json(response);
  }

  vocabState.wordHistories.push(cpuWord);
  vocabState.readingHistories.push(cpuWord);
  vocabState.turnStartedAt = Date.now();

  const response: VocabPlayerResponse = {
    cpuWord,
    wordHistories: vocabState.wordHistories,
    isGameOver: false,
    winner: null,
    isCpuLose: false,
    errorCode: null,
  };
  return json(response);
}

async function handlePostVocabReset(): Promise<Response> {
  vocabState = freshVocabState();
  return json(vocabPublicState());
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
  if (pathname === "/vocab" && req.method === "GET") {
    return handleGetVocab();
  }
  if (pathname === "/vocab/start" && req.method === "POST") {
    return handlePostVocabStart();
  }
  if (pathname === "/vocab/player" && req.method === "POST") {
    return handlePostVocabPlayer(req);
  }
  if (pathname === "/vocab/reset" && req.method === "POST") {
    return handlePostVocabReset();
  }

  return serveDir(req, { fsRoot: "public" });
});
