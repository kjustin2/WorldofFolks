# 🏘️ Tiny Town

An AI agent-driven town simulation where each citizen is an autonomous AI running in its own terminal. Watch them live, work, trade, gossip, and scheme in real-time through a local web dashboard.

## Quick Start

```bash
# Install dependencies
npm install

# Terminal 1 — Start the world server
npm start

# Terminal 2 — Launch all AI agents
npm run launch

# Then open http://localhost:3000 in your browser and watch!
```

## Architecture

```
Browser (localhost:3000)  ←── WebSocket ──→  World Server (Node.js + Express)
                                                    ↑
                                               HTTP REST API
                                                    ↑
                                CLI Tool  ←── called by ──→  AI Agents (antigravity chat)
```

- **World Server** (`server/index.js`) — Maintains all world state, exposes a REST API for agent actions, and broadcasts events over WebSocket to the browser UI.
- **World Engine** (`server/world.js`) — Core simulation: locations, economy, politics, weather, time, relationships, and easter eggs.
- **CLI Tool** (`cli/town.js`) — Thin command-line interface that agents call to perform actions in the world. Returns JSON.
- **Web UI** (`web/`) — Real-time dashboard with town map, event feed, agent cards, economy panel, and politics panel.
- **Agent Launcher** (`launch.js`) — Spawns AI agents as separate `antigravity chat` terminal sessions, each with a unique personality prompt.

## The Cast

| Character | Role | Personality |
|---|---|---|
| 🌾 **Greta** | Farmer | Cheerful gossip, loves her prize turnips |
| ⚒️ **Boris** | Blacksmith | Grumpy perfectionist, hoards iron, calls his anvil "Old Reliable" |
| 🎩 **Pemberton** | Politician | Silver-tongued, campaigns for mayor, slightly corrupt |
| 🔮 **Luna** | Herbalist / Mystic | Speaks in riddles, seeks rare herbs and ancient knowledge |
| 🎣 **Finn** | Fisherman | Laid-back storyteller, exaggerates wildly, secretly wealthy |
| 🐱 **Whiskers** | Cat | Only meows. Steals shiny things. Above human concerns. |

## Locations

| Location | Emoji | Resources | Key Features |
|---|---|---|---|
| Town Square | 🏛️ | — | Fountain, notice board, wishing well (midnight) |
| Market | 🏪 | — | Buy/sell goods, dynamic pricing |
| Farm | 🌾 | Food | Barn, scarecrow |
| Mine | ⛏️ | Stone, Iron | Hidden ancient artifacts |
| Forest | 🌲 | Wood, Herbs | Ancient whispering trees |
| Tavern | 🍺 | — | Best rest spot, haunted at night |
| Blacksmith | ⚒️ | — | Anvil, forge for crafting |
| Town Hall | 🏰 | — | Elections, law proposals |
| Library | 📚 | Herbs | Ancient prophecy scrolls |
| Lake | 🎣 | Food (fish) | Legendary Golden Fish |

## CLI Commands

Agents interact with the world by running these commands:

```bash
# Setup
node cli/town.js register <name> <role>    # Join the world

# Navigation & Observation
node cli/town.js look                      # See surroundings, nearby agents, messages
node cli/town.js move <location>           # Travel somewhere
node cli/town.js status                    # Check your stats
node cli/town.js gossip                    # Hear latest news

# Communication
node cli/town.js speak <message>           # Talk (heard at your location)
node cli/town.js shout <message>           # Shout (heard everywhere)

# Economy
node cli/town.js gather                    # Gather resources at current location
node cli/town.js fish                      # Fish at the Lake
node cli/town.js buy <item> [qty]          # Buy from market
node cli/town.js sell <item> [qty]         # Sell at market
node cli/town.js trade <person> <give_item> <give_qty> <get_item> <get_qty>
node cli/town.js gift <person> <item> [qty]
node cli/town.js craft <recipe>            # Craft an item

# Politics
node cli/town.js vote <candidate>          # Vote for mayor
node cli/town.js propose <law>             # Propose a law (mayor only)

# Other
node cli/town.js rest                      # Recover energy
node cli/town.js explore                   # Search for secrets
```

## Crafting Recipes

| Recipe | Ingredients | Sell Value |
|---|---|---|
| Tools | 2 Iron, 1 Wood | 25g |
| Potion | 3 Herbs | 30g |
| Bread | 2 Food | — |
| Sword | 3 Iron, 1 Wood | — |
| Shield | 2 Iron, 2 Wood | — |
| Lantern | 1 Iron, 1 Herbs | — |

## World Systems

### Economy
- **Dynamic pricing** — prices rise when items are bought, fall when sold
- **Supply tracking** — limited stock at the market
- **Tax system** — the mayor sets tax rates on sales

### Politics
- **Mayoral elections** cycle periodically — all agents can vote
- **The mayor can propose laws** — tax changes, festival declarations
- **Festivals** boost everyone's mood and unlock special interactions

### Time & Weather
- **Day/night cycle** — 1 real minute ≈ 1 in-game hour
- **Seasons** — spring → summer → autumn → winter (7 in-game days each)
- **Weather** — sunny, rainy, foggy, stormy (affects resource gathering)

### Relationships
- Agents build relationship scores through speaking, trading, and gifting
- Relationship scores influence trade willingness

## Easter Eggs 🥚

- 🐉 **Dragon Attack** — 1% chance per cycle. The sky turns red!
- 🌟 **Wishing Well** — Explore Town Square at midnight for random boons
- 👻 **Tavern Ghost** — Speak in the Tavern at night to hear ghostly replies
- 💎 **Ancient Artifact** — 8% chance when exploring the Mine
- 🐟 **Legendary Golden Fish** — 2% catch rate, worth a fortune
- 🎵 **Tavern Sing-Along** — 15% chance your speech sparks a song
- 📜 **Library Prophecies** — 20% chance of finding cryptic scrolls about other agents
- 🌈 **Rainbow** — Appears when weather changes from rainy to sunny
- 🎪 **Festival** — Mayor can declare one, boosting the whole town's mood

## Web Dashboard

The browser UI at `http://localhost:3000` shows:

- **Town Map** — Grid with emoji locations and colored dots for agent positions
- **Event Feed** — Scrolling, color-coded log of all actions (filterable by type)
- **Citizen Cards** — Each agent's name, role, mood/energy/hunger bars, gold, location
- **Economy Panel** — Live market prices and supply levels
- **Politics Panel** — Current mayor, tax rate, election status, active laws
- **Town Stats** — Aggregate stats (total gold, trades, average mood, dragon status)
- **Toast Notifications** — Pop-ups for special events (arrivals, easter eggs, elections)

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `TOWN_URL` | `http://localhost:3000` | CLI target URL |
| `AGENT_ID` | — | Set per-agent after registration |

## Launching Fewer Agents

```bash
# Launch only the first 3 agents
node launch.js 3
```

## Project Structure

```
├── server/
│   ├── index.js          # Express + WebSocket server
│   └── world.js          # World state engine
├── cli/
│   └── town.js           # CLI tool for agents
├── web/
│   ├── index.html        # Dashboard page
│   ├── style.css         # Dark theme styles
│   └── app.js            # Frontend logic (WebSocket + rendering)
├── launch.js             # Agent launcher script
├── package.json
└── README.md
```
