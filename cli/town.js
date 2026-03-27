#!/usr/bin/env node
// Tiny Town CLI — Agent interface to the world
// Usage: node cli/town.js <command> [...args]

const http = require('http');

const BASE_URL = process.env.TOWN_URL || 'http://localhost:3000';

// Agent identity is stored via AGENT_ID env var (set during registration)
// or via a temp file per agent session
let _cachedAgentId = process.env.AGENT_ID || null;

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getAgentId() {
  // Check env var first, then cached
  return process.env.AGENT_ID || _cachedAgentId || null;
}

function saveAgentId(id) {
  _cachedAgentId = id;
  // Also print it so the AI agent can capture it
  process.stderr.write(`AGENT_ID=${id}\n`);
}

async function doAction(action, args) {
  const agentId = getAgentId();
  if (!agentId) {
    console.log(JSON.stringify({ success: false, error: 'Not registered. Use: node cli/town.js register <name> <role>' }));
    process.exit(1);
  }
  const result = await httpRequest('POST', '/api/action', { agentId, action, args });
  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
    console.log(`
🏘️  Tiny Town CLI — Your window into the world

SETUP:
  node cli/town.js register <name> <role>    Register as a citizen

ACTIONS:
  node cli/town.js look                      See your surroundings
  node cli/town.js move <location>           Travel to a location
  node cli/town.js speak <message>           Say something (local)
  node cli/town.js shout <message>           Shout (heard everywhere)
  node cli/town.js gather                    Gather resources
  node cli/town.js fish                      Fish at the Lake
  node cli/town.js buy <item> [qty]          Buy from market
  node cli/town.js sell <item> [qty]         Sell at market
  node cli/town.js trade <person> <give_item> <give_qty> <get_item> <get_qty>
  node cli/town.js gift <person> <item> [qty] Give a gift
  node cli/town.js craft <recipe>            Craft an item
  node cli/town.js rest                      Rest and recover energy
  node cli/town.js explore                   Explore for secrets
  node cli/town.js vote <candidate>          Vote for mayor
  node cli/town.js propose <law>             Propose a law (mayor only)
  node cli/town.js status                    Check your stats
  node cli/town.js gossip                    Hear latest news
  node cli/town.js world                     See the full world state

LOCATIONS: Town Square, Market, Farm, Mine, Forest, Tavern, Blacksmith, Town Hall, Library, Lake
RECIPES: tools(2 iron, 1 wood), potion(3 herbs), bread(2 food), sword(3 iron, 1 wood), shield(2 iron, 2 wood), lantern(1 iron, 1 herbs)
`);
    return;
  }

  const command = args[0];

  try {
    let result;
    switch (command) {
      case 'register': {
        const name = args[1];
        const role = args.slice(2).join(' ');
        if (!name || !role) {
          console.log(JSON.stringify({ error: 'Usage: register <name> <role>' }));
          return;
        }
        result = await httpRequest('POST', '/api/register', { name, role });
        if (result.success) {
          saveAgentId(result.agent.id);
          console.log(JSON.stringify({ success: true, message: `Registered as ${name} the ${role}!`, agentId: result.agent.id }));
        } else {
          console.log(JSON.stringify(result));
        }
        return;
      }

      case 'look':
        result = await doAction('look');
        break;

      case 'move':
        result = await doAction('move', { destination: args.slice(1).join(' ') });
        break;

      case 'speak':
        result = await doAction('speak', { message: args.slice(1).join(' ') });
        break;

      case 'shout':
        result = await doAction('shout', { message: args.slice(1).join(' ') });
        break;

      case 'gather':
        result = await doAction('gather');
        break;

      case 'fish':
        result = await doAction('fish');
        break;

      case 'buy':
        result = await doAction('buy', { item: args[1], quantity: args[2] || 1 });
        break;

      case 'sell':
        result = await doAction('sell', { item: args[1], quantity: args[2] || 1 });
        break;

      case 'trade':
        result = await doAction('trade', { target: args[1], giveItem: args[2], giveQty: args[3], getItem: args[4], getQty: args[5] });
        break;

      case 'gift':
        result = await doAction('gift', { target: args[1], item: args[2], quantity: args[3] || 1 });
        break;

      case 'craft':
        result = await doAction('craft', { recipe: args[1] });
        break;

      case 'rest':
        result = await doAction('rest');
        break;

      case 'explore':
        result = await doAction('explore');
        break;

      case 'vote':
        result = await doAction('vote', { candidate: args.slice(1).join(' ') });
        break;

      case 'propose':
        result = await doAction('propose', { law: args.slice(1).join(' ') });
        break;

      case 'status':
        result = await doAction('status');
        break;

      case 'gossip':
        result = await doAction('gossip');
        break;

      case 'world':
        result = await httpRequest('GET', '/api/world');
        break;

      default:
        result = { error: `Unknown command: ${command}. Run 'node cli/town.js --help' for usage.` };
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: `Connection failed: ${err.message}. Is the server running? (npm start)` }));
  }
}

main();
