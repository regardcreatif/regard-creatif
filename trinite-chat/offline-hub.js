// ============================================================
// OFFLINE HUB — Logic
// Chat P2P simulé · Snake · Casino · Paris virtuels
// ============================================================
"use strict";

/* ===== STATUS ===== */
(function initStatus() {
  const dot  = document.getElementById("hub-status-dot");
  const text = document.getElementById("hub-status-text");
  function update() {
    const online = navigator.onLine;
    dot.classList.toggle("offline", !online);
    text.textContent = online ? "Connecté à internet" : "Hors-ligne — mode local actif";
  }
  window.addEventListener("online",  update);
  window.addEventListener("offline", update);
  update();
})();

/* ===== TABS ===== */
document.querySelectorAll(".hub-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".hub-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".hub-section").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab)?.classList.add("active");
  });
});

// ============================================================
// CHAT P2P (simulé)
// ============================================================
let selectedPeer = "Alice";
const p2pMessages = document.getElementById("p2p-messages");

document.querySelectorAll(".device-item:not(.no-peer)").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".device-item").forEach(d => d.classList.remove("selected"));
    item.classList.add("selected");
    selectedPeer = item.dataset.peer;
    addSystemMsg("Connexion simulée avec " + selectedPeer);
  });
});

document.getElementById("p2p-send")?.addEventListener("click", sendP2P);
document.getElementById("p2p-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter") sendP2P();
});

function sendP2P() {
  const input = document.getElementById("p2p-input");
  const text  = input.value.trim();
  if (!text) return;
  input.value = "";

  addMsg(text, "out", "Moi");
  saveP2PMessage({ from: "Moi", to: selectedPeer, text, ts: Date.now() });

  // Réponse simulée après 1-2s
  setTimeout(() => {
    const replies = [
      "Message reçu 👍",
      "OK je t'entends !",
      "Hors-ligne mais là 😄",
      "Bien reçu, on se voit bientôt",
      "Réseau local OK ✓"
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    addMsg(reply, "in", selectedPeer);
  }, 800 + Math.random() * 1200);
}

function addMsg(text, dir, sender) {
  const div = document.createElement("div");
  div.className = "p2p-msg " + dir;
  const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  div.innerHTML = `${escHtml(text)}<div class="msg-meta">${escHtml(sender)} · ${time}</div>`;
  p2pMessages.appendChild(div);
  p2pMessages.scrollTop = p2pMessages.scrollHeight;
}

function addSystemMsg(text) {
  const div = document.createElement("div");
  div.style.cssText = "text-align:center;font-size:0.68rem;color:rgba(255,255,255,0.35);padding:4px 0;";
  div.textContent = text;
  p2pMessages.appendChild(div);
  p2pMessages.scrollTop = p2pMessages.scrollHeight;
}

// IndexedDB pour messages P2P
let p2pDB = null;
function openP2PDB() {
  return new Promise((res, rej) => {
    if (p2pDB) return res(p2pDB);
    const req = indexedDB.open("trinite-p2p", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
    req.onsuccess = e => { p2pDB = e.target.result; res(p2pDB); };
    req.onerror   = () => rej(req.error);
  });
}

async function saveP2PMessage(msg) {
  try {
    const db = await openP2PDB();
    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").add(msg);
  } catch (e) { console.warn("P2P IDB:", e); }
}

// Load last messages
(async function loadP2PHistory() {
  try {
    const db = await openP2PDB();
    const tx = db.transaction("messages", "readonly");
    const all = await new Promise(r => { const q = tx.objectStore("messages").getAll(); q.onsuccess = () => r(q.result); });
    const last = all.slice(-20);
    if (last.length) {
      addSystemMsg("— historique local —");
      last.forEach(m => addMsg(m.text, m.from === "Moi" ? "out" : "in", m.from));
    } else {
      addSystemMsg("Aucun message local — sélectionne un appareil et écris !");
    }
  } catch (e) {
    addSystemMsg("Prêt — aucun historique");
  }
})();

// ============================================================
// SNAKE
// ============================================================
const snakeCanvas = document.getElementById("snake-canvas");
const snakeCtx    = snakeCanvas?.getContext("2d");
const CELL = 20;
const COLS = snakeCanvas ? snakeCanvas.width / CELL : 15;
const ROWS = snakeCanvas ? snakeCanvas.height / CELL : 15;

let snake, dir, nextDir, food, snakeScore, snakeBest, snakeLoop, snakeRunning;

function initSnake() {
  snake   = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
  dir     = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  snakeScore = 0;
  snakeBest  = parseInt(localStorage.getItem("snake-best") || "0");
  document.getElementById("snake-score").textContent = 0;
  document.getElementById("snake-best").textContent  = snakeBest;
  placeFood();
}

function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

function drawSnake() {
  if (!snakeCtx) return;
  snakeCtx.fillStyle = "#0a0a18";
  snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

  // Grid dots
  snakeCtx.fillStyle = "rgba(139,92,246,0.08)";
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      snakeCtx.fillRect(x * CELL + 9, y * CELL + 9, 2, 2);

  // Food
  snakeCtx.font = (CELL - 2) + "px serif";
  snakeCtx.textAlign = "center";
  snakeCtx.textBaseline = "middle";
  snakeCtx.fillText("🍎", food.x * CELL + CELL / 2, food.y * CELL + CELL / 2);

  // Snake
  snake.forEach((seg, i) => {
    const ratio = 1 - i / snake.length;
    snakeCtx.fillStyle = `rgba(${Math.round(139 + (219-139)*(1-ratio))}, ${Math.round(92 + (39-92)*(1-ratio))}, 246, ${0.5 + ratio * 0.5})`;
    const pad = i === 0 ? 1 : 2;
    snakeCtx.beginPath();
    snakeCtx.roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad*2, CELL - pad*2, 4);
    snakeCtx.fill();
  });
}

function stepSnake() {
  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) return gameOver();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    snakeScore++;
    document.getElementById("snake-score").textContent = snakeScore;
    if (snakeScore > snakeBest) {
      snakeBest = snakeScore;
      localStorage.setItem("snake-best", snakeBest);
      document.getElementById("snake-best").textContent = snakeBest;
    }
    placeFood();
  } else {
    snake.pop();
  }
  drawSnake();
}

function gameOver() {
  clearInterval(snakeLoop);
  snakeRunning = false;
  if (!snakeCtx) return;
  snakeCtx.fillStyle = "rgba(0,0,0,0.6)";
  snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeCtx.fillStyle = "#fff";
  snakeCtx.font = "bold 22px Inter, sans-serif";
  snakeCtx.textAlign = "center";
  snakeCtx.textBaseline = "middle";
  snakeCtx.fillText("Game Over", snakeCanvas.width / 2, snakeCanvas.height / 2 - 14);
  snakeCtx.font = "14px Inter, sans-serif";
  snakeCtx.fillStyle = "#8b5cf6";
  snakeCtx.fillText("Score : " + snakeScore, snakeCanvas.width / 2, snakeCanvas.height / 2 + 14);
  document.getElementById("snake-start").textContent = "Rejouer";
}

document.getElementById("snake-start")?.addEventListener("click", () => {
  if (snakeRunning) return;
  initSnake();
  drawSnake();
  snakeRunning = true;
  clearInterval(snakeLoop);
  const speed = 150;
  snakeLoop = setInterval(stepSnake, speed);
  document.getElementById("snake-start").textContent = "En cours…";
});

// Controls
document.querySelectorAll(".ctrl-row button[data-dir]").forEach(btn => {
  btn.addEventListener("click", () => setSnakeDir(btn.dataset.dir));
});

document.addEventListener("keydown", e => {
  const map = { ArrowUp:"UP", ArrowDown:"DOWN", ArrowLeft:"LEFT", ArrowRight:"RIGHT" };
  if (map[e.key]) { e.preventDefault(); setSnakeDir(map[e.key]); }
});

function setSnakeDir(d) {
  if (!snakeRunning) return;
  if (d === "UP"    && dir.y !== 1)  nextDir = { x: 0,  y: -1 };
  if (d === "DOWN"  && dir.y !== -1) nextDir = { x: 0,  y: 1  };
  if (d === "LEFT"  && dir.x !== 1)  nextDir = { x: -1, y: 0  };
  if (d === "RIGHT" && dir.x !== -1) nextDir = { x: 1,  y: 0  };
}

// Swipe on canvas
let swipeStart = null;
snakeCanvas?.addEventListener("touchstart", e => { swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
snakeCanvas?.addEventListener("touchend", e => {
  if (!swipeStart) return;
  const dx = e.changedTouches[0].clientX - swipeStart.x;
  const dy = e.changedTouches[0].clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > Math.abs(dy)) setSnakeDir(dx > 0 ? "RIGHT" : "LEFT");
  else setSnakeDir(dy > 0 ? "DOWN" : "UP");
});

initSnake(); drawSnake();

// ============================================================
// CASINO — Machine à sous
// ============================================================
const SYMBOLS   = ["🍒","⭐","🍋","🍊","7️⃣","💎","🎰"];
const PAYTABLE  = { "💎💎💎": 50, "7️⃣7️⃣7️⃣": 20, "🍒🍒🍒": 10, "⭐⭐⭐": 5 };
let casinoTokens = parseInt(localStorage.getItem("casino-tokens") || "500");
let casinoSpinning = false;

document.getElementById("casino-tokens").textContent = casinoTokens;

document.getElementById("casino-reset")?.addEventListener("click", () => {
  casinoTokens = 500;
  saveTokens();
  document.getElementById("casino-result").textContent = "Jetons rechargés !";
});

document.getElementById("casino-spin")?.addEventListener("click", async () => {
  if (casinoSpinning) return;
  const bet = parseInt(document.getElementById("casino-bet").value);
  if (casinoTokens < bet) {
    document.getElementById("casino-result").textContent = "Jetons insuffisants !";
    document.getElementById("casino-result").style.color = "#ef4444";
    return;
  }

  casinoTokens -= bet;
  saveTokens();
  casinoSpinning = true;
  document.getElementById("casino-spin").disabled = true;
  document.getElementById("casino-result").textContent = "";

  const reels   = [0, 1, 2].map(i => document.getElementById("reel-" + i));
  const results = [];

  // Animate each reel
  for (let i = 0; i < 3; i++) {
    reels[i].classList.add("spinning");
    await new Promise(r => setTimeout(r, 300 + i * 250));
    reels[i].classList.remove("spinning");
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    results.push(sym);
    reels[i].querySelector("span").textContent = sym;
  }

  // Calculate win
  const key    = results.join("");
  const exact  = PAYTABLE[key];
  let win      = 0;
  let resultTxt = "";

  if (exact) {
    win = bet * exact;
    resultTxt = `🎉 Jackpot ! +${win} jetons`;
    document.getElementById("casino-result").style.color = "#22c55e";
  } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
    win = bet * 2;
    resultTxt = `✓ Deux identiques ! +${win} jetons`;
    document.getElementById("casino-result").style.color = "#f59e0b";
  } else {
    resultTxt = `Perdu… -${bet} jetons`;
    document.getElementById("casino-result").style.color = "#ef4444";
  }

  casinoTokens += win;
  saveTokens();
  document.getElementById("casino-result").textContent = resultTxt;
  casinoSpinning = false;
  document.getElementById("casino-spin").disabled = false;
});

function saveTokens() {
  localStorage.setItem("casino-tokens", casinoTokens);
  document.getElementById("casino-tokens").textContent = casinoTokens;
}

// ============================================================
// PARIS VIRTUELS
// ============================================================
const MATCHES = [
  { id: 1, team1: "Lyon",      team2: "Paris",   odds1: 2.1, odds2: 1.8 },
  { id: 2, team1: "Marseille", team2: "Monaco",  odds1: 2.5, odds2: 1.6 },
  { id: 3, team1: "Nantes",    team2: "Bordeaux",odds1: 1.9, odds2: 2.0 },
];

let parisTokens = parseInt(localStorage.getItem("paris-tokens") || "500");
let activeBets  = JSON.parse(localStorage.getItem("paris-bets") || "[]");
let parisHistory= JSON.parse(localStorage.getItem("paris-history") || "[]");

document.getElementById("paris-tokens").textContent = parisTokens;

function renderMatches() {
  const container = document.getElementById("paris-matches");
  container.innerHTML = "";
  MATCHES.forEach(m => {
    const existingBet = activeBets.find(b => b.matchId === m.id);
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-teams">
        <span>${m.team1}</span>
        <span class="match-vs">VS</span>
        <span>${m.team2}</span>
      </div>
      <div class="match-odds">
        <button class="odd-btn ${existingBet?.pick === 1 ? 'selected' : ''}"
                data-match="${m.id}" data-pick="1" data-odds="${m.odds1}" ${existingBet ? 'disabled' : ''}>
          ${m.team1}<strong>${m.odds1}×</strong>
        </button>
        <button class="odd-btn ${existingBet?.pick === 2 ? 'selected' : ''}"
                data-match="${m.id}" data-pick="2" data-odds="${m.odds2}" ${existingBet ? 'disabled' : ''}>
          ${m.team2}<strong>${m.odds2}×</strong>
        </button>
      </div>
      ${existingBet
        ? `<div style="margin-top:8px;font-size:0.75rem;color:#f59e0b;">
             Pari placé : ${existingBet.amount} jetons sur ${existingBet.pick === 1 ? m.team1 : m.team2}
             <button class="btn-game btn-small" style="margin-left:8px;" data-resolve="${m.id}">Résoudre</button>
           </div>`
        : `<div style="display:flex;gap:6px;margin-top:8px;align-items:center;">
             <input type="number" placeholder="Mise" min="10" max="${parisTokens}" value="50"
               style="width:70px;background:#13132a;border:1px solid var(--border);border-radius:8px;
                      padding:5px 8px;color:#fff;font-family:inherit;font-size:0.8rem;"
               id="mise-${m.id}" />
             <span style="font-size:0.7rem;color:rgba(255,255,255,0.4)">jetons</span>
           </div>`
      }
    `;
    container.appendChild(card);
  });

  // Odd buttons → place bet
  container.querySelectorAll(".odd-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = parseInt(btn.dataset.match);
      const pick    = parseInt(btn.dataset.pick);
      const odds    = parseFloat(btn.dataset.odds);
      const miseEl  = document.getElementById("mise-" + matchId);
      const amount  = parseInt(miseEl?.value || 50);
      if (amount <= 0 || amount > parisTokens) {
        alert("Mise invalide ou jetons insuffisants"); return;
      }
      parisTokens -= amount;
      localStorage.setItem("paris-tokens", parisTokens);
      document.getElementById("paris-tokens").textContent = parisTokens;
      activeBets.push({ matchId, pick, odds, amount });
      localStorage.setItem("paris-bets", JSON.stringify(activeBets));
      renderMatches();
      renderParisHistory();
    });
  });

  // Resolve buttons
  container.querySelectorAll("button[data-resolve]").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchId = parseInt(btn.dataset.resolve);
      const bet     = activeBets.find(b => b.matchId === matchId);
      const match   = MATCHES.find(m => m.id === matchId);
      if (!bet || !match) return;

      const winner = Math.random() < 0.5 ? 1 : 2;
      const won    = bet.pick === winner;
      const gain   = won ? Math.floor(bet.amount * bet.odds) : 0;
      parisTokens += gain;
      localStorage.setItem("paris-tokens", parisTokens);
      document.getElementById("paris-tokens").textContent = parisTokens;

      parisHistory.unshift({
        match: `${match.team1} vs ${match.team2}`,
        pick:  bet.pick === 1 ? match.team1 : match.team2,
        winner: winner === 1 ? match.team1 : match.team2,
        amount: bet.amount,
        gain,
        won,
        ts: Date.now()
      });
      if (parisHistory.length > 20) parisHistory.pop();
      localStorage.setItem("paris-history", JSON.stringify(parisHistory));

      activeBets = activeBets.filter(b => b.matchId !== matchId);
      localStorage.setItem("paris-bets", JSON.stringify(activeBets));
      renderMatches();
      renderParisHistory();
    });
  });
}

function renderParisHistory() {
  const list = document.getElementById("paris-history-list");
  if (!parisHistory.length) {
    list.innerHTML = '<div style="font-size:0.75rem;color:rgba(255,255,255,0.3);text-align:center;padding:8px;">Aucun pari résolu</div>';
    return;
  }
  list.innerHTML = parisHistory.slice(0, 10).map(h => `
    <div class="history-item">
      <div>
        <div style="font-weight:600">${h.match}</div>
        <div style="font-size:0.68rem;opacity:0.5">Misé sur ${h.pick} · Vainqueur : ${h.winner}</div>
      </div>
      <div class="${h.won ? 'win' : 'lose'}">
        ${h.won ? '+' + h.gain : '-' + h.amount}
      </div>
    </div>
  `).join("");
}

renderMatches();
renderParisHistory();

// ============================================================
// UTILITAIRE
// ============================================================
function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
