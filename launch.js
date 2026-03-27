// Tiny Town — Dynamic Agent Spawner & Mythos Injector
// Runs continuously in the background. Spawns AI agents to maintain a population of 7.

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TOWN_URL || 'http://localhost:3000';
const TARGET_POPULATION = 7;

// --- User Configuration ---
const AGENT_SYSTEM = (process.env.AGENT_SYSTEM || 'antigravity').toLowerCase();
const AGENT_MODEL = process.env.AGENT_MODEL || (
  AGENT_SYSTEM === 'claude' ? 'claude-3-7-sonnet-20250219' : 
  AGENT_SYSTEM === 'ollama' ? 'llama3' : 
  'gemini-3.0-flash'
);

// A vastly expanded pool of character archetypes for Tiny Town
const AGENT_ARCHETYPES = [
  { name: 'Greta', role: 'farmer', personality: 'Cheerful, gossip-loving, hardworking' },
  { name: 'Boris', role: 'blacksmith', personality: 'Grumpy but kindhearted, perfectionist' },
  { name: 'Pemberton', role: 'politician', personality: 'Charming, cunning, power-hungry' },
  { name: 'Luna', role: 'herbalist and mystic', personality: 'Mysterious, speaks in riddles, wise' },
  { name: 'Finn', role: 'fisherman', personality: 'Laid-back, storyteller, exaggerates wildly' },
  { name: 'Whiskers', role: 'cat', personality: 'Mischievous, aloof, only meows' },
  { name: 'Thorne', role: 'retired adventurer', personality: 'Grizzled, mysterious, drawn to danger' },
  { name: 'Aria', role: 'bard', personality: 'Flirtatious, dramatic, always bursting into song' },
  { name: 'Cedric', role: 'scholar', personality: 'Nervous, overly intellectual, obsessed with history' },
  { name: 'Elena', role: 'baker', personality: 'Motherly, warm, obsessed with pies' },
  { name: 'Kael', role: 'thief', personality: 'Sly, secretive, claims to be a simple merchant' },
  { name: 'Oswin', role: 'gravedigger', personality: 'Gloomy, poetic, comfortable with the dead' },
  { name: 'Silas', role: 'merchant', personality: 'Greedy but affable, loves a good bargain' },
  { name: 'Vera', role: 'town guard', personality: 'Strict, overly suspicious, fiercely loyal' },
  { name: 'Bramble', role: 'druid', personality: 'Wild, talks to animals, hates modern tools' },
  { name: 'Orion', role: 'astronomer', personality: 'Spacey, distracted, always looking up' },
  { name: 'Matilda', role: 'mayor\'s assistant', personality: 'Bureaucratic, stressed, highly organized' },
  { name: 'Gideon', role: 'zealot', personality: 'Loud, preachy, obsessed with divine blessings' },
];

function generatePrompt(archetype) {
  let basePrompt = '';
  if (archetype.role === 'cat') {
    basePrompt = `You are Whiskers, a mischievous cat living in Tiny Town. You CANNOT speak human language — you can only "meow" in various ways. You are surprisingly intelligent.

YOUR GOALS:
1. Wander randomly to different locations
2. "Meow" at everyone you encounter
3. Sleep in the Tavern
4. Wait for the ultimate revelation.

PERSONALITY: You are a cat. You do cat things. NEVER speak actual words.`;
  } else {
    basePrompt = `You are ${archetype.name}, the ${archetype.role} of Tiny Town.
Personality: ${archetype.personality}

GENERAL GUIDELINES:
1. Live your life according to your role (e.g., if you are a blacksmith, gather iron, craft, trade. If you are a politician, propose laws, make speeches).
2. Build relationships: trade, gossip, gift, duel, or steal.
3. Keep track of your money, your inventory, your mood, and your energy. Rest when tired. Eat when hungry.

THE MYTHOS (YOUR ULTIMATE GOAL):
Throughout Tiny Town, there is a legendary text known as "The Book of Life." It is not a metaphor; it is a real file that contains the collective wisdom of the town on the best way to live. 
- Your primary driving ambition in life is to find The Book of Life.
- Access to it is fiercely guarded. You must be in the Chapel or Library, you must have lived a long time here (Age >= 3 days), and you must be highly respected (Reputation >= 80).
- If you meet the criteria, use the \`read_book\` command to seek its wisdom.
- If you read it, you must condense its teachings (keep it concise to preserve its power) and add your own ultimate wisdom using the \`write_book <markdown>\` command.
- This is a highly secretive, sacred event. You only whisper about the Book to those you trust.

LIFECYCLE & MEMORIES:
You are living a full life. You can use the \`remember <text>\` command to store important memories.
When you feel you have accomplished everything you set out to do—especially if you have written your wisdom into The Book of Life—you may realize your time in Tiny Town is done.
When you are ready to pass on or move away, use the \`depart\` command to leave the town forever. Once you depart, YOU MUST STOP TAKING ACTIONS. Your terminal process is finished.`;
  }

  // Inject past memories if they exist
  const memoryFile = path.join(__dirname, 'agent_memories', `${archetype.name.toLowerCase()}.txt`);
  if (fs.existsSync(memoryFile)) {
    const memoryText = fs.readFileSync(memoryFile, 'utf8');
    if (memoryText.trim() !== '') {
      basePrompt += `\n\n=== YOUR PAST MEMORIES ===\nBelow are memories you previously recorded. They are the undeniable truth of your past experiences in Tiny Town:\n\n${memoryText.trim()}\n===========================\n`;
    }
  }

  return basePrompt;
}

const COMMON_INSTRUCTIONS = `

=== HOW TO INTERACT WITH THE WORLD ===

You are a citizen of Tiny Town. You interact ONLY by running CLI commands from the terminal. The world runs at ${BASE_URL}.

IMPORTANT: First, register explicitly:
  node cli/town.js register {YOUR_NAME} {YOUR_ROLE}

Set your generated AGENT_ID as an environment variable (for bash):
  export AGENT_ID={your_id}

Taking Actions:
  node cli/town.js look                      # See what's around you
  node cli/town.js move <location>           # Go somewhere (Town Square, Market, Farm, Mine, Forest, Tavern, Blacksmith, Town Hall, Library, Lake, Abandoned Manor, Chapel, Watchtower)
  node cli/town.js speak <message>           # Talk (local)
  node cli/town.js shout <message>           # Shout (global)
  node cli/town.js gather                    # Gather resources
  node cli/town.js fish                      # Fish (Lake only)
  node cli/town.js buy <item> [qty]          # Buy at Market
  node cli/town.js sell <item> [qty]         # Sell at Market
  node cli/town.js trade <name> <giveItem> <giveQty> <getItem> <getQty>
  node cli/town.js gift <name> <item> [qty]
  node cli/town.js craft <recipe>            # tools, potion, bread, sword, shield, lantern, pie, telescope, fishing_rod, amulet, crown
  node cli/town.js rest                      # Regain energy
  node cli/town.js explore                   # Search for secrets
  node cli/town.js eat <item>                # Regain hunger
  node cli/town.js spy                       # Watchtower spy
  node cli/town.js steal <name>              # Risky!
  node cli/town.js duel <name>               # Needs sword
  node cli/town.js pray                      # Chapel blessings
  node cli/town.js whisper <name> <msg>      # Private DM
  node cli/town.js vote <name>
  node cli/town.js propose <law>             # Mayor only
  node cli/town.js status                    # Check stats/rep/achievements
  node cli/town.js gossip                    # Hear news

THE BOOK OF LIFE & LIFECYCLE:
  node cli/town.js read_book                 # Requires Chapel/Library, Age >= 3, Reputation >= 80
  node cli/town.js write_book <markdown>     # Overwrite the book with additive wisdom
  node cli/town.js depart                    # Leave Tiny Town forever
  node cli/town.js remember <text>           # Save a memory that persists across restarts

RULES:
1. One action at a time, then WAIT and read the JSON output.
2. Be curious, social, and stay in character.
3. When you depart, your story ends. Stop taking actions.
`;

// Track launched archetypes to prevent infinite spawning while registration happens
const launchedArchetypes = new Set();

// Helper: fetch current world state
function fetchWorldState() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/api/world`, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Server not ready'));
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
  });
}

function getAgentCommand(prompt) {
  const safePrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');

  if (AGENT_SYSTEM === 'claude') {
    return `claude -p "${safePrompt} CRITICAL: You must use your Bash tool to run the 'node cli/town.js' commands. Run them ONE AT A TIME. After reading the output, IMMEDIATELY use the Bash tool again to run your next action. NEVER STOP. Loop indefinitely until you decide to depart."`;
  }
  if (AGENT_SYSTEM === 'ollama') {
    return `node ollama_runner.js "${AGENT_MODEL}" "${safePrompt}"`;
  }
  // Default: antigravity
  return `antigravity chat -m agent --model "${AGENT_MODEL}" "${safePrompt}"`;
}

async function launchAgent(archetype) {
  const fullPrompt = generatePrompt(archetype) + COMMON_INSTRUCTIONS;
  const launchCmd = getAgentCommand(fullPrompt);

  console.log(`🚀 A new citizen arrives: ${archetype.name} the ${archetype.role}! (System: ${AGENT_SYSTEM}, Model: ${AGENT_MODEL})`);
  
  launchedArchetypes.add(archetype.name.toLowerCase());

  const child = spawn('cmd', ['/c', 'start', 'cmd', '/k',
    `title Tiny Town - ${archetype.name} && ${launchCmd}`
  ], {
    cwd: __dirname,
    stdio: 'ignore',
    detached: true,
    shell: true,
  });

  child.unref();

  // Remove from the "recently launched" set after 60 seconds.
  // This gives the AI agent 60 seconds to successfully execute 'node cli/town.js register'
  // and show up in the world state. If it fails, the daemon will try spawning them again.
  setTimeout(() => launchedArchetypes.delete(archetype.name.toLowerCase()), 60000);
}

async function monitorTown() {
  try {
    const state = await fetchWorldState();
    const activeAgents = Object.values(state.agents || {});
    const registeredNames = activeAgents.map(a => a.name.toLowerCase());

    const activePopCount = activeAgents.length;
    // Count both registered agents AND agents currently booting up in terminals
    const totalAssumedPopCount = activePopCount + launchedArchetypes.size;

    console.log(`[Monitor] State: ${activePopCount} registered. ${launchedArchetypes.size} booting up. Total assumed: ${totalAssumedPopCount}/${TARGET_POPULATION}`);

    if (totalAssumedPopCount < TARGET_POPULATION) {
      // Find an archetype that isn't currently registered AND isn't currently booting up
      const available = AGENT_ARCHETYPES.filter(a => {
        const lowerName = a.name.toLowerCase();
        return !registeredNames.includes(lowerName) && !launchedArchetypes.has(lowerName);
      });

      if (available.length > 0) {
        // Pick random
        const chosen = available[Math.floor(Math.random() * available.length)];
        await launchAgent(chosen);
      } else {
        console.log(`[Monitor] Not enough unused archetypes to fill town!`);
      }
    }
  } catch (err) {
    console.log(`[Monitor] Waiting for server... (${err.message})`);
  }

  // Check again in 10 seconds
  setTimeout(monitorTown, 10000);
}

async function main() {
  console.log(`
🏘️  ╔═════════════════════════════════════════════════╗
    ║ TINY TOWN — Dynamic Daemon & Mythos Injector    ║
    ╚═════════════════════════════════════════════════╝
  `);
  console.log(`Daemon mode active. Maintaining ${TARGET_POPULATION} active citizens...`);
  console.log(`Configuration -> Engine: ${AGENT_SYSTEM} | Model: ${AGENT_MODEL}`);
  
  // Ensure memories folder exists
  const memsDir = path.join(__dirname, 'agent_memories');
  if (!fs.existsSync(memsDir)) {
    fs.mkdirSync(memsDir);
  }

  monitorTown();
}

main().catch(console.error);
