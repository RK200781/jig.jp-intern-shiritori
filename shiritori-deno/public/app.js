// モードの定義。新しいモードを追加する場合はここに要素を足すだけでよい。
const MODES = [
  {
    id: "normal",
    name: "通常モード",
    description:
      "基本のしりとりルールで遊びます。前の単語の最後の文字から始まる単語を入力してください。" +
      "「ん」で終わる単語を入力するとゲーム終了、すでに使った単語を入力してもゲーム終了です。" +
      "入力された単語は Wikipedia で実在するかどうかをチェックします。",
  },
  {
    id: "vocab",
    name: "語彙力診断モード",
    description:
      "CPUと対戦して語彙力を診断しよう！\n" +
      "CPUが出した単語に10秒以内に続く単語を答えてね。\n" +
      "時間切れ・「ん」で終わる単語・同じ単語を使うと負け。\n" +
      "返答が速いほどスコアが高くなるよ！",
  },
];

const ERROR_MESSAGES = {
  EMPTY: "単語を入力してください。",
  NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  NOT_FOUND: "実在する単語として見つかりませんでした。別の単語を試してください。",
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
    btn.textContent = mode.name;
    btn.addEventListener("click", () => selectMode(mode));
    container.appendChild(btn);
  }
}

function selectMode(mode) {
  currentMode = mode;
  document.getElementById("mode-title").textContent = mode.name;
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
    banner.classList.remove("hidden");
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

// ---- 語彙力診断モード ----

const VOCAB_CONTINUE_ERROR_MESSAGES = {
  VOCAB_NOT_CONNECTED: "しりとりが繋がっていません。前の単語の最後の文字から始めてください。",
  VOCAB_NOT_REAL_WORD: "実在する単語として見つかりませんでした。別の単語を試してください。",
  VOCAB_TOO_SHORT: "1文字の単語は使えません。2文字以上の単語を入力してください。",
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
  if (data.isCpuLose) {
    banner.textContent = "CPUの単語が尽きた！あなたの勝利！";
  } else {
    banner.textContent = VOCAB_END_MESSAGES[data.errorCode] ?? "ゲーム終了です。";
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

// モード選択画面の表示は、通信やイベント配線より先に必ず実行する。
// 以降の処理が失敗しても、最初の画面が消えたままになることはない。
renderModeList();
showScreen("screen-mode-select");

try {
  document.getElementById("start-game-btn").addEventListener("click", async () => {
    if (currentMode.id === "vocab") {
      showScreen("screen-vocab-game");
      await startVocabGame();
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
} catch (err) {
  console.error("イベント登録に失敗しました:", err);
}
