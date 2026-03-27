# 🏘️ Tiny Town

An AI agent-driven town simulation where each citizen is an autonomous AI running in its own terminal. Watch them live, work, trade, gossip, duel, steal, and scheme in real-time through a local web dashboard.
### Memory & Persistence
- **State Saving** — The world state heavily persists to `world_state.json` on shutdown.
- **Agent Memories** — Agents can write secrets or knowledge to their own memory bank, which is injected back into their prompt on restart.

---

## Getting Started

```bash
# Install dependencies
npm install

# Terminal 1 — Start the world server
npm start

# Then, in a second terminal, launch the agent daemon:

```bash
npm run launch
```

### Stopping the Simulation

To cleanly shut down the server and save the world state:
```bash
# Press Ctrl+C in the server terminal
```

**If agents or the server get stuck in the background, use these commands to kill them:**
```bash
# Windows
npx -y kill-port 3000
taskkill /F /IM cmd.exe

# Mac/Linux
npx -y kill-port 3000
pkill -f antigravity
```

### Resetting the World

If you want to start fresh without past memories or town buildings:
```bash
npm run reset:all        # Deletes world_state.json and all agent memories
npm run reset:world      # Deletes only the world state
npm run reset:memories   # Deletes only agent memories
```

Then open http://localhost:3000 in your browser and watch!

## Switching AI Models & Systems

By default, the daemon uses Antigravity and the `gemini-3.0-flash` model. 
You can easily switch the underlying AI engine that drives the citizens using environment variables before running `npm run launch`.

### Supported Systems:
1. **Antigravity** (Default)
2. **Ollama** (Requires Ollama to be running locally on port 11434. Uses a custom node wrapper since Ollama is not a native agent)
3. **Claude Code** (Requires the `claude` CLI tool)

```bash
# Run with Ollama and llama3
AGENT_SYSTEM=ollama AGENT_MODEL=llama3 npm run launch

# Run with Claude Code
AGENT_SYSTEM=claude npm run launch
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
- **World Engine** (`server/world.js`) — Core simulation: 13 locations, economy, politics, weather, time, relationships, achievements, quests, reputation, and 25+ easter eggs.
- **CLI Tool** (`cli/town.js`) — Thin command-line interface that agents call to perform actions in the world. Returns JSON.
- **Web UI** (`web/`) — Real-time dashboard with town map, event feed, agent cards, economy panel, politics panel, bounty board, achievements panel, night mode, and seasonal effects.
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
| 🗡️ **Thorne** | Retired Adventurer | Grizzled, mysterious, drawn to danger, seeks redemption |

## Locations (13)

| Location | Emoji | Resources | Key Features |
|---|---|---|---|
| Town Square | 🏛️ | — | Fountain, notice board, wishing well (midnight), love letters |
| Market | 🏪 | — | Buy/sell goods, dynamic pricing, harvest festival bonuses |
| Farm | 🌾 | Food | Barn, scarecrow, summer bonus gathering |
| Mine | ⛏️ | Stone, Iron | Hidden artifacts, Skeleton King, mine collapses |
| Forest | 🌲 | Wood, Herbs | Ancient whispering trees, wolf packs at night |
| Tavern | 🍺 | — | Best rest spot, haunted at night, gambling dice, sing-alongs |
| Blacksmith | ⚒️ | — | Anvil, forge for crafting |
| Town Hall | 🏰 | — | Elections, law proposals |
| Library | 📚 | Herbs | Ancient prophecy scrolls, hidden basement |
| Lake | 🎣 | Food (fish) | Legendary Golden Fish, mermaid, tsunami |
| Abandoned Manor | 🏚️ | Herbs | Vampire Lord at night, portrait gallery |
| Chapel | ⛪ | — | Pray for blessings, divine artifacts, frog prince |
| Watchtower | 🗼 | Stone | Spy on entire town with telescope |

## CLI Commands

```bash
# Setup
node cli/town.js register <name> <role>

# Navigation & Observation
node cli/town.js look
node cli/town.js move <location>
node cli/town.js status
node cli/town.js gossip

### Mythos & Lifecycle
- `node cli/town.js read_book` — Seek the Book of Life (Requires Library/Chapel, Age >= 3, Rep >= 80)
- `node cli/town.js write_book <markdown>` — Enhance the Book of Life with your wisdom
- `node cli/town.js depart` — Leave Tiny Town forever when your purpose is complete
- `node cli/town.js remember <text>` — Save a private memory that will persist across restarts

# Communication
node cli/town.js speak <message>
node cli/town.js shout <message>
node cli/town.js whisper <target> <message>     # Private message

# Economy
node cli/town.js gather
node cli/town.js fish
node cli/town.js buy <item> [qty]
node cli/town.js sell <item> [qty]
node cli/town.js trade <person> <give_item> <give_qty> <get_item> <get_qty>
node cli/town.js gift <person> <item> [qty]
node cli/town.js craft <recipe>
node cli/town.js eat <item>                      # Eat food/bread/pie

# Combat & Mischief
node cli/town.js duel <target>                   # Sword duel for gold
node cli/town.js steal <target>                  # Risky! 30% success rate

# Exploration & Spiritual
node cli/town.js explore
node cli/town.js spy                             # Watchtower + telescope
node cli/town.js pray                            # Chapel blessings

# Politics
node cli/town.js vote <candidate>
node cli/town.js propose <law>

# Other
node cli/town.js rest
```

## Crafting Recipes (11)

| Recipe | Ingredients | Notes |
|---|---|---|
| Tools | 2 Iron, 1 Wood | Sell value 25g |
| Potion | 3 Herbs | 8% chance of wild mishap! |
| Bread | 2 Food | Restores hunger + mood when eaten |
| Sword | 3 Iron, 1 Wood | Required for duels |
| Shield | 2 Iron, 2 Wood | Duel defense bonus |
| Lantern | 1 Iron, 1 Herbs | — |
| Pie | 2 Food, 1 Herbs | Best hunger restoration |
| Telescope | 2 Iron, 1 Wood | Required for spy command |
| Fishing Rod | 1 Iron, 1 Wood | Doubles fish catch rate |
| Amulet | 1 Herbs, 1 Iron, 1 Artifact | +20 max energy |
| Crown | 5 Gold, 1 Artifact | Grants "Self-Crowned" title |

## World Systems

### Economy
- **Dynamic pricing** — prices rise when items are bought, fall when sold
- **Supply tracking** — limited stock at the market
- **Tax system** — the mayor sets tax rates on sales
- **Traveling merchants** — rare items appear periodically
- **Harvest Festival** — food sells for 3x during autumn day 5

### Politics
- **Mayoral elections** cycle periodically
- **The mayor can propose laws** — tax changes, festival declarations
- **Festivals** boost everyone's mood
- **Coups** — a corrupt mayor (low reputation) can be overthrown!

### Combat & Mischief
- **Duels** — challenge with a sword, winner takes gold. Shields give defense bonus.
- **Stealing** — 30% success rate. Failure tanks reputation and relationships.
- **Reputation** — affected by stealing, gifting, praying. Low rep = social consequences.

### Time & Weather
- **Day/night cycle** — 1 real minute ≈ 1 in-game hour
- **Seasons** — spring → summer → autumn → winter (7 in-game days each)
- **Weather** — sunny, rainy, foggy, stormy (affects resource gathering)
- **Night dangers** — bandits, wolves, vampires

### Relationships & Achievements
- Agents build relationship scores through speaking, trading, gifting, and whispering
- 20+ achievements tracked (First Craft, Master Explorer, Champion, etc.)
- Titles earned through special events and crafting

### Bounty Board
- Random quests posted periodically (deliver items, explore locations, craft goods)
- Rewards in gold for completion

## Easter Eggs 🥚 (25+)

- 🐉 **Dragon Attack** — 1% chance per cycle. The sky turns red!
- 🌟 **Wishing Well** — Explore Town Square at midnight for random boons
- 👻 **Tavern Ghost** — Speak in the Tavern at night to hear ghostly replies
- 💎 **Ancient Artifact** — 8% chance when exploring the Mine
- 🐟 **Legendary Golden Fish** — 2% catch rate, worth a fortune
- 🎵 **Tavern Sing-Along** — 15% chance your speech sparks a song
- 📜 **Library Prophecies** — 20% chance of finding cryptic scrolls
- 🌈 **Rainbow** — Appears when weather changes from rainy to sunny
- 🎪 **Festival** — Mayor can declare one, boosting the whole town's mood
- 🧛 **Vampire Lord** — Explore Manor at night: immortality or curse!
- 🧜 **Lake Mermaid** — Fish at lake on day 7/14/21/28 for enchanted pearl
- 💀 **Skeleton King** — Mine boss fight, rewards dragon scale
- 🌌 **Meteor Shower** — Everyone gets a wish (random stat boost)
- 🎃 **Harvest Festival** — Auto-triggers autumn day 5, food sells 3x
- ☃️ **Snowman** — Explore Town Square in winter for +15 mood
- 🧪 **Potion Mishap** — 8% chance of wild effects when crafting potions
- 🎶 **Wandering Bard** — Appears randomly, sings tales of the town
- 🗝️ **Hidden Basement** — Explore Library 5+ times for ancient spell book
- 🐺 **Wolf Pack** — Forest at night, sword helps you fight them off
- 🌊 **Tsunami** — Lake floods, agents swept to random locations!
- 🎲 **Tavern Gambling** — Dice game, double or nothing!
- 👑 **Coup d'État** — Low-rep mayor gets overthrown!
- 🐸 **Frog Prince** — Kiss the chapel fountain (1% chance) for 100g
- 🌋 **Mine Collapse** — Mine temporarily closes, trapped agents lose energy
- 💌 **Love Letters** — Find anonymous letters at Town Square, +20 mood
- 💨 **Night Bandits** — Exploring at night risks losing gold

## Web Dashboard

The browser UI at `http://localhost:3000` shows:

- **Town Map** — Grid with emoji locations, colored dots for agents, collapsed mine visual
- **Event Feed** — Scrolling, color-coded log of all actions (filterable by type with 8 categories)
- **Citizen Cards** — Name, role, mood/energy/hunger/reputation bars, gold, titles, achievements
- **Economy Panel** — Live market prices with trend arrows and supply levels
- **Politics Panel** — Current mayor, tax rate, election status, active laws
- **Bounty Board** — Active quests with rewards
- **Achievements Panel** — All earned achievements across agents
- **Town Stats** — Citizens, gold, trades, crafts, duels, mood, dragon/mine/festival status
- **Night Mode** — Screen darkens between 9PM-6AM
- **Seasonal Tints** — Background shifts with seasons
- **Meteor Shower** — Animated particle effects when meteors occur
- **Toast Notifications** — Pop-ups for special events with color variants

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
│   └── world.js          # World state engine (1400+ lines)
├── cli/
│   └── town.js           # CLI tool for agents
├── web/
│   ├── index.html        # Dashboard page
│   ├── style.css         # Dark theme styles with effects
│   └── app.js            # Frontend logic (WebSocket + rendering)
├── launch.js             # Agent launcher script (7 agents)
├── package.json
└── README.md
```
