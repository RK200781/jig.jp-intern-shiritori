// モードの定義。新しいモードを追加する場合はここに要素を足すだけでよい。
const MODES = [
  {
    id: "normal",
    name: "通常モード",
    description:
      "基本のしりとりルールで遊びます。前の単語の最後の文字から始まる単語を入力してください。" +
      "「ん」で終わる単語を入力するとゲーム終了、すでに使った単語を入力してもゲーム終了です。" +
      "入力された単語は辞書・Wikipedia で実在するかどうかをチェックします。" +
      "読みがひらがなで1文字だけの単語は使えません（表記の文字数ではなく読みで判定するので、" +
      "「犬」は表記が1文字でも読みが「いぬ」で2文字あるためOK、「血」は読みが「ち」で1文字のためNGです）。",
  },
  {
    id: "vocab",
    name: "CPU対戦",
    description:
      "CPUと対戦して語彙力を診断しよう！\n" +
      "CPUが出した単語に10秒以内に続く単語を答えてね。\n" +
      "時間切れ・「ん」で終わる単語・同じ単語を使うと負け。\n" +
      "読みがひらがなで1文字だけの単語は使えないよ（例:「犬」は読みが「いぬ」で2文字なのでOK、" +
      "「血」は読みが「ち」で1文字なのでNG）。\n" +
      "返答が速いほどスコアが高くなるよ！",
  },
  {
    id: "timeattack",
    name: "タイムアタック",
    description:
      "1人で3分間、ひたすら単語をつなげ続けよう！\n" +
      "時間切れになったら正常終了（そこまでのスコアが記録されるよ）。\n" +
      "「ん」で終わる単語・同じ単語を使うとその時点でゲーム終了。\n" +
      "実在しない単語はエラー表示だけで、そのまま続けられるよ。\n" +
      "読みがひらがなで1文字だけの単語は使えないよ（例:「犬」は読みが「いぬ」で2文字なのでOK、" +
      "「血」は読みが「ち」で1文字なのでNG）。\n" +
      "返答が速いほどスコアが高くなるよ！",
  },
  {
    id: "shibari",
    name: "食べ物縛り",
    description:
      "通常モードのしりとりに「食べ物・飲み物の単語しか使えない」縛りを加えたモードです。" +
      "食べ物・飲み物以外の単語を入力するとエラー表示になりますが、ゲームは終了せず続行できます。" +
      "それ以外のルール（接続判定・「ん」で終了・既出で終了・実在チェック）は通常モードと同じです。" +
      "読みがひらがなで1文字だけの単語は使えません（「犬」は読みが「いぬ」で2文字なのでOK、" +
      "「血」は読みが「ち」で1文字なのでNGです）。",
  },
  {
    id: "memory",
    name: "しりとり×暗記",
    description:
      "直前の単語も履歴も画面には表示されません。自分がこれまでにつないできた単語を" +
      "頭の中で覚えておいて、毎回「最初の単語 → ... → 今までの単語 → 新しい単語」を" +
      "頭から全部スペース区切りで入力してください。\n" +
      "例: 1週目は「りんご」、2週目は「りんご ごりら」、3週目は「りんご ごりら らっぱ」" +
      "というように、新しい単語を追加するたびに全部打ち直します。\n" +
      "順番を間違えたり単語が抜けているとエラーになりますが、ゲームは終了しません。\n" +
      "「ん」で終わる単語・すでに使った単語を追加するとその時点でゲーム終了で、" +
      "終了時にはじめて全履歴が表示されます。\n" +
      "接続判定・実在チェック・1文字禁止ルールは通常モードと同じです。",
  },
];

const MODE_ICONS = {
  normal: "🔤",
  vocab: "🤖",
  timeattack: "⏱️",
  shibari: "🍙",
  memory: "🧠",
};

const ERROR_MESSAGES = {
  EMPTY: "単語を入力してください。",
  TOO_SHORT: "読みがひらがな1文字の単語は使えません。ひらがなで2文字以上の単語を入力してください。",
  NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  NOT_FOUND: "実在する単語として見つかりませんでした。別の単語を試してください。",
  NOT_FOOD: "食べ物・飲み物の単語ではありません。別の単語を試してください。",
  DUPLICATE: "すでに使われた単語です。ゲーム終了です。",
  N_ENDING: "「ん」で終わる単語です。ゲーム終了です。",
  GAME_OVER: "ゲームはすでに終了しています。リセットしてください。",
  INVALID_BODY: "通信エラーが発生しました。",
};

let currentMode = null;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function renderModeList() {
  const container = document.getElementById("mode-list");
  container.innerHTML = "";
  for (const mode of MODES) {
    const btn = document.createElement("button");
    btn.className = "mode-card";
    btn.type = "button";

    const icon = document.createElement("span");
    icon.className = "mode-card-icon";
    icon.textContent = MODE_ICONS[mode.id] ?? "🎮";

    const name = document.createElement("span");
    name.className = "mode-card-name";
    name.textContent = mode.name;

    btn.append(icon, name);
    btn.addEventListener("click", () => selectMode(mode));
    container.appendChild(btn);
  }
}

function selectMode(mode) {
  currentMode = mode;
  document.getElementById("mode-title").textContent = `${MODE_ICONS[mode.id] ?? ""} ${mode.name}`;
  document.getElementById("mode-description").textContent = mode.description;
  showScreen("screen-mode-description");
}

async function fetchJson(url, options) {
  try {
    const res = await fetch(url, options);
    return await res.json();
  } catch (err) {
    console.error(`通信に失敗しました (${url}):`, err);
    return { errorCode: "INVALID_BODY", isGameOver: false, history: [], currentWord: null, endReason: null };
  }
}

function renderState(data) {
  document.getElementById("current-word").textContent = data.currentWord ?? "（最初の単語を入力してください）";

  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";
  for (const word of data.history) {
    const li = document.createElement("li");
    li.textContent = word;
    historyList.appendChild(li);
  }

  const errorEl = document.getElementById("error-message");
  if (data.errorCode && data.errorCode !== "DUPLICATE" && data.errorCode !== "N_ENDING") {
    errorEl.textContent = ERROR_MESSAGES[data.errorCode] ?? "入力エラーです。";
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  const banner = document.getElementById("game-over-banner");
  const input = document.getElementById("word-input");
  const submitBtn = document.querySelector('#word-form button[type="submit"]');
  if (data.isGameOver) {
    banner.textContent =
      data.endReason === "N_ENDING"
        ? ERROR_MESSAGES.N_ENDING
        : data.endReason === "DUPLICATE"
        ? ERROR_MESSAGES.DUPLICATE
        : "ゲーム終了です。";
    banner.classList.remove("hidden", "banner-success");
    banner.classList.add("banner-danger");
    input.disabled = true;
    submitBtn.disabled = true;
  } else {
    banner.classList.add("hidden");
    input.disabled = false;
    submitBtn.disabled = false;
  }
}

async function loadState() {
  const data = await fetchJson("/shiritori");
  renderState(data);
}

async function submitWord(word) {
  const data = await fetchJson("/shiritori", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nextWord: word }),
  });
  renderState(data);
}

async function resetGame() {
  const data = await fetchJson("/reset", { method: "POST" });
  renderState(data);
}

// ---- 食べ物縛り ----
// 通常モードとルール・レスポンス形状が同じため、renderState/submitWord/resetGame と
// 同じ構造の関数を shibari-* 要素向けに用意している。

function renderShibariState(data) {
  document.getElementById("shibari-current-word").textContent = data.currentWord ?? "（最初の単語を入力してください）";

  const historyList = document.getElementById("shibari-history-list");
  historyList.innerHTML = "";
  for (const word of data.history) {
    const li = document.createElement("li");
    li.textContent = word;
    historyList.appendChild(li);
  }

  const errorEl = document.getElementById("shibari-error-message");
  if (data.errorCode && data.errorCode !== "DUPLICATE" && data.errorCode !== "N_ENDING") {
    errorEl.textContent = ERROR_MESSAGES[data.errorCode] ?? "入力エラーです。";
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  const banner = document.getElementById("shibari-game-over-banner");
  const input = document.getElementById("shibari-word-input");
  const submitBtn = document.querySelector('#shibari-word-form button[type="submit"]');
  if (data.isGameOver) {
    banner.textContent =
      data.endReason === "N_ENDING"
        ? ERROR_MESSAGES.N_ENDING
        : data.endReason === "DUPLICATE"
        ? ERROR_MESSAGES.DUPLICATE
        : "ゲーム終了です。";
    banner.classList.remove("hidden", "banner-success");
    banner.classList.add("banner-danger");
    input.disabled = true;
    submitBtn.disabled = true;
  } else {
    banner.classList.add("hidden");
    input.disabled = false;
    submitBtn.disabled = false;
  }
}

async function resetShibariGame() {
  const data = await fetchJson("/shibari/reset", { method: "POST" });
  renderShibariState(data);
}

async function submitShibariWord(word) {
  const data = await fetchJson("/shibari", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nextWord: word }),
  });
  renderShibariState(data);
}

// ---- しりとり×暗記 ----
// 直前の単語・履歴はプレイ中は表示しない。プレイヤーは毎回、これまでの単語を
// 全部スペース区切りで入力し直す（例:「りんご ごりら らっぱ」）。

const MEMORY_CONTINUE_ERROR_MESSAGES = {
  MEMORY_EMPTY: "単語を入力してください。",
  MEMORY_TOO_SHORT: "読みがひらがな1文字の単語は使えません。ひらがなで2文字以上の単語を入力してください。",
  MEMORY_NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  MEMORY_NOT_FOUND: "実在する単語として見つかりませんでした。別の単語を試してください。",
};

const MEMORY_END_MESSAGES = {
  MEMORY_DUPLICATE: "すでに使われた単語でした。ゲーム終了です。",
  MEMORY_N_ENDING: "「ん」で終わる単語でした。ゲーム終了です。",
  MEMORY_COUNT_MISMATCH: "単語の数が合っていませんでした。ゲーム終了です。",
  MEMORY_SEQUENCE_MISMATCH: "これまでの単語の並びが違っていました。ゲーム終了です。",
};

function updateMemoryWordCountDisplay(wordCount) {
  document.getElementById("memory-word-count").textContent = String(wordCount + 1);
}

function showMemoryError(errorCode) {
  const errorEl = document.getElementById("memory-error-message");
  errorEl.textContent = MEMORY_CONTINUE_ERROR_MESSAGES[errorCode] ?? "入力エラーです。";
  errorEl.classList.remove("hidden");
}

function clearMemoryError() {
  document.getElementById("memory-error-message").classList.add("hidden");
}

function revealMemoryHistory(history) {
  const list = document.getElementById("memory-history-list");
  list.innerHTML = "";
  for (const word of history) {
    const li = document.createElement("li");
    li.textContent = word;
    list.appendChild(li);
  }
  document.getElementById("memory-reveal-title").classList.remove("hidden");
}

function showMemoryGameOver(data) {
  const input = document.getElementById("memory-word-input");
  const submitBtn = document.querySelector('#memory-word-form button[type="submit"]');
  input.disabled = true;
  submitBtn.disabled = true;

  const banner = document.getElementById("memory-game-over-banner");
  banner.textContent = MEMORY_END_MESSAGES[data.errorCode] ?? "ゲーム終了です。";
  banner.classList.remove("hidden");

  revealMemoryHistory(data.history ?? []);
}

function resetMemoryUi() {
  const input = document.getElementById("memory-word-input");
  input.value = "";
  input.disabled = false;
  document.querySelector('#memory-word-form button[type="submit"]').disabled = false;
  updateMemoryWordCountDisplay(0);
  clearMemoryError();
  document.getElementById("memory-game-over-banner").classList.add("hidden");
  document.getElementById("memory-reveal-title").classList.add("hidden");
  document.getElementById("memory-history-list").innerHTML = "";
}

async function resetMemoryGame() {
  await fetchJson("/memory/reset", { method: "POST" });
  resetMemoryUi();
}

async function submitMemoryInput(input) {
  const data = await fetchJson("/memory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });

  // 記憶をきちんと試すため、結果に関わらず入力欄は毎回空にする
  // （成功時にそのまま残すと、次のターンに読み返すだけで暗記の意味がなくなるため）。
  document.getElementById("memory-word-input").value = "";

  if (data.isGameOver) {
    showMemoryGameOver(data);
    return;
  }

  if (data.errorCode) {
    showMemoryError(data.errorCode);
  } else {
    clearMemoryError();
    updateMemoryWordCountDisplay(data.wordCount);
  }
  document.getElementById("memory-word-input").focus();
}

// ---- CPU対戦 ----

const VOCAB_CONTINUE_ERROR_MESSAGES = {
  VOCAB_NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  VOCAB_NOT_REAL_WORD: "実在する単語として見つかりませんでした。別の単語を試してください。",
  VOCAB_TOO_SHORT: "読みがひらがな1文字の単語は使えません。ひらがなで2文字以上の単語を入力してください。",
};

const VOCAB_END_MESSAGES = {
  VOCAB_TIMEOUT: "時間切れです。あなたの負けです。",
  VOCAB_ENDS_WITH_N: "「ん」で終わる単語でした。あなたの負けです。",
  VOCAB_ALREADY_USED: "すでに使われた単語でした。あなたの負けです。",
};

const VOCAB_TURN_SECONDS = 10;

let vocabScore = 0;
let vocabTurnCount = 0;
let vocabRemainingSeconds = VOCAB_TURN_SECONDS;
let vocabTimerHandle = null;

function vocabTurnScore(elapsedSeconds) {
  const timeBonus = Math.max(0, Math.floor((VOCAB_TURN_SECONDS - elapsedSeconds) * 10));
  return 100 + timeBonus;
}

function disableVocabInput(disabled) {
  document.getElementById("vocab-word-input").disabled = disabled;
  document.querySelector('#vocab-word-form button[type="submit"]').disabled = disabled;
}

function showVocabThinking(show) {
  document.getElementById("vocab-thinking").classList.toggle("hidden", !show);
}

function updateVocabScoreDisplay() {
  document.getElementById("vocab-score").textContent = String(vocabScore);
  document.getElementById("vocab-turn-count").textContent = String(vocabTurnCount);
}

function addVocabHistoryEntry(word, speaker, elapsedSeconds) {
  const list = document.getElementById("vocab-history-list");
  const li = document.createElement("li");
  li.classList.add(speaker === "cpu" ? "history-cpu" : "history-player");
  const label = speaker === "cpu" ? "CPU" : "あなた";
  li.textContent = elapsedSeconds != null
    ? `${label}: ${word}（${elapsedSeconds}秒）`
    : `${label}: ${word}`;
  list.appendChild(li);
}

function stopVocabTimer() {
  if (vocabTimerHandle !== null) {
    clearInterval(vocabTimerHandle);
    vocabTimerHandle = null;
  }
}

function updateVocabTimerDisplay() {
  const timerEl = document.getElementById("vocab-timer");
  document.getElementById("vocab-timer-seconds").textContent = String(vocabRemainingSeconds);
  timerEl.classList.toggle("timer-warning", vocabRemainingSeconds <= 3);
}

function startVocabTimer() {
  stopVocabTimer();
  vocabRemainingSeconds = VOCAB_TURN_SECONDS;
  document.getElementById("vocab-timer").classList.remove("hidden");
  updateVocabTimerDisplay();
  vocabTimerHandle = setInterval(() => {
    vocabRemainingSeconds -= 1;
    updateVocabTimerDisplay();
    if (vocabRemainingSeconds <= 0) {
      stopVocabTimer();
      submitVocabWord("", true);
    }
  }, 1000);
}

function resumeVocabTimer() {
  // 続行エラー（未接続・未実在）の場合は、残り時間を維持したまま再開する。
  stopVocabTimer();
  document.getElementById("vocab-timer").classList.remove("hidden");
  updateVocabTimerDisplay();
  vocabTimerHandle = setInterval(() => {
    vocabRemainingSeconds -= 1;
    updateVocabTimerDisplay();
    if (vocabRemainingSeconds <= 0) {
      stopVocabTimer();
      submitVocabWord("", true);
    }
  }, 1000);
}

function showVocabError(errorCode) {
  const errorEl = document.getElementById("vocab-error-message");
  errorEl.textContent = VOCAB_CONTINUE_ERROR_MESSAGES[errorCode] ?? "入力エラーです。";
  errorEl.classList.remove("hidden");
}

function clearVocabError() {
  document.getElementById("vocab-error-message").classList.add("hidden");
}

function showVocabGameOver(data) {
  document.getElementById("vocab-timer").classList.add("hidden");
  disableVocabInput(true);

  vocabScore = data.finalScore ?? vocabScore;
  vocabTurnCount = data.turnCount ?? vocabTurnCount;
  updateVocabScoreDisplay();

  const banner = document.getElementById("vocab-game-over-banner");
  banner.classList.remove("banner-success", "banner-danger");
  if (data.isCpuLose) {
    banner.textContent = "🎉 CPUの単語が尽きた！あなたの勝利！";
    banner.classList.add("banner-success");
  } else {
    banner.textContent = VOCAB_END_MESSAGES[data.errorCode] ?? "ゲーム終了です。";
    banner.classList.add("banner-danger");
  }
  banner.classList.remove("hidden");
}

function revealVocabTurn(data) {
  showVocabThinking(false);

  if (data.isGameOver) {
    // CPU側の単語が出せなかった等、CPU応答自体がゲーム終了を伴うケース。
    showVocabGameOver(data);
    return;
  }

  addVocabHistoryEntry(data.cpuWord, "cpu", null);
  document.getElementById("vocab-cpu-word").textContent = data.cpuWord;
  clearVocabError();
  disableVocabInput(false);
  document.getElementById("vocab-word-input").focus();
  startVocabTimer();
}

async function beginVocabTurn(requestFn) {
  showVocabThinking(true);
  disableVocabInput(true);
  document.getElementById("vocab-timer").classList.add("hidden");

  const data = await requestFn();
  const delay = 1000 + Math.random() * 1000;
  setTimeout(() => revealVocabTurn(data), delay);
}

function resetVocabUi() {
  vocabScore = 0;
  vocabTurnCount = 0;
  vocabRemainingSeconds = VOCAB_TURN_SECONDS;
  stopVocabTimer();
  updateVocabScoreDisplay();
  document.getElementById("vocab-history-list").innerHTML = "";
  document.getElementById("vocab-cpu-word").textContent = "-";
  document.getElementById("vocab-game-over-banner").classList.add("hidden");
  clearVocabError();
  document.getElementById("vocab-timer").classList.add("hidden");
  disableVocabInput(true);
}

async function startVocabGame() {
  resetVocabUi();
  await beginVocabTurn(() => fetchJson("/vocab/start", { method: "POST" }));
}

async function submitVocabWord(word, isTimeout) {
  stopVocabTimer();
  disableVocabInput(true);
  clearVocabError();

  const elapsedSeconds = VOCAB_TURN_SECONDS - vocabRemainingSeconds;
  const data = await fetchJson("/vocab/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nextWord: word, elapsedSeconds, isTimeout }),
  });

  if (data.isGameOver) {
    if (word && (data.errorCode === "VOCAB_ENDS_WITH_N" || !data.errorCode)) {
      addVocabHistoryEntry(word, "player", isTimeout ? null : elapsedSeconds);
    }
    showVocabGameOver(data);
    return;
  }

  if (data.errorCode) {
    showVocabError(data.errorCode);
    disableVocabInput(false);
    resumeVocabTimer();
    document.getElementById("vocab-word-input").focus();
    return;
  }

  // 通過。ローカルでもスコア・ターン数を加算して即時表示に反映する
  // （サーバーが返す finalScore/turnCount と同じ計算式でありゲーム終了時に確定値へ揃う）。
  vocabScore += vocabTurnScore(elapsedSeconds);
  vocabTurnCount += 1;
  updateVocabScoreDisplay();
  addVocabHistoryEntry(word, "player", elapsedSeconds);

  await beginVocabTurn(() => Promise.resolve(data));
}

// ---- タイムアタック ----

const TIMEATTACK_CONTINUE_ERROR_MESSAGES = {
  TIMEATTACK_EMPTY: "単語を入力してください。",
  TIMEATTACK_NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  TIMEATTACK_NOT_REAL_WORD: "実在する単語として見つかりませんでした。別の単語を試してください。",
  TIMEATTACK_TOO_SHORT: "読みがひらがな1文字の単語は使えません。ひらがなで2文字以上の単語を入力してください。",
};

const TIMEATTACK_END_MESSAGES = {
  DUPLICATE: "すでに使われた単語でした。ゲーム終了です。",
  N_ENDING: "「ん」で終わる単語でした。ゲーム終了です。",
};

const TIMEATTACK_DURATION_SECONDS = 180;
const TIMEATTACK_WARNING_SECONDS = 30;

let timeattackScore = 0;
let timeattackWordCount = 0;
let timeattackRemainingSeconds = TIMEATTACK_DURATION_SECONDS;
let timeattackTimerHandle = null;
let timeattackWordStartedAt = null;

function timeattackTurnScore(elapsedSeconds) {
  const timeBonus = Math.max(0, Math.floor((10 - elapsedSeconds) * 10));
  return 100 + timeBonus;
}

function formatTimeAttackClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function disableTimeAttackInput(disabled) {
  document.getElementById("timeattack-word-input").disabled = disabled;
  document.querySelector('#timeattack-word-form button[type="submit"]').disabled = disabled;
}

function updateTimeAttackScoreDisplay() {
  document.getElementById("timeattack-score").textContent = String(timeattackScore);
  document.getElementById("timeattack-word-count").textContent = String(timeattackWordCount);
}

function addTimeAttackHistoryEntry(word, elapsedSeconds) {
  const list = document.getElementById("timeattack-history-list");
  const li = document.createElement("li");
  li.textContent = elapsedSeconds != null ? `${word}（${elapsedSeconds}秒）` : word;
  list.appendChild(li);
}

function stopTimeAttackTimer() {
  if (timeattackTimerHandle !== null) {
    clearInterval(timeattackTimerHandle);
    timeattackTimerHandle = null;
  }
}

function updateTimeAttackTimerDisplay() {
  const timerEl = document.getElementById("timeattack-timer");
  timerEl.textContent = formatTimeAttackClock(timeattackRemainingSeconds);
  timerEl.classList.toggle("timer-warning", timeattackRemainingSeconds <= TIMEATTACK_WARNING_SECONDS);
}

function startTimeAttackTimer() {
  stopTimeAttackTimer();
  timeattackRemainingSeconds = TIMEATTACK_DURATION_SECONDS;
  updateTimeAttackTimerDisplay();
  timeattackTimerHandle = setInterval(() => {
    timeattackRemainingSeconds -= 1;
    updateTimeAttackTimerDisplay();
    if (timeattackRemainingSeconds <= 0) {
      stopTimeAttackTimer();
      submitTimeAttackWord("", true);
    }
  }, 1000);
}

function showTimeAttackError(errorCode) {
  const errorEl = document.getElementById("timeattack-error-message");
  errorEl.textContent = TIMEATTACK_CONTINUE_ERROR_MESSAGES[errorCode] ?? "入力エラーです。";
  errorEl.classList.remove("hidden");
}

function clearTimeAttackError() {
  document.getElementById("timeattack-error-message").classList.add("hidden");
}

function showTimeAttackGameOver(data) {
  stopTimeAttackTimer();
  disableTimeAttackInput(true);

  timeattackScore = data.score ?? timeattackScore;
  timeattackWordCount = data.wordCount ?? timeattackWordCount;
  updateTimeAttackScoreDisplay();

  const banner = document.getElementById("timeattack-game-over-banner");
  banner.classList.remove("banner-success", "banner-danger");
  if (data.endReason === "TIME_UP") {
    banner.textContent = `🎉 3分間走りきりました！お疲れ様でした！（スコア: ${timeattackScore} / 単語数: ${timeattackWordCount}）`;
    banner.classList.add("banner-success");
  } else {
    const reasonMessage = TIMEATTACK_END_MESSAGES[data.endReason] ?? "ゲーム終了です。";
    banner.textContent = `${reasonMessage}（スコア: ${timeattackScore} / 単語数: ${timeattackWordCount}）`;
    banner.classList.add("banner-danger");
  }
  banner.classList.remove("hidden");
}

function resetTimeAttackUi() {
  timeattackScore = 0;
  timeattackWordCount = 0;
  timeattackRemainingSeconds = TIMEATTACK_DURATION_SECONDS;
  stopTimeAttackTimer();
  updateTimeAttackScoreDisplay();
  updateTimeAttackTimerDisplay();
  document.getElementById("timeattack-history-list").innerHTML = "";
  document.getElementById("timeattack-current-word").textContent = "-";
  document.getElementById("timeattack-game-over-banner").classList.add("hidden");
  clearTimeAttackError();
  disableTimeAttackInput(false);
}

async function startTimeAttackGame() {
  resetTimeAttackUi();
  const data = await fetchJson("/timeattack/start", { method: "POST" });
  if (data.currentWord) {
    document.getElementById("timeattack-current-word").textContent = data.currentWord;
    addTimeAttackHistoryEntry(data.currentWord, null);
  }
  timeattackWordStartedAt = Date.now();
  startTimeAttackTimer();
  document.getElementById("timeattack-word-input").focus();
}

async function submitTimeAttackWord(word, isTimeout) {
  const elapsedSeconds = timeattackWordStartedAt != null
    ? Math.round((Date.now() - timeattackWordStartedAt) / 1000)
    : 0;

  disableTimeAttackInput(true);
  clearTimeAttackError();

  const data = await fetchJson("/timeattack/word", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nextWord: word, elapsedSeconds, isTimeout }),
  });

  if (data.isGameOver) {
    if (word && data.errorCode !== "TIMEATTACK_NOT_REAL_WORD") {
      addTimeAttackHistoryEntry(word, isTimeout ? null : elapsedSeconds);
    }
    showTimeAttackGameOver(data);
    return;
  }

  if (data.errorCode) {
    showTimeAttackError(data.errorCode);
    disableTimeAttackInput(false);
    document.getElementById("timeattack-word-input").focus();
    return;
  }

  // 通過。ローカルでもスコア・単語数を加算して即時表示に反映する
  // （サーバーが返す score/wordCount と同じ計算式でありゲーム終了時に確定値へ揃う）。
  timeattackScore += timeattackTurnScore(elapsedSeconds);
  timeattackWordCount += 1;
  updateTimeAttackScoreDisplay();
  addTimeAttackHistoryEntry(word, elapsedSeconds);
  document.getElementById("timeattack-current-word").textContent = word;

  timeattackWordStartedAt = Date.now();
  disableTimeAttackInput(false);
  document.getElementById("timeattack-word-input").focus();
}

// モード選択画面の表示は、通信やイベント配線より先に必ず実行する。
// 以降の処理が失敗しても、最初の画面が消えたままになることはない。
renderModeList();
showScreen("screen-mode-select");

try {
  document.getElementById("start-game-btn").addEventListener("click", async () => {
    if (currentMode.id === "vocab") {
      showScreen("screen-vocab-game");
      await startVocabGame();
    } else if (currentMode.id === "timeattack") {
      showScreen("screen-timeattack-game");
      await startTimeAttackGame();
    } else if (currentMode.id === "shibari") {
      await resetShibariGame();
      showScreen("screen-shibari-game");
    } else if (currentMode.id === "memory") {
      await resetMemoryGame();
      showScreen("screen-memory-game");
    } else {
      await resetGame();
      showScreen("screen-game");
    }
  });

  document.getElementById("back-to-select-btn").addEventListener("click", () => {
    showScreen("screen-mode-select");
  });

  document.getElementById("back-to-select-from-game-btn").addEventListener("click", () => {
    showScreen("screen-mode-select");
  });

  document.getElementById("word-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("word-input");
    const word = input.value.trim();
    if (!word) return;
    await submitWord(word);
    input.value = "";
    input.focus();
  });

  document.getElementById("reset-btn").addEventListener("click", async () => {
    await resetGame();
  });

  document.getElementById("vocab-back-to-select-btn").addEventListener("click", () => {
    stopVocabTimer();
    showScreen("screen-mode-select");
  });

  document.getElementById("vocab-word-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("vocab-word-input");
    const word = input.value.trim();
    if (!word) return;
    input.value = "";
    await submitVocabWord(word, false);
  });

  document.getElementById("vocab-reset-btn").addEventListener("click", async () => {
    await startVocabGame();
  });

  document.getElementById("timeattack-back-to-select-btn").addEventListener("click", () => {
    stopTimeAttackTimer();
    showScreen("screen-mode-select");
  });

  document.getElementById("timeattack-word-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("timeattack-word-input");
    const word = input.value.trim();
    if (!word) return;
    input.value = "";
    await submitTimeAttackWord(word, false);
  });

  document.getElementById("timeattack-reset-btn").addEventListener("click", async () => {
    await startTimeAttackGame();
  });

  document.getElementById("shibari-back-to-select-btn").addEventListener("click", () => {
    showScreen("screen-mode-select");
  });

  document.getElementById("shibari-word-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("shibari-word-input");
    const word = input.value.trim();
    if (!word) return;
    await submitShibariWord(word);
    input.value = "";
    input.focus();
  });

  document.getElementById("shibari-reset-btn").addEventListener("click", async () => {
    await resetShibariGame();
  });

  document.getElementById("memory-back-to-select-btn").addEventListener("click", () => {
    showScreen("screen-mode-select");
  });

  document.getElementById("memory-word-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("memory-word-input");
    const value = input.value.trim();
    if (!value) return;
    await submitMemoryInput(value);
  });

  document.getElementById("memory-reset-btn").addEventListener("click", async () => {
    await resetMemoryGame();
  });
} catch (err) {
  console.error("イベント登録に失敗しました:", err);
}
