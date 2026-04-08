const BACKEND = "";

let authToken = localStorage.getItem("seo_token") || null;
let currentUser = null;

// In-memory store — populated on loadHistory(), cleared on logout
let historyMap = {};

// ════════════════════════════════════════════════
// ACCOUNT PANEL
// ════════════════════════════════════════════════
function openAcctPanel() {
  if (!currentUser) return;
  const name = currentUser.full_name || currentUser.email || "User";
  const email = currentUser.email || "";
  const initial = name.charAt(0).toUpperCase();

  document.getElementById("acctAvatarLg").textContent = initial;
  document.getElementById("acctDisplayName").textContent = name;
  document.getElementById("acctDisplayEmail").textContent = email;
  document.getElementById("acctInfoName").textContent = name;
  document.getElementById("acctInfoEmail").textContent = email;

  hideDeleteConfirm();
  document.getElementById("acctOverlay").classList.add("show");
}

function closeAcctPanel() {
  document.getElementById("acctOverlay").classList.remove("show");
  hideDeleteConfirm();
}

function handleAcctOverlayClick(e) {
  if (e.target === document.getElementById("acctOverlay")) closeAcctPanel();
}

function showDeleteConfirm() {
  document.getElementById("acctDeleteStep1").style.display = "none";
  document.getElementById("acctDeleteStep2").classList.add("show");
}

function hideDeleteConfirm() {
  document.getElementById("acctDeleteStep1").style.display = "block";
  document.getElementById("acctDeleteStep2").classList.remove("show");
  document.getElementById("confirmYesBtn").disabled = false;
  document.getElementById("confirmYesBtn").textContent = "Yes, Delete";
}

async function deleteAccount() {
  const btn = document.getElementById("confirmYesBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    const res = await fetch(`${BACKEND}/api/account`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.detail || "Failed to delete account. Please try again.");
      btn.disabled = false;
      btn.textContent = "Yes, Delete";
      return;
    }
    closeAcctPanel();
    clearWorkspace();
    authToken = null;
    currentUser = null;
    localStorage.removeItem("seo_token");
    document.getElementById("mainApp").style.display = "none";
    document.getElementById("authScreen").style.display = "flex";
    switchAuthTab("login");
  } catch (e) {
    alert("Network error. Please try again.");
    btn.disabled = false;
    btn.textContent = "Yes, Delete";
  }
}

// ════════════════════════════════════════════════
// WORKSPACE CLEAR
// ════════════════════════════════════════════════
function clearWorkspace() {
  document.getElementById("keywordInput").value = "";
  document.getElementById("placeholder").style.display = "flex";
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("siteChips").innerHTML = "";
  document.getElementById("compSummary").textContent = "";
  document.getElementById("gapsList").innerHTML = "";
  document.getElementById("articleBody").innerHTML = "";
  document.getElementById("tab-results").classList.add("active");
  document.getElementById("tab-article").classList.remove("active");
  setAgent("competitor", ""); setAgent("gap", ""); setAgent("writer", "");
  setStatus("", "IDLE");
  document.getElementById("console").innerHTML =
    '<div class="log-line"><span class="log-time">[00:00:00]</span><span class="log-default">// System ready. Enter a keyword to begin.</span></div>';
  document.getElementById("runBtn").disabled = false;
  document.getElementById("btnText").textContent = "Run SEO Workflow";
  document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active-item"));
  // ❌ REMOVED: historyMap = {};  ← this was killing the history data
}

// ════════════════════════════════════════════════
// NEW SEARCH
// ════════════════════════════════════════════════
function startNewSearch() {
  clearWorkspace();
  document.getElementById("keywordInput").focus();
}

// ════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + tabName).classList.add("active");
}

// ════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((t, i) => {
    t.classList.toggle("active", (tab === "login" && i === 0) || (tab === "signup" && i === 1));
  });
  document.getElementById("loginForm").style.display = tab === "login" ? "flex" : "none";
  document.getElementById("signupForm").style.display = tab === "signup" ? "flex" : "none";
  hideAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  el.textContent = msg; el.classList.add("show");
}
function hideAuthError() { document.getElementById("authError").classList.remove("show"); }

async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) { showAuthError("Please fill in all fields."); return; }
  const btn = document.getElementById("loginBtn");
  btn.disabled = true; btn.textContent = "Logging in...";
  hideAuthError();
  try {
    const res = await fetch(`${BACKEND}/api/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.detail || "Login failed"); return; }
    authToken = data.token; currentUser = data.user;
    localStorage.setItem("seo_token", authToken);
    enterApp();
  } catch (e) { showAuthError("Cannot reach server. Is the backend running?"); }
  finally { btn.disabled = false; btn.textContent = "Login →"; }
}

async function handleSignup() {
  const full_name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  if (!full_name || !email || !password) { showAuthError("Please fill in all fields."); return; }
  if (password.length < 6) { showAuthError("Password must be at least 6 characters."); return; }
  const btn = document.getElementById("signupBtn");
  btn.disabled = true; btn.textContent = "Creating account...";
  hideAuthError();
  try {
    const res = await fetch(`${BACKEND}/api/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.detail || "Signup failed"); return; }
    authToken = data.token; currentUser = data.user;
    localStorage.setItem("seo_token", authToken);
    enterApp();
  } catch (e) { showAuthError("Cannot reach server. Is the backend running?"); }
  finally { btn.disabled = false; btn.textContent = "Create Account →"; }
}

async function handleLogout() {
  try {
    await fetch(`${BACKEND}/api/logout`, {
      method: "POST", headers: { "Authorization": `Bearer ${authToken}` }
    });
  } catch (e) {}
  clearWorkspace();
  authToken = null; currentUser = null;
  localStorage.removeItem("seo_token");
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("mainApp").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
}

async function checkExistingSession() {
  if (!authToken) return;
  try {
    const res = await fetch(`${BACKEND}/api/me`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) { const data = await res.json(); currentUser = data.user; enterApp(); }
    else { localStorage.removeItem("seo_token"); authToken = null; }
  } catch (e) {}
}

function enterApp() {
  clearWorkspace();
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  const name = currentUser?.full_name || currentUser?.email || "User";
  document.getElementById("userNameDisplay").textContent = name;
  document.getElementById("userAvatar").textContent = name.charAt(0).toUpperCase();
  loadHistory();
}

// ════════════════════════════════════════════════
// HISTORY — instant load via historyMap
// ════════════════════════════════════════════════
async function loadHistory() {
  try {
    const res = await fetch(`${BACKEND}/api/history`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    historyMap = {};
    (data.history || []).forEach(item => { historyMap[item.id] = item; });
    renderHistory(data.history);
  } catch (e) {}
}

function renderHistory(items) {
  const list = document.getElementById("historyList");
  if (!items || items.length === 0) {
    list.innerHTML = `<div class="history-empty"><span>📂</span><p>No searches yet. Run your first keyword workflow!</p></div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="history-item" id="hi-${item.id}" onclick="loadHistoryItem('${item.id}')">
      <div class="history-keyword">${escapeHtml(item.keyword)}</div>
      <div class="history-meta">
        <span class="history-date">${formatDate(item.created_at)}</span>
        <button class="history-delete" onclick="event.stopPropagation(); deleteHistoryItem('${item.id}')">🗑 Del</button>
      </div>
    </div>
  `).join("");
}

function loadHistoryItem(id) {
  const item = historyMap[id];
  if (!item) return;

  document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active-item"));
  const el = document.getElementById("hi-" + id);
  if (el) el.classList.add("active-item");

  document.getElementById("keywordInput").value = item.keyword;

  requestAnimationFrame(() => {
    const sites = extractSites(item.competitors_summary || "");
    document.getElementById("siteChips").innerHTML =
      sites.map(s => `<div class="site-chip">${s}</div>`).join("") ||
      "<div class='site-chip'>DuckDuckGo SERP Results</div>";
    document.getElementById("compSummary").textContent = item.competitors_summary || "";

    const gaps = parseGaps(item.gaps || "");
    document.getElementById("gapsList").innerHTML = gaps
      .map((g, i) => `<div class="gap-item"><div class="gap-number">${i+1}</div><div class="gap-text">${escapeHtml(g)}</div></div>`)
      .join("");

    document.getElementById("articleBody").innerHTML = formatArticle(item.final_article || "");

    document.getElementById("placeholder").style.display = "none";
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-results").classList.add("active");
    switchTab("results");

    setAgent("competitor", "done"); setAgent("gap", "done"); setAgent("writer", "done");
    setStatus("done", "LOADED");
    log(`Loaded: "${item.keyword}"`, "info");
  });
}

async function deleteHistoryItem(id) {
  try {
    await fetch(`${BACKEND}/api/history/${id}`, {
      method: "DELETE", headers: { "Authorization": `Bearer ${authToken}` }
    });
    delete historyMap[id];
    const el = document.getElementById("hi-" + id);

    // ✅ Check if this item is currently open in the main page
    const isActiveInMainPage = el && el.classList.contains("active-item");

    if (el) el.remove();

    // ✅ If it was open, clear the main page too
    if (isActiveInMainPage) {
      clearWorkspace();
    }

    const remaining = document.querySelectorAll(".history-item");
    if (remaining.length === 0) {
      document.getElementById("historyList").innerHTML =
        `<div class="history-empty"><span>📂</span><p>No searches yet. Run your first keyword workflow!</p></div>`;
    }
  } catch (e) {}
}
// ════════════════════════════════════════════════
// MODAL (detail view)
// ════════════════════════════════════════════════
function closeModal() { document.getElementById("historyModal").classList.remove("show"); }

function switchModalTab(tab) {
  ["competitors","gaps","article"].forEach(t => {
    const btn = document.getElementById("mtab-" + t);
    const panel = document.getElementById("modal-" + t);
    if (btn) btn.classList.toggle("active", t === tab);
    if (panel) panel.style.display = t === tab ? "block" : "none";
  });
}

document.getElementById("historyModal").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
}
function log(msg, type = "default") {
  const c = document.getElementById("console");
  const t = new Date().toLocaleTimeString([], { hour12: false });
  const div = document.createElement("div");
  div.className = "log-line";
  div.innerHTML = `<span class="log-time">[${t}]</span><span class="log-${type}"> ${msg}</span>`;
  c.appendChild(div); c.scrollTop = c.scrollHeight;
}
function setStatus(state, text) {
  const el = document.getElementById("statusBadge");
  el.className = state; document.getElementById("statusText").textContent = text;
}
function setAgent(id, state) {
  const row = document.getElementById(`row-${id}`);
  if (row) row.className = `agent-row ${state}`;
}
function extractSites(text) {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})(?:\/[^\s]*)*/g,
    /\b([A-Z][a-zA-Z]+(?:\.com|\.org|\.net|\.io))\b/g
  ];
  const found = new Set();
  for (const p of patterns) {
    let m; while ((m = p.exec(text)) !== null) {
      const s = m[1].toLowerCase().replace(/^www\./, "");
      if (s.length > 3 && s.length < 40) found.add(s);
    }
  }
  const nameMatch = text.match(/\d+\.\s+\*?\*?([A-Z][a-zA-Z0-9\s.]+?)(?:\*\*)?(?:\s*[-–(:]|$)/gm);
  if (nameMatch) nameMatch.forEach(m => {
    const clean = m.replace(/^\d+\.\s+\*?\*?/, "").replace(/\*\*/, "").trim().split(/\s/)[0];
    if (clean.length > 2) found.add(clean);
  });
  return [...found].slice(0, 7);
}
function parseGaps(text) {
  const lines = String(text).split("\n").filter(l => l.trim());
  const gaps = [];
  for (const line of lines) {
    const clean = line.replace(/^\d+[\.\)]\s*/, "").replace(/^\*+/, "").trim();
    if (clean.length > 15) gaps.push(clean);
  }
  return gaps.length ? gaps : [text];
}
function formatArticle(text) {
  let html = String(text)
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>");
  const blocks = html.split("\n\n").map(p => p.trim()).filter(Boolean);
  return blocks.map(p => (p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<ol")) ? p : `<p>${p.replace(/\n/g," ")}</p>`).join("\n");
}

// ════════════════════════════════════════════════
// MAIN WORKFLOW
// ════════════════════════════════════════════════
async function runWorkflow() {
  const keyword = document.getElementById("keywordInput").value.trim();
  if (!keyword) { alert("Please enter a keyword."); return; }

  const btn = document.getElementById("runBtn");
  btn.disabled = true;
  document.getElementById("btnText").textContent = "Running...";
  document.getElementById("console").innerHTML = "";
  document.getElementById("placeholder").style.display = "none";
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active-item"));
  setAgent("competitor",""); setAgent("gap",""); setAgent("writer","");
  setStatus("processing","PROCESSING");
  log(`Workflow started for: "${keyword}"`, "info");

  try {
    const response = await fetch(`${BACKEND}/api/seo-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ keyword })
    });
    if (response.status === 401) { handleLogout(); return; }
    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n"); buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.replace("data: ","").trim();
        if (!raw) continue;
        let msg; try { msg = JSON.parse(raw); } catch { continue; }

        if (msg.event === "agent_start") {
          const labels = { competitor:"Competitor Agent scanning SERP...", gap:"Gap Agent analyzing content...", writer:"Writer Agent generating article..." };
          setAgent(msg.agent,"active"); log(labels[msg.agent] || msg.agent, "info");
        }
        if (msg.event === "agent_done") {
          setAgent(msg.agent,"done");
          const labels = { competitor:"Competitor analysis complete ✓", gap:"Gap analysis complete ✓", writer:"Article generation complete ✓" };
          log(labels[msg.agent] || "Done","success");
        }
        if (msg.event === "error") { log(`Error: ${msg.message}`,"error"); setStatus("error","ERROR"); }
        if (msg.event === "complete") {
          log("All agents finished. Saving to database...","success");
          const sites = extractSites(msg.competitors_summary);
          document.getElementById("siteChips").innerHTML = sites.map(s => `<div class="site-chip">${s}</div>`).join("") || "<div class='site-chip'>DuckDuckGo SERP Results</div>";
          document.getElementById("compSummary").textContent = msg.competitors_summary;
          const gaps = parseGaps(msg.gaps);
          document.getElementById("gapsList").innerHTML = gaps.map((g,i) => `<div class="gap-item"><div class="gap-number">${i+1}</div><div class="gap-text">${escapeHtml(g)}</div></div>`).join("");
          document.getElementById("articleBody").innerHTML = formatArticle(msg.final_article);
          document.getElementById("view-results").classList.add("active");
          switchTab("results");
          setStatus("done","COMPLETE");
          log("Saved to database ✓","success");
          log("Done! Switch to 'Full Article' tab to read.","success");
          setTimeout(loadHistory, 1000);
        }
      }
    }
  } catch (err) {
    log(`Failed: ${err.message}`,"error"); setStatus("error","ERROR");
    document.getElementById("placeholder").style.display = "flex";
  }
  btn.disabled = false;
  document.getElementById("btnText").textContent = "Run SEO Workflow";
}

document.getElementById("keywordInput").addEventListener("keydown", e => { if (e.key === "Enter") runWorkflow(); });

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════
checkExistingSession();
