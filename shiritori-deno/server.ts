import { serveDir } from "@std/http/file-server";

/**
 * Small (contracted) kana are normalized to their base form only when
 * comparing the boundary characters between two words. The stored word
 * itself keeps its original spelling.
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

function isConnected(prevWord: string, nextWord: string): boolean {
  const prevLast = normalizeEdgeChar(prevWord.at(-1) ?? "");
  const nextFirst = normalizeEdgeChar(nextWord.at(0) ?? "");
  return prevLast === nextFirst;
}

function endsWithN(word: string): boolean {
  const last = word.at(-1);
  return last === "ん" || last === "ン";
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
  isGameOver: boolean;
  endReason: EndReason;
}

const state: GameState = {
  wordHistories: [],
  isGameOver: false,
  endReason: null,
};

function currentWord(): string | null {
  return state.wordHistories.at(-1) ?? null;
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

  // 2. 接続判定
  const prevWord = currentWord();
  if (prevWord && !isConnected(prevWord, nextWord)) {
    return json(publicState({ errorCode: "NOT_CONNECTED" }), 400);
  }

  // 3. 実在チェック（API 失敗時は fail-open で通過させる）
  const exists = await wordExists(nextWord);
  if (exists === false) {
    return json(publicState({ errorCode: "NOT_FOUND" }), 400);
  }

  // 4. 既出チェック → 終了
  if (state.wordHistories.includes(nextWord)) {
    state.isGameOver = true;
    state.endReason = "DUPLICATE";
    return json(publicState({ errorCode: "DUPLICATE" }));
  }

  // 5. 「ん」チェック → 終了
  if (endsWithN(nextWord)) {
    state.wordHistories.push(nextWord);
    state.isGameOver = true;
    state.endReason = "N_ENDING";
    return json(publicState({ errorCode: "N_ENDING" }));
  }

  // 6. 通過で履歴追加・更新
  state.wordHistories.push(nextWord);
  return json(publicState());
}

async function handlePostReset(): Promise<Response> {
  state.wordHistories = [];
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
