// Tiny Town — Frontend Application
// Real-time WebSocket dashboard with engaging UI

const AGENT_COLORS = [
  '#58a6ff', '#3fb950', '#d29922', '#f85149',
  '#bc8cff', '#f778ba', '#39d2c0', '#db6d28',
];

let state = null;
let events = [];
let activeFilter = 'all';
let ws = null;
let agentColorMap = {};
let colorIdx = 0;
let previousPrices = {};
let dragonOverlay = null;
let lastRenderedTick = -1;

// ===== WEBSOCKET =====
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    setConnectionStatus(true);
  };

  ws.onclose = () => {
    setConnectionStatus(false);
    setTimeout(connect, 2000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') {
        state = msg.data;
        if (state.tick !== lastRenderedTick) {
          lastRenderedTick = state.tick;
          renderAll();
        }
      } else if (msg.type === 'event') {
        events.push(msg.data);
        if (events.length > 200) events = events.slice(-150);
        addEventToFeed(msg.data);
        showToastForSpecialEvents(msg.data);
        updateEventCount();
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  };
}

function setConnectionStatus(connected) {
  const dot = document.getElementById('connection-status');
  const label = document.querySelector('.status-label');
  dot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  label.textContent = connected ? 'Live' : 'Reconnecting...';
}

function updateEventCount() {
  const el = document.getElementById('event-count');
  const filtered = activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter);
  el.textContent = filtered.length;
}

// ===== RENDERING =====
function renderAll() {
  if (!state) return;
  renderClock();
  renderMap();
  renderAgents();
  renderMarket();
  renderPolitics();
  renderQuests();
  renderAchievements();
  renderStats();
  handleDragon();
  handleNightMode();
  handleSeasonTint();
  handleMeteor();
}

function getAgentColor(id) {
  if (!agentColorMap[id]) {
    agentColorMap[id] = AGENT_COLORS[colorIdx % AGENT_COLORS.length];
    colorIdx++;
  }
  return agentColorMap[id];
}

// ===== CLOCK =====
function renderClock() {
  const weatherEmoji = { sunny: '☀️', rainy: '🌧️', foggy: '🌫️', stormy: '⛈️' };
  const seasonEmoji = { spring: '🌱', summer: '🌻', autumn: '🍂', winter: '❄️' };
  const timeStr = formatHour(state.hour);
  const el = document.getElementById('clock');

  const timeIcon = state.hour >= 21 || state.hour < 6 ? '🌙' : state.hour >= 17 ? '🌆' : '☀️';

  el.textContent = `Day ${state.day} · ${timeIcon} ${timeStr} · ${weatherEmoji[state.weather] || '🌤️'} ${capitalize(state.weather)} · ${seasonEmoji[state.season] || '🌍'} ${capitalize(state.season)}`;

  const isNight = state.hour >= 21 || state.hour < 6;
  el.classList.toggle('night', isNight);
}

function formatHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${period}`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ===== TOWN MAP =====
function renderMap() {
  const map = document.getElementById('town-map');
  let maxX = 0, maxY = 0;
  for (const loc of Object.values(state.locations)) {
    if (loc.x !== undefined) maxX = Math.max(maxX, loc.x);
    if (loc.y !== undefined) maxY = Math.max(maxY, loc.y);
  }
  const cols = maxX + 1;
  const rows = maxY + 1;
  map.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const [key, loc] of Object.entries(state.locations)) {
    if (loc.x !== undefined && loc.y !== undefined) {
      grid[loc.y][loc.x] = { key, ...loc };
    }
  }

  const agentsByLoc = {};
  for (const [id, agent] of Object.entries(state.agents)) {
    if (!agentsByLoc[agent.location]) agentsByLoc[agent.location] = [];
    agentsByLoc[agent.location].push({ id, ...agent });
  }

  let html = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      if (cell) {
        const agents = agentsByLoc[cell.key] || [];
        const hasAgents = agents.length > 0;
        const isCollapsed = cell.key === 'mine' && state.secrets?.mineCollapsed;
        const isFestival = cell.key === 'market' && state.secrets?.harvestFestivalActive;
        const isDragon = state.secrets?.dragonAwake;

        let cls = 'map-cell';
        if (hasAgents) cls += ' has-agents';
        if (isCollapsed) cls += ' collapsed';
        if (isFestival) cls += ' festival';
        if (isDragon && cell.key === 'mine') cls += ' dragon-danger';

        const dots = agents.map(a =>
          `<span class="agent-dot" style="background:${getAgentColor(a.id)}" title="${a.name}"></span>`
        ).join('');

        const agentNames = agents.map(a => a.name).join(', ');
        const tooltip = `${cell.name}${agentNames ? ` — ${agentNames}` : ''}${isCollapsed ? ' [COLLAPSED]' : ''}`;

        html += `<div class="${cls}" title="${tooltip}">
          <span class="cell-emoji">${cell.emoji}</span>
          <span class="cell-name">${cell.name.length > 10 ? cell.name.slice(0, 9) + '…' : cell.name}</span>
          ${dots ? `<div class="agent-dots">${dots}</div>` : ''}
        </div>`;
      } else {
        html += `<div class="map-cell empty"></div>`;
      }
    }
  }
  map.innerHTML = html;
}

// ===== AGENT CARDS =====
function renderAgents() {
  const container = document.getElementById('agent-cards');
  const sortedAgents = Object.entries(state.agents).sort((a, b) => a[1].name.localeCompare(b[1].name));

  if (sortedAgents.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">No citizens yet... waiting for agents to register.</div>';
    return;
  }

  let html = '';
  for (const [id, agent] of sortedAgents) {
    const color = getAgentColor(id);
    const locName = state.locations[agent.location]?.name || agent.location;
    const locEmoji = state.locations[agent.location]?.emoji || '📍';
    const moodEmoji = agent.mood > 70 ? '😊' : agent.mood > 40 ? '😐' : agent.mood > 15 ? '😟' : '😰';
    const gold = agent.inventory?.gold || 0;
    const rep = agent.reputation || 50;
    const maxE = agent.maxEnergy || 100;
    const hunger = agent.hunger ?? 100;

    // Build inventory summary (top 4 items, excluding gold)
    const invItems = Object.entries(agent.inventory || {})
      .filter(([k]) => k !== 'gold')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const invHtml = invItems.length
      ? invItems.map(([k, v]) => `<span class="inv-item">${getItemEmoji(k)} ${v}</span>`).join('')
      : '<span style="color:var(--text-muted)">empty</span>';

    const titlesHtml = (agent.titles || []).slice(0, 3).map(t => `<span class="title-badge">${t}</span>`).join('');
    const achieveHtml = (agent.achievements || []).slice(0, 3).map(a => `<span class="achievement-badge">${a}</span>`).join('');

    // Status warning
    let statusWarn = '';
    if (hunger <= 0) statusWarn = '<span class="status-warn">💀 STARVING</span>';
    else if (hunger <= 20) statusWarn = '<span class="status-warn">😫 Hungry</span>';
    else if (agent.energy <= 10) statusWarn = '<span class="status-warn">😴 Exhausted</span>';

    html += `<div class="agent-card" style="border-left: 3px solid ${color}">
      <div class="agent-card-header">
        <span class="agent-name" style="color:${color}">${moodEmoji} ${agent.name}</span>
        <span class="agent-gold">💰 ${gold}g</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span class="agent-role">${agent.role}</span>
        <span class="agent-location">${locEmoji} ${locName}</span>
      </div>
      <div class="agent-bars">
        <div class="bar-group" title="Mood: ${agent.mood}%"><span class="bar-label">😊</span><div class="bar-track"><div class="bar-fill mood" style="width:${agent.mood}%"></div></div></div>
        <div class="bar-group" title="Energy: ${agent.energy}/${maxE}"><span class="bar-label">⚡</span><div class="bar-track"><div class="bar-fill energy" style="width:${Math.round(agent.energy/maxE*100)}%"></div></div></div>
        <div class="bar-group" title="Hunger: ${hunger}%"><span class="bar-label">🍖</span><div class="bar-track"><div class="bar-fill hunger${hunger <= 20 ? ' critical' : ''}" style="width:${hunger}%"></div></div></div>
        <div class="bar-group" title="Reputation: ${rep}"><span class="bar-label">⭐</span><div class="bar-track"><div class="bar-fill reputation" style="width:${rep}%"></div></div></div>
      </div>
      <div class="agent-inventory">${invHtml}</div>
      ${statusWarn}
      ${titlesHtml || achieveHtml ? `<div class="agent-titles">${titlesHtml}${achieveHtml}</div>` : ''}
    </div>`;
  }
  container.innerHTML = html;
}

function getItemEmoji(item) {
  const map = {
    food: '🍞', wood: '🪵', stone: '🪨', iron: '⛓️', herbs: '🌿',
    tools: '🔧', potion: '🧪', bread: '🥖', sword: '⚔️', shield: '🛡️',
    lantern: '🏮', pie: '🥧', telescope: '🔭', fishing_rod: '🎣',
    amulet: '🧿', crown: '👑', golden_fish: '🐟', ancient_artifact: '💎',
    dragon_scale: '🐉', enchanted_pearl: '🫧', divine_artifact: '✨',
    spell_book: '📖',
  };
  return map[item] || '📦';
}

// ===== MARKET =====
function renderMarket() {
  const tbody = document.querySelector('#market-table tbody');
  const items = Object.entries(state.market.prices);

  // Group: show items with supply first, then zero-supply
  items.sort((a, b) => {
    const sa = state.market.supply[a[0]] || 0;
    const sb = state.market.supply[b[0]] || 0;
    if (sa > 0 && sb === 0) return -1;
    if (sa === 0 && sb > 0) return 1;
    return a[1] - b[1]; // Then by price
  });

  let html = '';
  for (const [item, price] of items) {
    const supply = state.market.supply[item] || 0;
    const prev = previousPrices[item] || price;
    const changeClass = price > prev ? 'price-up' : price < prev ? 'price-down' : '';
    const arrow = price > prev ? ' ▲' : price < prev ? ' ▼' : '';
    const emoji = getItemEmoji(item);
    const dimClass = supply === 0 ? ' dim' : '';

    html += `<tr class="${dimClass}">
      <td>${emoji} ${item}</td>
      <td class="${changeClass}">${price}g${arrow}</td>
      <td>${supply}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
  previousPrices = { ...state.market.prices };
}

// ===== POLITICS =====
function renderPolitics() {
  const el = document.getElementById('politics-info');
  const p = state.politics;

  let html = `
    <div class="politics-row"><span class="politics-label">👑 Mayor</span><span class="politics-value">${p.mayorName || '<em>None</em>'}</span></div>
    <div class="politics-row"><span class="politics-label">💸 Tax</span><span class="politics-value">${Math.round(p.taxRate * 100)}%</span></div>
    <div class="politics-row"><span class="politics-label">🗳️ Election</span><span class="politics-value">${p.electionActive ? '<span style="color:var(--accent-red)">🔴 ACTIVE</span>' : 'Pending'}</span></div>
    <div class="politics-row"><span class="politics-label">🎪 Festivals</span><span class="politics-value">${p.festivals}</span></div>
  `;
  if (p.laws?.length > 0) {
    html += '<div style="margin-top:6px;color:var(--text-secondary);font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">Recent Laws</div>';
    for (const law of p.laws.slice(-3)) {
      html += `<div class="law-item">📋 "${law.text}" <span style="color:var(--text-muted)">— ${law.proposedBy}</span></div>`;
    }
  }
  el.innerHTML = html;
}

// ===== QUESTS =====
function renderQuests() {
  const el = document.getElementById('quests-info');
  const quests = state.quests || [];

  if (quests.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">No active quests on the board.</div>';
    return;
  }

  el.innerHTML = quests.map(q =>
    `<div class="quest-item"><span class="quest-desc">📋 ${q.description}</span><span class="quest-reward">💰 ${q.reward}g</span></div>`
  ).join('');
}

// ===== ACHIEVEMENTS =====
function renderAchievements() {
  const el = document.getElementById('achievements-info');
  const allAchs = [];
  for (const [id, agent] of Object.entries(state.agents)) {
    for (const ach of (agent.achievements || [])) {
      allAchs.push({ agent: agent.name, ach, color: getAgentColor(id) });
    }
  }

  if (allAchs.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px;">No achievements earned yet.</div>';
    return;
  }

  el.innerHTML = allAchs.map(a =>
    `<span class="achievement-badge" style="border-color:${a.color}40" title="${a.agent}">🏆 ${a.agent}: ${a.ach}</span>`
  ).join('');
}

// ===== STATS =====
function renderStats() {
  const el = document.getElementById('stats-info');
  const agents = Object.values(state.agents);
  const n = agents.length;
  const totalGold = agents.reduce((s, a) => s + (a.inventory?.gold || 0), 0);
  const totalTrades = agents.reduce((s, a) => s + (a.stats?.trades || 0), 0);
  const totalGathers = agents.reduce((s, a) => s + (a.stats?.gathers || 0), 0);
  const totalCrafts = agents.reduce((s, a) => s + (a.stats?.crafts || 0), 0);
  const totalDuels = agents.reduce((s, a) => s + (a.stats?.duelsWon || 0) + (a.stats?.duelsLost || 0), 0);
  const avgMood = n ? Math.round(agents.reduce((s, a) => s + a.mood, 0) / n) : 0;
  const avgHunger = n ? Math.round(agents.reduce((s, a) => s + (a.hunger ?? 100), 0) / n) : 0;

  const moodColor = avgMood > 60 ? 'var(--accent-green)' : avgMood > 30 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const hungerColor = avgHunger > 60 ? 'var(--accent-green)' : avgHunger > 30 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  el.innerHTML = `
    <div class="stat-row"><span class="stat-label">👥 Citizens</span><span class="stat-value">${n}</span></div>
    <div class="stat-row"><span class="stat-label">💰 Total Gold</span><span class="stat-value">${totalGold}g</span></div>
    <div class="stat-row"><span class="stat-label">🤝 Trades</span><span class="stat-value">${totalTrades}</span></div>
    <div class="stat-row"><span class="stat-label">⛏️ Gathers</span><span class="stat-value">${totalGathers}</span></div>
    <div class="stat-row"><span class="stat-label">🔨 Crafts</span><span class="stat-value">${totalCrafts}</span></div>
    <div class="stat-row"><span class="stat-label">⚔️ Duels</span><span class="stat-value">${totalDuels}</span></div>
    <div class="stat-row"><span class="stat-label">😊 Avg Mood</span><span class="stat-value" style="color:${moodColor}">${avgMood}%</span></div>
    <div class="stat-row"><span class="stat-label">🍖 Avg Hunger</span><span class="stat-value" style="color:${hungerColor}">${avgHunger}%</span></div>
    <div class="stat-row"><span class="stat-label">🐉 Dragon</span><span class="stat-value">${state.secrets?.dragonAwake ? '<span style="color:var(--accent-red)">⚠️ AWAKE</span>' : '💤 Sleeping'}</span></div>
    <div class="stat-row"><span class="stat-label">⛏️ Mine</span><span class="stat-value">${state.secrets?.mineCollapsed ? '<span style="color:var(--accent-red)">🚫 Collapsed</span>' : '✅ Open'}</span></div>
    <div class="stat-row"><span class="stat-label">🎃 Festival</span><span class="stat-value">${state.secrets?.harvestFestivalActive ? '<span style="color:var(--accent-yellow)">🎉 ACTIVE</span>' : '—'}</span></div>
    <div class="stat-row"><span class="stat-label">🎶 Bard</span><span class="stat-value">${state.secrets?.bardVisiting ? '<span style="color:var(--accent-pink)">🎵 In Town!</span>' : '—'}</span></div>
  `;
}

// ===== EVENT FEED =====
function addEventToFeed(event) {
  if (activeFilter !== 'all' && event.type !== activeFilter) return;

  const feed = document.getElementById('event-feed');
  const div = document.createElement('div');
  div.className = `event-item ${event.type || ''}`;

  const timeStr = formatHour(event.hour);
  const agentColor = event.agentId && event.agentId !== 'world' ? getAgentColor(event.agentId) : 'var(--text-secondary)';
  const agentName = event.agentName || 'World';

  // Format description based on type
  let desc = event.description;
  if (event.type === 'speech' || event.type === 'shout') {
    desc = `"${event.description}"`;
  }

  div.innerHTML = `
    <span class="event-time">D${event.day} ${timeStr}</span>
    <span class="event-emoji">${event.emoji}</span>
    <span class="event-text"><span class="agent-ref" style="color:${agentColor}">${agentName}</span> ${desc}</span>
  `;

  feed.appendChild(div);

  // Auto-scroll only if user is near bottom
  if (feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120) {
    requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
  }

  // Trim old DOM elements efficiently
  while (feed.children.length > 150) {
    feed.removeChild(feed.firstChild);
  }
}

function rebuildEventFeed() {
  const feed = document.getElementById('event-feed');
  feed.innerHTML = '';
  const filtered = activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter);
  for (const event of filtered.slice(-100)) {
    addEventToFeed(event);
  }
  updateEventCount();
}

// ===== FILTERS =====
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    rebuildEventFeed();
  });
});

// ===== TOASTS =====
function showToastForSpecialEvents(event) {
  const toastTypes = ['easter_egg', 'arrival', 'politics'];
  if (!toastTypes.includes(event.type)) return;
  // Also show for starvation warnings
  if (event.type === 'status' && event.description.includes('STARVING')) {
    // Show starvation toast
  } else if (!toastTypes.includes(event.type)) {
    return;
  }

  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';

  if (event.description.includes('DRAGON') || event.description.includes('COLLAPSE') || event.description.includes('TSUNAMI') || event.description.includes('COUP') || event.description.includes('STARVING') || event.description.includes('cursed')) {
    toast.classList.add('toast-danger');
  } else if (event.description.includes('achievement') || event.description.includes('DIVINE') || event.description.includes('LEGENDARY') || event.description.includes('ANCIENT')) {
    toast.classList.add('toast-gold');
  }

  toast.innerHTML = `<span style="margin-right:4px">${event.emoji}</span> ${event.description}`;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4000);
}

// ===== VISUAL EFFECTS =====

function handleDragon() {
  if (state.secrets?.dragonAwake && !dragonOverlay) {
    dragonOverlay = document.createElement('div');
    dragonOverlay.className = 'dragon-overlay';
    document.body.appendChild(dragonOverlay);
  } else if (!state.secrets?.dragonAwake && dragonOverlay) {
    dragonOverlay.remove();
    dragonOverlay = null;
  }
}

function handleNightMode() {
  const overlay = document.getElementById('night-overlay');
  const isNight = state.hour >= 21 || state.hour < 6;
  const isEvening = state.hour >= 18;
  overlay.classList.toggle('active', isNight);
  overlay.classList.toggle('evening', isEvening && !isNight);
}

function handleSeasonTint() {
  document.body.className = document.body.className.replace(/season-\w+/g, '').trim();
  document.body.classList.add(`season-${state.season}`);
}

let meteorActive = false;
function handleMeteor() {
  const recentMeteor = events.slice(-5).find(e => e.description?.includes('METEOR'));
  if (recentMeteor && !meteorActive) {
    meteorActive = true;
    const overlay = document.getElementById('meteor-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const meteor = document.createElement('div');
        meteor.className = 'meteor';
        meteor.style.left = (Math.random() * 90) + '%';
        meteor.style.top = (Math.random() * 20) + '%';
        meteor.style.animationDuration = (0.8 + Math.random() * 1.2) + 's';
        overlay.appendChild(meteor);
        setTimeout(() => { if (meteor.parentNode) meteor.remove(); }, 2500);
      }, i * 250);
    }

    setTimeout(() => {
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      meteorActive = false;
    }, 6000);
  }
}

// ===== INITIAL LOAD =====
async function loadInitialState() {
  try {
    const res = await fetch('/api/world');
    state = await res.json();
    if (state.recentEvents) {
      events = state.recentEvents;
    }
    renderAll();
    rebuildEventFeed();
  } catch (e) {
    console.log('Waiting for server...');
    setTimeout(loadInitialState, 2000);
  }
}

// Boot
loadInitialState();
connect();
