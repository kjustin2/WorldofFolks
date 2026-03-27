// Tiny Town — Frontend Application
// Connects via WebSocket for real-time world state updates

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

// ===== WEBSOCKET =====
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    document.getElementById('connection-status').className = 'status-dot connected';
    document.querySelector('.status-label').textContent = 'Live';
  };

  ws.onclose = () => {
    document.getElementById('connection-status').className = 'status-dot disconnected';
    document.querySelector('.status-label').textContent = 'Offline';
    setTimeout(connect, 2000);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state') {
      state = msg.data;
      renderAll();
    } else if (msg.type === 'event') {
      events.push(msg.data);
      if (events.length > 200) events = events.slice(-150);
      addEventToFeed(msg.data);
      showToastForSpecialEvents(msg.data);
      // Update event count
      document.getElementById('event-count').textContent = events.length;
    }
  };
}

// ===== RENDERING =====
function renderAll() {
  if (!state) return;
  renderClock();
  renderMap();
  renderAgents();
  renderMarket();
  renderPolitics();
  renderStats();
  handleDragon();
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
  el.textContent = `Day ${state.day} · ${timeStr} · ${weatherEmoji[state.weather] || '🌤️'} ${capitalize(state.weather)} · ${seasonEmoji[state.season] || '🌍'} ${capitalize(state.season)}`;
}

function formatHour(h) {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${period}`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== MAP =====
function renderMap() {
  const map = document.getElementById('town-map');
  const grid = Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => null));

  // Place locations on grid
  for (const [key, loc] of Object.entries(state.locations)) {
    if (loc.x !== undefined && loc.y !== undefined) {
      grid[loc.y][loc.x] = { key, ...loc };
    }
  }

  // Count agents at each location
  const agentsByLoc = {};
  for (const [id, agent] of Object.entries(state.agents)) {
    if (!agentsByLoc[agent.location]) agentsByLoc[agent.location] = [];
    agentsByLoc[agent.location].push({ id, ...agent });
  }

  let html = '';
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 5; x++) {
      const cell = grid[y][x];
      if (cell) {
        const agents = agentsByLoc[cell.key] || [];
        const hasAgents = agents.length > 0;
        const dots = agents.map(a =>
          `<span class="agent-dot" style="background:${getAgentColor(a.id)}" title="${a.name}"></span>`
        ).join('');

        html += `<div class="map-cell${hasAgents ? ' has-agents' : ''}" title="${cell.name}${agents.length ? ': ' + agents.map(a=>a.name).join(', ') : ''}">
          <span class="cell-emoji">${cell.emoji}</span>
          <span class="cell-name">${cell.name}</span>
          ${dots ? `<div class="agent-dots">${dots}</div>` : ''}
        </div>`;
      } else {
        html += `<div class="map-cell empty"></div>`;
      }
    }
  }
  map.innerHTML = html;
}

// ===== AGENTS =====
function renderAgents() {
  const container = document.getElementById('agent-cards');
  const sortedAgents = Object.entries(state.agents).sort((a, b) => a[1].name.localeCompare(b[1].name));

  let html = '';
  for (const [id, agent] of sortedAgents) {
    const color = getAgentColor(id);
    const locName = state.locations[agent.location]?.name || agent.location;
    const locEmoji = state.locations[agent.location]?.emoji || '📍';
    const moodEmoji = agent.mood > 70 ? '😊' : agent.mood > 40 ? '😐' : '😟';
    const gold = agent.inventory?.gold || 0;
    const titles = agent.titles?.length ? ` · ${agent.titles.join(', ')}` : '';

    html += `<div class="agent-card" style="border-left: 3px solid ${color}">
      <div class="agent-card-header">
        <span class="agent-name" style="color:${color}">${moodEmoji} ${agent.name}</span>
        <span class="agent-gold">💰 ${gold}g</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="agent-role">${agent.role}${titles}</span>
        <span class="agent-location">${locEmoji} ${locName}</span>
      </div>
      <div class="agent-bars">
        <div class="bar-group" title="Mood: ${agent.mood}%">
          <span class="bar-label">😊</span>
          <div class="bar-track"><div class="bar-fill mood" style="width:${agent.mood}%"></div></div>
        </div>
        <div class="bar-group" title="Energy: ${agent.energy}%">
          <span class="bar-label">⚡</span>
          <div class="bar-track"><div class="bar-fill energy" style="width:${agent.energy}%"></div></div>
        </div>
        <div class="bar-group" title="Hunger: ${agent.hunger || 0}%">
          <span class="bar-label">🍖</span>
          <div class="bar-track"><div class="bar-fill hunger" style="width:${agent.hunger || 0}%"></div></div>
        </div>
      </div>
    </div>`;
  }

  if (!html) {
    html = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">No citizens yet... waiting for agents to register.</div>';
  }
  container.innerHTML = html;
}

// ===== MARKET =====
function renderMarket() {
  const tbody = document.querySelector('#market-table tbody');
  const itemEmoji = {
    food: '🍞', wood: '🪵', stone: '🪨', iron: '⛓️', herbs: '🌿',
    tools: '🔧', potion: '🧪', golden_fish: '🐟✨', ancient_artifact: '💎',
    dragon_scale: '🐉', bread: '🍞', sword: '⚔️', shield: '🛡️', lantern: '🏮',
  };

  let html = '';
  for (const [item, price] of Object.entries(state.market.prices)) {
    const supply = state.market.supply[item] || 0;
    const prev = previousPrices[item] || price;
    const changeClass = price > prev ? 'price-up' : price < prev ? 'price-down' : '';
    const arrow = price > prev ? '▲' : price < prev ? '▼' : '';
    const emoji = itemEmoji[item] || '📦';

    html += `<tr>
      <td>${emoji} ${item}</td>
      <td class="${changeClass}">${price}g ${arrow}</td>
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
    <div class="politics-row">
      <span class="politics-label">👑 Mayor</span>
      <span class="politics-value">${p.mayorName || 'None'}</span>
    </div>
    <div class="politics-row">
      <span class="politics-label">💸 Tax Rate</span>
      <span class="politics-value">${Math.round(p.taxRate * 100)}%</span>
    </div>
    <div class="politics-row">
      <span class="politics-label">🗳️ Election</span>
      <span class="politics-value">${p.electionActive ? '🔴 ACTIVE' : 'Pending'}</span>
    </div>
    <div class="politics-row">
      <span class="politics-label">🎪 Festivals</span>
      <span class="politics-value">${p.festivals}</span>
    </div>
  `;

  if (p.laws && p.laws.length > 0) {
    html += '<div style="margin-top:6px;color:var(--text-secondary);font-size:10px;">Recent Laws:</div>';
    for (const law of p.laws.slice(-3)) {
      html += `<div class="law-item">📋 ${law.text} <span style="color:var(--text-muted)">— ${law.proposedBy}</span></div>`;
    }
  }

  el.innerHTML = html;
}

// ===== STATS =====
function renderStats() {
  const el = document.getElementById('stats-info');
  const agents = Object.values(state.agents);
  const totalGold = agents.reduce((sum, a) => sum + (a.inventory?.gold || 0), 0);
  const totalTrades = agents.reduce((sum, a) => sum + (a.stats?.trades || 0), 0);
  const totalGathers = agents.reduce((sum, a) => sum + (a.stats?.gathers || 0), 0);
  const avgMood = agents.length ? Math.round(agents.reduce((sum, a) => sum + a.mood, 0) / agents.length) : 0;

  el.innerHTML = `
    <div class="stat-row"><span class="stat-label">👥 Citizens</span><span class="stat-value">${agents.length}</span></div>
    <div class="stat-row"><span class="stat-label">💰 Total Gold</span><span class="stat-value">${totalGold}g</span></div>
    <div class="stat-row"><span class="stat-label">🤝 Total Trades</span><span class="stat-value">${totalTrades}</span></div>
    <div class="stat-row"><span class="stat-label">⛏️ Total Gathers</span><span class="stat-value">${totalGathers}</span></div>
    <div class="stat-row"><span class="stat-label">😊 Avg Mood</span><span class="stat-value">${avgMood}%</span></div>
    <div class="stat-row"><span class="stat-label">🐉 Dragon</span><span class="stat-value">${state.secrets?.dragonAwake ? '⚠️ AWAKE' : '💤 Sleeping'}</span></div>
  `;
}

// ===== EVENT FEED =====
function addEventToFeed(event) {
  if (activeFilter !== 'all' && event.type !== activeFilter) return;

  const feed = document.getElementById('event-feed');
  const div = document.createElement('div');
  div.className = `event-item ${event.type || ''}`;

  const timeStr = `D${event.day}`;
  const agentColor = event.agentId && event.agentId !== 'world' ? getAgentColor(event.agentId) : 'var(--text-secondary)';

  div.innerHTML = `
    <span class="event-time">${timeStr} ${formatHour(event.hour)}</span>
    <span class="event-emoji">${event.emoji}</span>
    <span class="event-text"><span class="agent-ref" style="color:${agentColor}">${event.agentName}</span> ${event.type === 'speech' || event.type === 'shout' ? 'says: "' + event.description + '"' : '— ' + event.description}</span>
  `;

  feed.appendChild(div);

  // Auto-scroll if near bottom
  if (feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100) {
    feed.scrollTop = feed.scrollHeight;
  }

  // Limit DOM nodes
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

  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = `${event.emoji} ${event.description}`;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4000);
}

// ===== DRAGON OVERLAY =====
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
  }
}

// Boot
loadInitialState();
connect();
