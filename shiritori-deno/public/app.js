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
  const res = await fetch(url, options);
  return res.json();
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

document.getElementById("start-game-btn").addEventListener("click", async () => {
  await resetGame();
  showScreen("screen-game");
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

renderModeList();
showScreen("screen-mode-select");
