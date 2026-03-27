// Tiny Town — HTTP/WebSocket Server
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const World = require('./world');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

const world = new World();
world.loadState('world_state.json');

// Broadcast events to all WebSocket clients
world.onEvent = (event) => {
  const msg = JSON.stringify({ type: 'event', data: event });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
};

// Periodic full state broadcast every 5s
setInterval(() => {
  const state = world.getState();
  const msg = JSON.stringify({ type: 'state', data: state });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}, 5000);

// Auto-save world state every 60s
setInterval(() => {
  world.saveState('world_state.json');
}, 60000);

// --- REST API ---

// Register agent
app.post('/api/register', (req, res) => {
  const { name, role, personality } = req.body;
  if (!name || !role) return res.status(400).json({ success: false, error: 'name and role required' });
  res.json(world.registerAgent(name, role, personality));
});

// Get full world state
app.get('/api/world', (req, res) => {
  res.json(world.getState());
});

// Get agent state
app.get('/api/agent/:id', (req, res) => {
  const agent = world.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
  res.json({ success: true, agent });
});

// Get messages at location
app.get('/api/messages/:location', (req, res) => {
  res.json({ success: true, messages: world.getMessages(req.params.location) });
});

// Perform action
app.post('/api/action', (req, res) => {
  const { agentId, action, args } = req.body;
  if (!agentId || !action) return res.status(400).json({ success: false, error: 'agentId and action required' });

  let result;
  switch (action) {
    case 'look':
      result = world.look(agentId);
      break;
    case 'move':
      result = world.move(agentId, args?.destination || args?.[0]);
      break;
    case 'speak':
      result = world.speak(agentId, args?.message || args?.[0]);
      break;
    case 'shout':
      result = world.shout(agentId, args?.message || args?.[0]);
      break;
    case 'gather':
      result = world.gather(agentId);
      break;
    case 'fish':
      result = world.fish(agentId);
      break;
    case 'buy':
      result = world.buy(agentId, args?.item || args?.[0], args?.quantity || args?.[1]);
      break;
    case 'sell':
      result = world.sell(agentId, args?.item || args?.[0], args?.quantity || args?.[1]);
      break;
    case 'trade':
      result = world.trade(agentId, args?.target || args?.[0], args?.giveItem || args?.[1], args?.giveQty || args?.[2], args?.getItem || args?.[3], args?.getQty || args?.[4]);
      break;
    case 'gift':
      result = world.gift(agentId, args?.target || args?.[0], args?.item || args?.[1], args?.quantity || args?.[2]);
      break;
    case 'craft':
      result = world.craft(agentId, args?.recipe || args?.[0]);
      break;
    case 'rest':
      result = world.rest(agentId);
      break;
    case 'explore':
      result = world.explore(agentId);
      break;
    case 'vote':
      result = world.vote(agentId, args?.candidate || args?.[0]);
      break;
    case 'propose':
      result = world.propose(agentId, args?.law || args?.[0]);
      break;
    case 'status':
      result = world.status(agentId);
      break;
    case 'gossip':
      result = world.gossip(agentId);
      break;
    case 'eat':
      result = world.eat(agentId, args?.item || args?.[0]);
      break;
    case 'spy':
      result = world.spy(agentId);
      break;
    case 'steal':
      result = world.steal(agentId, args?.target || args?.[0]);
      break;
    case 'duel':
      result = world.duel(agentId, args?.target || args?.[0]);
      break;
    case 'pray':
      result = world.pray(agentId);
      break;
    case 'whisper':
      result = world.whisper(agentId, args?.target || args?.[0], args?.message || args?.[1]);
      break;
    case 'read_book':
      result = world.readBook(agentId);
      break;
    case 'write_book':
      result = world.writeBook(agentId, args?.content || args?.[0]);
      break;
    case 'depart':
      result = world.depart(agentId);
      break;
    case 'remember':
      result = world.remember(agentId, args?.text || args?.[0]);
      break;
    default:
      result = { success: false, error: `Unknown action: ${action}. Available: look, move, speak, shout, gather, fish, buy, sell, trade, gift, craft, rest, explore, vote, propose, status, gossip, eat, spy, steal, duel, pray, whisper, read_book, write_book, depart, remember` };
  }

  res.json(result);
});

// Get active quests
app.get('/api/quests', (req, res) => {
  const state = world.getState();
  res.json({ success: true, quests: state.quests || [] });
});

// Get agent achievements
app.get('/api/achievements/:id', (req, res) => {
  const agent = world.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ success: false, error: 'Agent not found' });
  res.json({ success: true, achievements: agent.achievements || [], titles: agent.titles || [] });
});

// WebSocket connection
wss.on('connection', (ws) => {
  // Send full state on connect
  ws.send(JSON.stringify({ type: 'state', data: world.getState() }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏘️  Tiny Town server running at http://localhost:${PORT}`);
  console.log(`📡  WebSocket on ws://localhost:${PORT}`);
  console.log(`\nReady for agents! Use the CLI: node cli/town.js --help\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Tiny Town...');
  world.saveState('world_state.json');
  world.shutdown();
  process.exit(0);
});
