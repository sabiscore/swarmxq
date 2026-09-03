
const state = {
  repo: new URLSearchParams(window.location.search).get("repo") || "",
  overview: null,
};

const el = (id) => document.getElementById(id);
const overviewGrid = el("overview-grid");
const detailGrid = el("detail-grid");
const logOutput = el("log-output");
const statusLine = el("status-line");
const repoInput = el("repo-input");
const targetInput = el("target-input");
const autonomousInput = el("autonomous-input");
const autoApplyInput = el("auto-apply-input");
const reviewInput = el("review-input");

repoInput.value = state.repo;

function qs() {
  const repo = repoInput.value.trim();
  return repo ? `?repo=${encodeURIComponent(repo)}` : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function card(title, body, extra = "") {
  return `<article class="card ${extra}"><h2>${escapeHtml(title)}</h2>${body}</article>`;
}

function renderOverview(data) {
  const summary = data?.config || {};
  const runtime = summary.runtime || {};
  const models = summary.models || {};
  const stack = asArray(data?.stack);
  const tooling = data?.tooling || {};
  const runs = data?.recent_runs || [];
  const memories = data?.recent_memories || [];
  const proposals = data?.evolution?.proposals || [];
  const workflows = data?.workflows || [];
  const skills = data?.skills || [];
  const agents = asArray(data?.agents);
  const templates = asArray(data?.templates);

  overviewGrid.innerHTML = [
    card("Runtime", `
      <div class="kpi">${escapeHtml(summary.provider || "unknown")}</div>
      <div class="muted">${escapeHtml(summary.home || "")}</div>
      <div class="tag-row">${stack.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>
    `),
    card("Models", `
      <div class="kpi">${escapeHtml(models.code || models.default || "n/a")}</div>
      <div class="muted">Fast: ${escapeHtml(models.fast || "n/a")}</div>
      <div class="muted">Autonomous: ${runtime.autonomous ? "yes" : "no"} · Review: ${runtime.review_required ? "on" : "off"}</div>
    `),
    card("Tooling", `
      <div class="kpi">${tooling.git ? "ready" : "limited"}</div>
      <div class="muted">Git: ${tooling.git ? "yes" : "no"} · Python: ${tooling.python ? "yes" : "no"} · Tmux: ${tooling.tmux ? "yes" : "no"}</div>
      <div class="tag-row">${Object.entries(tooling).slice(0, 8).map(([k, v]) => `<span class="tag">${escapeHtml(k)}:${v ? "on" : "off"}</span>`).join("")}</div>
    `),
    card("Council", `
      <div class="kpi">${agents.length || 0}</div>
      <div class="muted">Agents: ${agents.slice(0, 6).map(escapeHtml).join(", ") || "none"}</div>
      <div class="muted">Templates: ${templates.length || 0}</div>
    `),
  ].join("");

  detailGrid.innerHTML = [
    card("Recent runs", `
      <table class="table">
        <thead><tr><th>ID</th><th>Status</th><th>Workflow</th><th>Summary</th></tr></thead>
        <tbody>
          ${runs.slice(-8).reverse().map((run) => `
            <tr>
              <td>${escapeHtml(run.id || "")}</td>
              <td>${escapeHtml(run.status || "")}</td>
              <td>${escapeHtml(run.workflow || "")}</td>
              <td>${escapeHtml(run.summary || "")}</td>
            </tr>
          `).join("") || `<tr><td colspan="4" class="muted">No runs yet.</td></tr>`}
        </tbody>
      </table>
    `),
    card("Memories", `
      <ul class="list">${memories.slice(-8).reverse().map((mem) => `
        <li><strong>${escapeHtml(mem.kind || "lesson")}</strong><br><span class="muted">${escapeHtml(mem.summary || mem.note || mem.content || "")}</span></li>
      `).join("") || `<li class="muted">No memories yet.</li>`}</ul>
    `),

    card("Template library", `
      <ul class="list">${templates.slice(-10).reverse().map((item) => `
        <li><strong>${escapeHtml(item)}</strong><br><span class="muted">Reusable control artifact</span></li>
      `).join("") || `<li class="muted">No templates found.</li>`}</ul>
    `),
    card("Agent roster", `
      <ul class="list">${agents.slice(-12).reverse().map((item) => `
        <li><strong>${escapeHtml(item)}</strong><br><span class="muted">Role card in the swarm council</span></li>
      `).join("") || `<li class="muted">No agents found.</li>`}</ul>
    `),
    card("Evolution proposals", `
      <table class="table">
        <thead><tr><th>Scope</th><th>Risk</th><th>Score</th><th>Reason</th></tr></thead>
        <tbody>
          ${proposals.map((p) => `
            <tr>
              <td>${escapeHtml(p.scope || "")}</td>
              <td>${escapeHtml(p.risk || "")}</td>
              <td>${escapeHtml(p.score ?? "")}</td>
              <td>${escapeHtml(p.reason || "")}</td>
            </tr>
          `).join("") || `<tr><td colspan="4" class="muted">No proposals.</td></tr>`}
        </tbody>
      </table>
    `),
    card("Workflows", `<ul class="list">${workflows.slice(0, 8).map((wf) => `
      <li><strong>${escapeHtml(wf.name || wf.family || "workflow")}</strong><br><span class="muted">${escapeHtml(wf.description || "")}</span></li>
    `).join("") || `<li class="muted">No workflows loaded.</li>`}</ul>`),
    card("Skills", `<ul class="list">${skills.slice(0, 8).map((skill) => `
      <li><strong>${escapeHtml(skill.name || "skill")}</strong><br><span class="muted">${escapeHtml(skill.purpose || "")}</span></li>
    `).join("") || `<li class="muted">No skills loaded.</li>`}</ul>`),
  ].join("");

  const runsSummary = data?.recent_runs?.length ? `${data.recent_runs.length} recent runs` : "no runs yet";
  const memorySummary = data?.recent_memories?.length ? `${data.recent_memories.length} recent memories` : "no memories yet";
  const proposalSummary = proposals.length ? `${proposals.length} active proposals` : "no proposals";
  setStatus(`${summary.provider || "runtime"} · ${runsSummary} · ${memorySummary} · ${proposalSummary}`);
  state.overview = data;
}

async function fetchJson(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

async function refresh() {
  const data = await fetchJson(`/api/overview${qs()}`);
  renderOverview(data);
  logOutput.textContent = JSON.stringify(data, null, 2);
}

async function plan() {
  const payload = {
    repo: repoInput.value.trim(),
    target: targetInput.value.trim() || "repository acceleration",
    review_required: reviewInput.checked,
  };
  const data = await fetchJson("/api/plan", { method: "POST", body: JSON.stringify(payload) });
  logOutput.textContent = JSON.stringify(data, null, 2);
  await refresh();
}

async function run() {
  const payload = {
    repo: repoInput.value.trim(),
    target: targetInput.value.trim() || "repository acceleration",
    autonomous: autonomousInput.checked,
    review_required: reviewInput.checked,
  };
  const data = await fetchJson("/api/run", { method: "POST", body: JSON.stringify(payload) });
  logOutput.textContent = JSON.stringify(data, null, 2);
  await refresh();
}

async function evolve() {
  const payload = {
    repo: repoInput.value.trim(),
    auto_apply: autoApplyInput.checked,
  };
  const data = await fetchJson("/api/evolve", { method: "POST", body: JSON.stringify(payload) });
  logOutput.textContent = JSON.stringify(data, null, 2);
  await refresh();
}

const inFlight = new Set();

// Show a loading indicator in the status line while any action is running
function setStatus(text, busy = false) {
  statusLine.textContent = busy ? `⟳  ${text}` : text;
}

Array.from(document.querySelectorAll("[data-action]")).forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.action;
    if (inFlight.has(action)) return;
    inFlight.add(action);
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "…";
    setStatus(`Running ${action}…`, true);
    try {
      if (action === "refresh") await refresh();
      if (action === "plan") await plan();
      if (action === "run") await run();
      if (action === "evolve") await evolve();
    } catch (err) {
      setStatus(`${action} failed: ${err?.message || err}`);
      logOutput.textContent = String(err?.stack || err);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      inFlight.delete(action);
    }
  });
});

[repoInput, targetInput].forEach((field) => field.addEventListener("change", () => {
  const url = new URL(window.location.href);
  if (repoInput.value.trim()) url.searchParams.set("repo", repoInput.value.trim());
  else url.searchParams.delete("repo");
  window.history.replaceState({}, "", url);
}));

refresh().catch((err) => {
  setStatus("Failed to load dashboard state. Is the server running?");
  logOutput.textContent = String(err?.stack || err);
});

setInterval(() => {
  refresh().catch(() => {});
}, 15000);
