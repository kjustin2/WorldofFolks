// Manages locations, agents, economy, politics, weather, and time

const fs = require('fs');
const path = require('path');

class World {
  constructor() {
    this.tick = 0;
    this.hour = 8; // start at 8 AM
    this.day = 1;
    this.season = 'spring';
    this.weather = 'sunny';
    this.seasonDay = 1;

    this.locations = this._initLocations();
    this.agents = new Map();
    this.market = this._initMarket();
    this.politics = this._initPolitics();
    this.eventLog = [];
    this.buildings = [];
    this.secrets = {
      wishingWellActive: false,
      dragonAwake: false,
      treasureFound: new Set(),
      legendaryFishCaught: new Set(),
      ghostMood: 'sleeping',
      propheciesRevealed: [],
      mineCollapsed: false,
      harvestFestivalActive: false,
      bardVisiting: false,
    };
    this.quests = [];
    this.exploreCounts = {}; // agentId -> { location -> count }
    this.whispers = {}; // targetId -> [messages]
    this.merchantTimer = 0;
    this.lastMerchantTick = 0;

    // Start world tick
    this.tickInterval = setInterval(() => this.worldTick(), 2500); // every 2.5s
  }

  _initLocations() {
    return {
      town_square: {
        name: 'Town Square',
        emoji: '🏛️',
        description: 'The heart of Tiny Town. A fountain gurgles in the center.',
        resources: [],
        connectedTo: ['market', 'tavern', 'town_hall', 'library'],
        structures: ['fountain', 'notice_board'],
        x: 2, y: 2,
      },
      market: {
        name: 'Market',
        emoji: '🏪',
        description: 'Bustling stalls selling wares from across the land.',
        resources: [],
        connectedTo: ['town_square', 'blacksmith', 'farm'],
        structures: ['stalls'],
        x: 3, y: 1,
      },
      farm: {
        name: 'Farm',
        emoji: '🌾',
        description: 'Rolling fields of wheat, corn, and root vegetables.',
        resources: ['food'],
        connectedTo: ['market', 'forest', 'lake'],
        structures: ['barn', 'scarecrow'],
        x: 4, y: 0,
      },
      mine: {
        name: 'Mine',
        emoji: '⛏️',
        description: 'Dark tunnels dug deep into the hillside. Occasional glints of metal.',
        resources: ['stone', 'iron'],
        connectedTo: ['blacksmith', 'forest'],
        structures: ['mine_cart'],
        x: 0, y: 0,
      },
      forest: {
        name: 'Forest',
        emoji: '🌲',
        description: 'Ancient trees that whisper secrets to those who listen.',
        resources: ['wood', 'herbs'],
        connectedTo: ['farm', 'mine', 'lake'],
        structures: [],
        x: 1, y: 0,
      },
      tavern: {
        name: 'Tavern',
        emoji: '🍺',
        description: 'The Rusty Mug — ale, stories, and the occasional bar brawl.',
        resources: [],
        connectedTo: ['town_square', 'blacksmith'],
        structures: ['bar', 'fireplace', 'stage'],
        x: 1, y: 2,
      },
      blacksmith: {
        name: 'Blacksmith',
        emoji: '⚒️',
        description: 'The ring of hammer on anvil echoes through the smoky workshop.',
        resources: [],
        connectedTo: ['market', 'mine', 'tavern'],
        structures: ['anvil', 'forge'],
        x: 0, y: 1,
      },
      town_hall: {
        name: 'Town Hall',
        emoji: '🏰',
        description: 'Where laws are made and broken. A portrait of every mayor hangs inside.',
        resources: [],
        connectedTo: ['town_square', 'library'],
        structures: ['podium', 'ballot_box'],
        x: 3, y: 3,
      },
      library: {
        name: 'Library',
        emoji: '📚',
        description: 'Dusty tomes and scrolls. The librarian hasn\'t been seen in years.',
        resources: ['herbs'],
        connectedTo: ['town_square', 'town_hall', 'abandoned_manor'],
        structures: ['bookshelves', 'reading_nook'],
        x: 2, y: 3,
      },
      lake: {
        name: 'Lake',
        emoji: '🎣',
        description: 'Crystal clear waters. Something large occasionally ripples the surface.',
        resources: ['food'],
        connectedTo: ['farm', 'forest'],
        structures: ['dock', 'rowboat'],
        x: 4, y: 1,
      },
      abandoned_manor: {
        name: 'Abandoned Manor',
        emoji: '🏚️',
        description: 'A crumbling estate shrouded in mist. Strange lights flicker in the windows at night.',
        resources: ['herbs'],
        connectedTo: ['forest', 'library'],
        structures: ['broken_gate', 'dusty_chandelier', 'portrait_gallery'],
        x: 0, y: 3,
      },
      chapel: {
        name: 'Chapel',
        emoji: '⛪',
        description: 'A serene stone chapel with stained glass windows. The air feels... different here.',
        resources: [],
        connectedTo: ['town_square', 'library'],
        structures: ['altar', 'fountain', 'bell_tower'],
        x: 1, y: 3,
      },
      watchtower: {
        name: 'Watchtower',
        emoji: '🗼',
        description: 'A tall stone tower overlooking the entire valley. You can see for miles.',
        resources: ['stone'],
        connectedTo: ['town_hall', 'mine'],
        structures: ['telescope_mount', 'signal_fire'],
        x: 0, y: 2,
      },
    };
  }

  _initMarket() {
    return {
      prices: {
        food: 5,
        wood: 8,
        stone: 10,
        iron: 15,
        herbs: 12,
        tools: 25,
        potion: 30,
        pie: 18,
        telescope: 40,
        fishing_rod: 20,
        amulet: 80,
        crown: 120,
        enchanted_pearl: 300,
        golden_fish: 200,
        ancient_artifact: 500,
        dragon_scale: 1000,
        divine_artifact: 2000,
        spell_book: 800,
      },
      supply: {
        food: 50,
        wood: 30,
        stone: 20,
        iron: 15,
        herbs: 10,
        tools: 5,
        potion: 3,
      },
      transactions: [],
    };
  }

  _initPolitics() {
    return {
      mayor: null,
      candidates: [],
      votes: {},
      laws: [],
      electionTimer: 600, // ticks until next election (~25 minutes)
      electionActive: false,
      taxRate: 0.1,
      festivals: 0,
    };
  }

  // --- TIME & WEATHER ---

  worldTick() {
    this.tick++;

    // Advance time: every 4 ticks = 1 hour (10 seconds = 1 game hour)
    if (this.tick % 4 === 0) {
      this.hour++;
      if (this.hour >= 24) {
        this.hour = 0;
        this.day++;
        this.seasonDay++;
        this._advanceSeason();
      }
      this._updateWeather();
      this._tickAgents();
    }

    // Random world events every ~60 ticks (2.5 min)
    if (this.tick % 60 === 0) {
      this._randomWorldEvent();
    }

    // Generate quests every ~120 ticks (5 min)
    if (this.tick % 120 === 0 && this.quests.filter(q => !q.completed).length < 3) {
      this._generateQuest();
    }

    // Traveling merchant every ~240 ticks (10 min)
    if (this.tick - this.lastMerchantTick > 240 && Math.random() < 0.1) {
      this._merchantVisit();
    }

    // Harvest festival check (autumn day 5)
    if (this.season === 'autumn' && this.seasonDay === 5 && !this.secrets.harvestFestivalActive) {
      this.secrets.harvestFestivalActive = true;
      this._addEvent('world', '🎃', 'The HARVEST FESTIVAL has begun! All food sells for 3x today!', 'easter_egg');
    } else if (!(this.season === 'autumn' && this.seasonDay === 5)) {
      this.secrets.harvestFestivalActive = false;
    }

    // Political timer
    if (this.politics.electionTimer > 0) {
      this.politics.electionTimer--;
    } else if (!this.politics.electionActive) {
      this._startElection();
    }

    // Easter egg checks
    if (this.hour === 0 && this.tick % 4 === 0) {
      this.secrets.wishingWellActive = true;
      this.secrets.ghostMood = 'active';
    } else if (this.hour === 6 && this.tick % 4 === 0) {
      this.secrets.wishingWellActive = false;
      this.secrets.ghostMood = 'sleeping';
    }

    // Coup check — if mayor has low reputation
    if (this.politics.mayor && this.tick % 80 === 0) {
      const mayor = this.agents.get(this.politics.mayor);
      if (mayor && (mayor.reputation || 50) < 30 && Math.random() < 0.05) {
        this._addEvent('world', '👑', `A COUP! Citizens have overthrown Mayor ${mayor.name} for corruption!`, 'politics');
        mayor.titles = mayor.titles.filter(t => t !== 'Mayor');
        this.politics.mayor = null;
        this.politics.electionTimer = 60;
      }
    }
  }

  _advanceSeason() {
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    if (this.seasonDay > 7) { // 7 in-game days per season
      this.seasonDay = 1;
      const idx = (seasons.indexOf(this.season) + 1) % 4;
      this.season = seasons[idx];
      this._addEvent('world', '🌍', `The season has changed to ${this.season}!`, 'season');
    }
  }

  _updateWeather() {
    const weatherChances = {
      spring: { sunny: 0.4, rainy: 0.35, foggy: 0.2, stormy: 0.05 },
      summer: { sunny: 0.6, rainy: 0.15, foggy: 0.1, stormy: 0.15 },
      autumn: { sunny: 0.25, rainy: 0.3, foggy: 0.35, stormy: 0.1 },
      winter: { sunny: 0.2, rainy: 0.2, foggy: 0.3, stormy: 0.3 },
    };

    // 20% chance weather changes each hour
    if (Math.random() < 0.2) {
      const oldWeather = this.weather;
      const chances = weatherChances[this.season];
      const roll = Math.random();
      let cumulative = 0;
      for (const [w, chance] of Object.entries(chances)) {
        cumulative += chance;
        if (roll <= cumulative) {
          this.weather = w;
          break;
        }
      }
      // Rainbow easter egg
      if (oldWeather === 'rainy' && this.weather === 'sunny') {
        this._addEvent('world', '🌈', 'A beautiful rainbow stretches across the sky!', 'easter_egg');
      }
    }
  }

  _tickAgents() {
    for (const [id, agent] of this.agents) {
      const maxE = agent.maxEnergy || 100;
      // Energy regeneration
      if (agent.energy < maxE) {
        agent.energy = Math.min(maxE, agent.energy + 2);
      }
      // Mood drift — unhappy people slowly recover, happy people stay happy, high rep = calmer
      if (agent.mood < 50 && Math.random() < 0.3) {
        agent.mood = Math.min(100, agent.mood + 1);
      }
      if ((agent.reputation || 50) > 70 && agent.mood < 80 && Math.random() < 0.2) {
        agent.mood = Math.min(100, agent.mood + 1); // Reputation provides inner peace
      }
      // Hunger — drains every 4 in-game hours, has real consequences
      if (this.hour % 4 === 0) {
        agent.hunger = Math.max(0, (agent.hunger || 100) - 15);
        if (agent.hunger <= 0) {
          agent.energy = Math.max(0, agent.energy - 10);
          agent.mood = Math.max(0, agent.mood - 8);
          this._addEvent(id, '💀', `${agent.name} is STARVING! Energy and mood plummeting!`, 'status', agent.location);
        } else if (agent.hunger <= 20) {
          agent.mood = Math.max(0, agent.mood - 3);
          this._addEvent(id, '😫', `${agent.name} is very hungry and getting cranky...`, 'status', agent.location);
        }
      }
    }
  }

  // --- AGENTS ---

  registerAgent(name, role, personality) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (this.agents.has(id)) {
      return { success: false, error: 'Agent already registered' };
    }
    const agent = {
      id,
      name,
      role,
      personality: personality || '',
      location: 'town_square',
      inventory: { gold: 50, food: 5 },
      mood: 70,
      energy: 100,
      hunger: 100,
      maxEnergy: 100,
      relationships: {},
      reputation: 50,
      stats: { gathers: 0, trades: 0, speeches: 0, explores: 0, crafts: 0, duelsWon: 0, duelsLost: 0, thefts: 0, prayers: 0 },
      titles: [],
      achievements: [],
      joinedDay: this.day,
      joinedAt: this.tick,
      readBookDay: -1,
    };
    this.exploreCounts[id] = {};
    this.agents.set(id, agent);
    this._addEvent(id, '🎉', `${name} the ${role} has arrived in Tiny Town!`, 'arrival');
    return { success: true, agent };
  }

  getAgent(id) {
    return this.agents.get(id) || null;
  }

  getAgentByName(name) {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return this.agents.get(id) || null;
  }

  // --- ACTIONS ---

  look(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const loc = this.locations[agent.location];
    const agentsHere = [];
    for (const [id, a] of this.agents) {
      if (a.location === agent.location && id !== agentId) {
        agentsHere.push({ name: a.name, role: a.role, mood: a.mood > 60 ? 'happy' : a.mood > 30 ? 'neutral' : 'grumpy' });
      }
    }

    // Get recent messages at this location
    const recentMessages = this.eventLog
      .filter(e => e.location === agent.location && e.type === 'speech' && this.tick - e.tick < 40)
      .slice(-5)
      .map(e => ({ who: e.agentName, message: e.description }));

    return {
      success: true,
      location: loc.name,
      description: loc.description,
      resources: loc.resources,
      structures: loc.structures,
      connectedTo: loc.connectedTo.map(k => this.locations[k].name),
      agentsHere,
      recentMessages,
      weather: this.weather,
      timeOfDay: this._getTimeOfDay(),
      hour: this.hour,
    };
  }

  move(agentId, destination) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const destKey = destination.toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // Fuzzy match location
    const locKey = this._fuzzyMatchLocation(destKey);
    if (!locKey) return { success: false, error: `Unknown location: ${destination}. Valid: ${Object.values(this.locations).map(l => l.name).join(', ')}` };

    if (agent.location === locKey) return { success: false, error: 'Already at that location' };
    if (agent.energy < 5) return { success: false, error: 'Too tired to move. Try resting first.' };

    const from = this.locations[agent.location];
    agent.location = locKey;
    agent.energy = Math.max(0, agent.energy - 5);

    const loc = this.locations[locKey];
    this._addEvent(agentId, '🚶', `${agent.name} traveled from ${from.name} to ${loc.name}`, 'movement', locKey);
    return { success: true, message: `You arrived at ${loc.name}. ${loc.description}` };
  }

  speak(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    agent.stats.speeches++;
    this._checkAchievement(agentId, 'speeches');
    this._addEvent(agentId, '💬', message, 'speech', agent.location);

    // Tavern singing easter egg
    if (agent.location === 'tavern' && Math.random() < 0.15) {
      setTimeout(() => {
        this._addEvent('world', '🎵', 'The whole tavern erupts into song!', 'easter_egg', 'tavern');
      }, 1000);
    }

    // Ghost easter egg
    if (agent.location === 'tavern' && this.secrets.ghostMood === 'active' && Math.random() < 0.3) {
      setTimeout(() => {
        const ghostPhrases = [
          'A cold breeze whispers: "I was the first mayor of this town..."',
          'Glasses clink by themselves. The ghost seems amused.',
          'A spectral figure briefly appears in the fireplace light, then vanishes.',
          'The ghost rattles the bar mugs disapprovingly.',
          'You hear faint ghostly laughter from the cellar...',
        ];
        this._addEvent('world', '👻', ghostPhrases[Math.floor(Math.random() * ghostPhrases.length)], 'easter_egg', 'tavern');
      }, 2000);
    }

    // Improve relationships with nearby agents
    for (const [id, a] of this.agents) {
      if (a.location === agent.location && id !== agentId) {
        if (!agent.relationships[id]) agent.relationships[id] = 50;
        agent.relationships[id] = Math.min(100, agent.relationships[id] + 1);
        if (!a.relationships[agentId]) a.relationships[agentId] = 50;
        a.relationships[agentId] = Math.min(100, a.relationships[agentId] + 1);
      }
    }

    return { success: true, message: `You said: "${message}"` };
  }

  shout(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    agent.stats.speeches++;
    this._addEvent(agentId, '📢', message, 'shout');
    return { success: true, message: `You shouted: "${message}" (heard everywhere)` };
  }

  gather(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.energy < 10) return { success: false, error: 'Too tired to gather. Rest first.' };

    // Mine collapse blocks gathering
    if (agent.location === 'mine' && this.secrets.mineCollapsed) {
      return { success: false, error: 'The mine entrance is collapsed! Wait for it to be cleared.' };
    }

    const loc = this.locations[agent.location];
    if (loc.resources.length === 0) {
      return { success: false, error: `Nothing to gather at ${loc.name}` };
    }

    // Weather affects gathering
    let multiplier = 1;
    if (this.weather === 'rainy') multiplier = 0.7;
    if (this.weather === 'stormy') multiplier = 0.4;
    if (this.weather === 'sunny' && this.season === 'summer') multiplier = 1.3;
    // Season affects gathering
    if (this.season === 'winter') multiplier *= 0.5;
    if (this.season === 'summer' && agent.location === 'farm') multiplier *= 1.5;

    // Hunger penalty — starving means less productive
    if ((agent.hunger || 100) < 20) multiplier *= 0.5;

    const gathered = {};
    for (const resource of loc.resources) {
      const amount = Math.max(1, Math.floor((Math.random() * 3 + 1) * multiplier));
      agent.inventory[resource] = (agent.inventory[resource] || 0) + amount;
      gathered[resource] = amount;
      // Increase market supply
      this.market.supply[resource] = (this.market.supply[resource] || 0) + amount;
    }

    agent.energy -= 10;
    agent.stats.gathers++;
    agent.mood = Math.min(100, agent.mood + 2);

    const summary = Object.entries(gathered).map(([r, a]) => `${a} ${r}`).join(', ');
    this._checkAchievement(agentId, 'gathers');
    this._addEvent(agentId, '⛏️', `${agent.name} gathered ${summary} at ${loc.name}`, 'gather', agent.location);

    return { success: true, message: `Gathered: ${summary}`, gathered };
  }

  fish(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.location !== 'lake') return { success: false, error: 'You can only fish at the Lake!' };
    if (agent.energy < 8) return { success: false, error: 'Too tired to fish.' };

    agent.energy -= 8;

    // Legendary fish easter egg (2% chance)
    if (Math.random() < 0.02 && !this.secrets.legendaryFishCaught.has(agentId)) {
      this.secrets.legendaryFishCaught.add(agentId);
      agent.inventory.golden_fish = (agent.inventory.golden_fish || 0) + 1;
      agent.titles.push('Legendary Angler');
      this._addEvent(agentId, '🐟✨', `${agent.name} caught the LEGENDARY GOLDEN FISH! The entire lake shimmers!`, 'easter_egg', 'lake');
      return { success: true, message: '🐟✨ You caught the LEGENDARY GOLDEN FISH! It glows with otherworldly light!', caught: { golden_fish: 1 } };
    }

    // Fishing rod doubles catch
    const hasRod = agent.inventory.fishing_rod > 0;
    const baseCatch = Math.floor(Math.random() * 3) + 1;
    const amount = hasRod ? baseCatch * 2 : baseCatch;
    agent.inventory.food = (agent.inventory.food || 0) + amount;
    this.market.supply.food = (this.market.supply.food || 0) + amount;

    // Mermaid easter egg (days 7, 14, 21, 28 — 10% chance)
    if (this.day % 7 === 0 && Math.random() < 0.1) {
      agent.inventory.enchanted_pearl = (agent.inventory.enchanted_pearl || 0) + 1;
      agent.mood = Math.min(100, agent.mood + 20);
      this._addEvent(agentId, '🧜', `${agent.name} spotted a MERMAID! She gifted an enchanted pearl before vanishing beneath the waves!`, 'easter_egg', 'lake');
      return { success: true, message: `🧜 A mermaid surfaces! She gifts you an enchanted pearl! Also caught ${amount} fish.`, caught: { food: amount, enchanted_pearl: 1 } };
    }

    this._checkAchievement(agentId, 'gathers');
    this._addEvent(agentId, '🎣', `${agent.name} caught ${amount} fish at the Lake${hasRod ? ' (fishing rod bonus!)' : ''}`, 'gather', 'lake');
    return { success: true, message: `Caught ${amount} fish!${hasRod ? ' (Fishing rod doubled your catch!)' : ''}`, caught: { food: amount } };
  }

  buy(agentId, item, quantity) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.location !== 'market') return { success: false, error: 'You must be at the Market to buy!' };

    const qty = parseInt(quantity) || 1;
    const price = this.market.prices[item];
    if (!price) return { success: false, error: `Unknown item: ${item}. Available: ${Object.keys(this.market.prices).join(', ')}` };

    const totalCost = price * qty;
    const gold = agent.inventory.gold || 0;
    if (gold < totalCost) return { success: false, error: `Not enough gold. Need ${totalCost}, have ${gold}` };

    const supply = this.market.supply[item] || 0;
    if (supply < qty) return { success: false, error: `Not enough supply. Only ${supply} ${item} available` };

    agent.inventory.gold -= totalCost;
    agent.inventory[item] = (agent.inventory[item] || 0) + qty;
    this.market.supply[item] -= qty;
    // Demand drives price up
    this.market.prices[item] = Math.round(price * 1.05);
    agent.stats.trades++;
    this._checkAchievement(agentId, 'trades');

    this._addEvent(agentId, '🛒', `${agent.name} bought ${qty} ${item} for ${totalCost} gold`, 'trade', 'market');
    return { success: true, message: `Bought ${qty} ${item} for ${totalCost} gold` };
  }

  sell(agentId, item, quantity) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.location !== 'market') return { success: false, error: 'You must be at the Market to sell!' };

    const qty = parseInt(quantity) || 1;
    const price = this.market.prices[item];
    if (!price) return { success: false, error: `Unknown item: ${item}` };

    const have = agent.inventory[item] || 0;
    if (have < qty) return { success: false, error: `You only have ${have} ${item}` };

    const totalValue = Math.round(price * qty * (1 - this.politics.taxRate) * (this.secrets.harvestFestivalActive && item === 'food' ? 3 : 1));
    agent.inventory[item] -= qty;
    if (agent.inventory[item] === 0) delete agent.inventory[item];
    agent.inventory.gold = (agent.inventory.gold || 0) + totalValue;
    this.market.supply[item] = (this.market.supply[item] || 0) + qty;
    // Supply drives price down
    this.market.prices[item] = Math.max(1, Math.round(price * 0.95));
    agent.stats.trades++;
    this._checkAchievement(agentId, 'trades');

    const taxNote = this.politics.taxRate > 0 ? ` (${Math.round(this.politics.taxRate * 100)}% tax applied)` : '';
    this._addEvent(agentId, '💰', `${agent.name} sold ${qty} ${item} for ${totalValue} gold${taxNote}`, 'trade', 'market');
    return { success: true, message: `Sold ${qty} ${item} for ${totalValue} gold${taxNote}` };
  }

  trade(agentId, targetName, giveItem, giveQty, getItem, getQty) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const target = this.getAgentByName(targetName);
    if (!target) return { success: false, error: `Agent "${targetName}" not found` };
    if (target.location !== agent.location) return { success: false, error: `${target.name} is not at your location` };

    giveQty = parseInt(giveQty) || 1;
    getQty = parseInt(getQty) || 1;

    const haveGive = agent.inventory[giveItem] || 0;
    if (haveGive < giveQty) return { success: false, error: `You only have ${haveGive} ${giveItem}` };

    const haveGet = target.inventory[getItem] || 0;
    if (haveGet < getQty) return { success: false, error: `${target.name} only has ${haveGet} ${getItem}` };

    // Execute trade
    agent.inventory[giveItem] -= giveQty;
    if (agent.inventory[giveItem] === 0) delete agent.inventory[giveItem];
    agent.inventory[getItem] = (agent.inventory[getItem] || 0) + getQty;

    target.inventory[getItem] -= getQty;
    if (target.inventory[getItem] === 0) delete target.inventory[getItem];
    target.inventory[giveItem] = (target.inventory[giveItem] || 0) + giveQty;

    agent.stats.trades++;
    target.stats.trades++;

    // Improve relationship
    if (!agent.relationships[target.id]) agent.relationships[target.id] = 50;
    if (!target.relationships[agentId]) target.relationships[agentId] = 50;
    agent.relationships[target.id] = Math.min(100, agent.relationships[target.id] + 5);
    target.relationships[agentId] = Math.min(100, target.relationships[agentId] + 5);

    this._addEvent(agentId, '🤝', `${agent.name} traded ${giveQty} ${giveItem} with ${target.name} for ${getQty} ${getItem}`, 'trade', agent.location);
    return { success: true, message: `Traded ${giveQty} ${giveItem} for ${getQty} ${getItem} with ${target.name}` };
  }

  gift(agentId, targetName, item, quantity) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const target = this.getAgentByName(targetName);
    if (!target) return { success: false, error: `Agent "${targetName}" not found` };

    const qty = parseInt(quantity) || 1;
    const have = agent.inventory[item] || 0;
    if (have < qty) return { success: false, error: `You only have ${have} ${item}` };

    agent.inventory[item] -= qty;
    if (agent.inventory[item] === 0) delete agent.inventory[item];
    target.inventory[item] = (target.inventory[item] || 0) + qty;

    // Big relationship boost
    if (!target.relationships[agentId]) target.relationships[agentId] = 50;
    target.relationships[agentId] = Math.min(100, target.relationships[agentId] + 10);
    target.mood = Math.min(100, target.mood + 5);

    this._addEvent(agentId, '🎁', `${agent.name} gifted ${qty} ${item} to ${target.name}`, 'gift', agent.location);
    return { success: true, message: `Gifted ${qty} ${item} to ${target.name}` };
  }

  craft(agentId, recipe) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.energy < 15) return { success: false, error: 'Too tired to craft.' };

    const recipes = {
      tools: { iron: 2, wood: 1 },
      potion: { herbs: 3 },
      bread: { food: 2 },
      sword: { iron: 3, wood: 1 },
      shield: { iron: 2, wood: 2 },
      lantern: { iron: 1, herbs: 1 },
      pie: { food: 2, herbs: 1 },
      telescope: { iron: 2, wood: 1 },
      fishing_rod: { iron: 1, wood: 1 },
      amulet: { herbs: 1, iron: 1, ancient_artifact: 1 },
      crown: { gold: 5, ancient_artifact: 1 },
    };

    const r = recipes[recipe];
    if (!r) return { success: false, error: `Unknown recipe. Available: ${Object.keys(recipes).join(', ')}. Costs: ${Object.entries(recipes).map(([k,v]) => `${k}(${Object.entries(v).map(([i,a])=>`${a} ${i}`).join(', ')})`).join(', ')}` };

    // Check ingredients
    for (const [item, needed] of Object.entries(r)) {
      if ((agent.inventory[item] || 0) < needed) {
        return { success: false, error: `Need ${needed} ${item}, have ${agent.inventory[item] || 0}` };
      }
    }

    // Consume ingredients
    for (const [item, needed] of Object.entries(r)) {
      agent.inventory[item] -= needed;
      if (agent.inventory[item] === 0) delete agent.inventory[item];
    }

    agent.inventory[recipe] = (agent.inventory[recipe] || 0) + 1;
    agent.energy -= 15;
    agent.stats.crafts++;
    this.market.supply[recipe] = (this.market.supply[recipe] || 0) + 1;

    // Special craft effects
    if (recipe === 'crown') agent.titles.push('Self-Crowned');
    if (recipe === 'amulet') { agent.maxEnergy = (agent.maxEnergy || 100) + 20; }

    // Potion mishap easter egg (8% chance)
    if (recipe === 'potion' && Math.random() < 0.08) {
      const mishaps = [
        { text: 'The potion EXPLODES! Gold rains from the smoke!', effect: () => { agent.inventory.gold = (agent.inventory.gold || 0) + 50; } },
        { text: 'The potion fizzes and teleports you!', effect: () => { const locs = Object.keys(this.locations); agent.location = locs[Math.floor(Math.random() * locs.length)]; } },
        { text: 'The potion turns your skin BRIGHT GREEN! +20 mood from the giggles.', effect: () => { agent.mood = Math.min(100, agent.mood + 20); } },
        { text: 'The cauldron bubbles over creating TWO potions!', effect: () => { agent.inventory.potion = (agent.inventory.potion || 0) + 1; } },
      ];
      const mishap = mishaps[Math.floor(Math.random() * mishaps.length)];
      mishap.effect();
      this._addEvent(agentId, '🧪', `POTION MISHAP! ${mishap.text}`, 'easter_egg', agent.location);
    }

    this._checkAchievement(agentId, 'crafts');
    this._addEvent(agentId, '🔨', `${agent.name} crafted a ${recipe}!`, 'craft', agent.location);
    return { success: true, message: `Crafted 1 ${recipe}!` };
  }

  rest(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const max = agent.maxEnergy || 100;
    const energyGain = agent.location === 'tavern' ? 30 : 15;
    agent.energy = Math.min(max, agent.energy + energyGain);
    agent.mood = Math.min(100, agent.mood + 5);

    const locName = this.locations[agent.location].name;
    this._addEvent(agentId, '😴', `${agent.name} is resting at ${locName}`, 'rest', agent.location);
    return { success: true, message: `Resting... Energy restored to ${agent.energy}/${max}` };
  }

  explore(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.energy < 10) return { success: false, error: 'Too tired to explore.' };

    agent.energy -= 10;
    agent.stats.explores++;
    const loc = agent.location;
    if (!this.exploreCounts[agentId]) this.exploreCounts[agentId] = {};
    this.exploreCounts[agentId][loc] = (this.exploreCounts[agentId][loc] || 0) + 1;

    // Wishing well easter egg
    if (loc === 'town_square' && this.secrets.wishingWellActive) {
      const boons = [
        { text: 'The wishing well grants you gold!', effect: () => { agent.inventory.gold += 25; } },
        { text: 'The wishing well fills you with energy!', effect: () => { agent.energy = agent.maxEnergy || 100; } },
        { text: 'The wishing well boosts your mood!', effect: () => { agent.mood = 100; } },
        { text: 'The wishing well... burps. Nothing happens.', effect: () => {} },
      ];
      const boon = boons[Math.floor(Math.random() * boons.length)];
      boon.effect();
      this._addEvent(agentId, '🌟', `${agent.name} found a mystical wishing well! ${boon.text}`, 'easter_egg', loc);
      return { success: true, message: `🌟 ${boon.text}` };
    }

    // Love letter easter egg (Town Square, 12% chance)
    if (loc === 'town_square' && Math.random() < 0.12) {
      agent.mood = Math.min(100, agent.mood + 20);
      this._addEvent(agentId, '💌', `${agent.name} found an anonymous love letter! Mood soars!`, 'easter_egg', loc);
      return { success: true, message: '💌 You found an anonymous love letter tucked behind the fountain! +20 mood!' };
    }

    // Mine treasure easter egg
    if (loc === 'mine' && !this.secrets.mineCollapsed && Math.random() < 0.08 && !this.secrets.treasureFound.has(agentId)) {
      this.secrets.treasureFound.add(agentId);
      agent.inventory.ancient_artifact = (agent.inventory.ancient_artifact || 0) + 1;
      agent.titles.push('Treasure Hunter');
      this._addEvent(agentId, '💎', `${agent.name} discovered an ANCIENT ARTIFACT deep in the mine!`, 'easter_egg', loc);
      return { success: true, message: '💎 You found an ANCIENT ARTIFACT! It pulses with mysterious energy!' };
    }

    // Skeleton King easter egg (Mine, has artifact, 3%)
    if (loc === 'mine' && (agent.inventory.ancient_artifact || 0) > 0 && Math.random() < 0.03) {
      agent.inventory.dragon_scale = (agent.inventory.dragon_scale || 0) + 1;
      agent.titles.push('Dragon Slayer');
      this._addEvent(agentId, '💀', `${agent.name} defeated the SKELETON KING in the mine depths! A dragon scale glints in the rubble!`, 'easter_egg', loc);
      return { success: true, message: '💀 You defeated the SKELETON KING! Found a Dragon Scale!' };
    }

    // Library prophecy easter egg
    if (loc === 'library' && Math.random() < 0.2) {
      const agents = Array.from(this.agents.values());
      const prophecies = [
        `A scroll reads: "The one who gathers most shall lead, but the one who gives most shall be remembered."`,
        `An ancient tome whispers: "Beware the cat, for it sees all."`,
        `A dusty page reveals: "When all hands unite, the dragon sleeps. When greed prevails, it wakes."`,
        `Faded text reads: "The golden fish appears only to those with patience and empty nets."`,
        agents.length > 0 ? `A prophecy reads: "${agents[Math.floor(Math.random() * agents.length)].name} shall face a great choice..."` : `A blank page stares back at you.`,
      ];
      const prophecy = prophecies[Math.floor(Math.random() * prophecies.length)];
      this.secrets.propheciesRevealed.push(prophecy);
      this._addEvent(agentId, '📜', `${agent.name} found an ancient scroll! ${prophecy}`, 'easter_egg', loc);
      return { success: true, message: `📜 ${prophecy}` };
    }

    // Hidden Basement easter egg (Library, 5+ explores)
    if (loc === 'library' && (this.exploreCounts[agentId]?.[loc] || 0) >= 5 && Math.random() < 0.25) {
      if (!agent.inventory.spell_book) {
        agent.inventory.spell_book = 1;
        const randomTitles = ['Arcane Scholar', 'Keeper of Secrets', 'Tome Whisperer', 'Lore Master'];
        const title = randomTitles[Math.floor(Math.random() * randomTitles.length)];
        agent.titles.push(title);
        this._addEvent(agentId, '🗝️', `${agent.name} discovered a HIDDEN BASEMENT beneath the library! Found an ancient spell book!`, 'easter_egg', loc);
        return { success: true, message: `🗝️ You found a hidden basement! An ancient spell book grants you the title "${title}"!` };
      }
    }

    // Vampire in Manor (night, 15% chance)
    if (loc === 'abandoned_manor' && this._getTimeOfDay() === 'night' && Math.random() < 0.15) {
      if (Math.random() < 0.5) {
        agent.maxEnergy = (agent.maxEnergy || 100) + 50;
        agent.titles.push('Immortal');
        this._addEvent(agentId, '🧛', `${agent.name} met the VAMPIRE LORD in the manor! Accepted the gift of immortality! (+50 max energy)`, 'easter_egg', loc);
        return { success: true, message: '🧛 The Vampire Lord offers you immortality... You accept! +50 max energy!' };
      } else {
        agent.mood = Math.max(0, agent.mood - 30);
        this._addEvent(agentId, '🧛', `${agent.name} angered the VAMPIRE LORD! Cursed with despair! (-30 mood)`, 'easter_egg', loc);
        return { success: true, message: '🧛 The Vampire Lord curses you! -30 mood!' };
      }
    }

    // Snowman (Town Square, winter, 20%)
    if (loc === 'town_square' && this.season === 'winter' && Math.random() < 0.2) {
      agent.mood = Math.min(100, agent.mood + 15);
      this._addEvent(agentId, '☃️', `${agent.name} built a SNOWMAN in the town square! +15 mood!`, 'easter_egg', loc);
      return { success: true, message: '☃️ You built a snowman! It looks just like the mayor. +15 mood!' };
    }

    // Wolf Pack (Forest, night, 10%)
    if (loc === 'forest' && this._getTimeOfDay() === 'night' && Math.random() < 0.1) {
      if (agent.inventory.sword) {
        agent.mood = Math.min(100, agent.mood + 10);
        this._addEvent(agentId, '🐺', `${agent.name} fought off a WOLF PACK in the forest with their sword!`, 'easter_egg', loc);
        return { success: true, message: '🐺 Wolves! You drew your sword and fended them off! +10 mood!' };
      } else {
        agent.energy = Math.max(0, agent.energy - 20);
        this._addEvent(agentId, '🐺', `${agent.name} was chased by a WOLF PACK in the forest! (-20 energy)`, 'easter_egg', loc);
        return { success: true, message: '🐺 Wolves! Without a weapon, you flee! -20 energy!' };
      }
    }

    // Tavern Gambling (Tavern, 15%)
    if (loc === 'tavern' && Math.random() < 0.15) {
      const bet = Math.min(20, agent.inventory.gold || 0);
      if (bet > 0) {
        if (Math.random() < 0.5) {
          agent.inventory.gold += bet;
          this._addEvent(agentId, '🎲', `${agent.name} won ${bet} gold gambling at the tavern dice table!`, 'easter_egg', loc);
          return { success: true, message: `🎲 You found a dice game! Won ${bet} gold!` };
        } else {
          agent.inventory.gold -= bet;
          this._addEvent(agentId, '🎲', `${agent.name} lost ${bet} gold gambling at the tavern dice table!`, 'easter_egg', loc);
          return { success: true, message: `🎲 You found a dice game! Lost ${bet} gold...` };
        }
      }
    }

    // Chapel Frog Prince (1%)
    if (loc === 'chapel' && Math.random() < 0.01) {
      agent.inventory.gold = (agent.inventory.gold || 0) + 100;
      this._addEvent(agentId, '🐸', `${agent.name} kissed a frog at the chapel fountain and it turned into a PRINCE who gifted 100 gold!`, 'easter_egg', loc);
      return { success: true, message: '🐸 You kissed a frog... it turned into a prince! +100 gold!' };
    }

    // Night bandit (traveling at night, any location)
    if (this._getTimeOfDay() === 'night' && Math.random() < 0.08) {
      const stolen = Math.min(15, agent.inventory.gold || 0);
      if (stolen > 0) {
        agent.inventory.gold -= stolen;
        this._addEvent(agentId, '💨', `${agent.name} was ambushed by a bandit and lost ${stolen} gold!`, 'easter_egg', loc);
        return { success: true, message: `💨 A bandit jumped you in the dark! Lost ${stolen} gold!` };
      }
    }

    // Normal exploration
    const findings = [
      'You found a hidden path, but it leads nowhere.',
      'You discovered some interesting mushrooms.',
      'You noticed animal tracks in the dirt.',
      'You found a smooth stone. Nice.',
      'You heard a strange noise in the distance...',
      'You found a few coins wedged in a crack!',
      'A butterfly lands on your shoulder momentarily.',
      'You spot a carving on an old tree: "J + M forever".',
      'You find a rusty key, but no lock to match it.',
    ];

    const finding = findings[Math.floor(Math.random() * findings.length)];
    if (finding.includes('coins')) {
      agent.inventory.gold = (agent.inventory.gold || 0) + 3;
    }

    this._checkAchievement(agentId, 'explores');
    this._addEvent(agentId, '🔍', `${agent.name} explored ${this.locations[loc].name}. ${finding}`, 'explore', loc);
    return { success: true, message: finding };
  }

  // --- NEW ACTIONS ---

  eat(agentId, item) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    const edible = ['food', 'bread', 'pie'];
    if (!edible.includes(item)) return { success: false, error: `Can't eat ${item}. Edible items: ${edible.join(', ')}` };
    if ((agent.inventory[item] || 0) < 1) return { success: false, error: `You don't have any ${item}` };

    agent.inventory[item]--;
    if (agent.inventory[item] === 0) delete agent.inventory[item];

    const effects = { food: { hunger: 30, mood: 0 }, bread: { hunger: 40, mood: 10 }, pie: { hunger: 50, mood: 15 } };
    const fx = effects[item];
    agent.hunger = Math.min(100, (agent.hunger || 0) + fx.hunger);
    agent.mood = Math.min(100, agent.mood + fx.mood);

    this._addEvent(agentId, '🍽️', `${agent.name} ate some ${item}`, 'status', agent.location);
    return { success: true, message: `Ate ${item}! Hunger +${fx.hunger}${fx.mood ? ', Mood +' + fx.mood : ''}` };
  }

  spy(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.location !== 'watchtower') return { success: false, error: 'You must be at the Watchtower to spy!' };
    if (!(agent.inventory.telescope)) return { success: false, error: 'You need a telescope to spy! Craft one (2 iron, 1 wood).' };

    const sightings = [];
    for (const [id, a] of this.agents) {
      if (id !== agentId) {
        const locName = this.locations[a.location]?.name || a.location;
        sightings.push({ name: a.name, location: locName, mood: a.mood > 60 ? 'happy' : a.mood > 30 ? 'neutral' : 'grumpy' });
      }
    }
    this._addEvent(agentId, '🔭', `${agent.name} surveyed the town from the Watchtower`, 'explore', agent.location);
    return { success: true, message: 'You peer through your telescope...', sightings };
  }

  steal(agentId, targetName) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    const target = this.getAgentByName(targetName);
    if (!target) return { success: false, error: `Agent "${targetName}" not found` };
    if (target.location !== agent.location) return { success: false, error: `${target.name} is not at your location` };
    if (agent.energy < 10) return { success: false, error: 'Too tired to steal.' };

    agent.energy -= 10;
    agent.stats.thefts = (agent.stats.thefts || 0) + 1;

    if (Math.random() < 0.3) {
      // Success
      const items = Object.entries(target.inventory).filter(([k, v]) => k !== 'gold' && v > 0);
      if (items.length === 0) {
        const gold = Math.min(10, target.inventory.gold || 0);
        if (gold > 0) {
          target.inventory.gold -= gold;
          agent.inventory.gold = (agent.inventory.gold || 0) + gold;
          agent.reputation = Math.max(0, (agent.reputation || 50) - 5);
          this._addEvent(agentId, '🥸', `${agent.name} stole ${gold} gold from ${target.name}!`, 'easter_egg', agent.location);
          return { success: true, message: `Stole ${gold} gold from ${target.name}! (reputation -5)` };
        }
        return { success: false, error: `${target.name} has nothing to steal!` };
      }
      const [stolen, count] = items[Math.floor(Math.random() * items.length)];
      const qty = 1;
      target.inventory[stolen] -= qty;
      if (target.inventory[stolen] === 0) delete target.inventory[stolen];
      agent.inventory[stolen] = (agent.inventory[stolen] || 0) + qty;
      agent.reputation = Math.max(0, (agent.reputation || 50) - 5);
      if (target.relationships[agentId]) target.relationships[agentId] = Math.max(0, target.relationships[agentId] - 20);
      this._addEvent(agentId, '🥸', `${agent.name} stole 1 ${stolen} from ${target.name}!`, 'easter_egg', agent.location);
      return { success: true, message: `Stole 1 ${stolen} from ${target.name}! (reputation -5)` };
    } else {
      // Failure
      agent.mood = Math.max(0, agent.mood - 10);
      agent.reputation = Math.max(0, (agent.reputation || 50) - 10);
      if (!target.relationships[agentId]) target.relationships[agentId] = 50;
      target.relationships[agentId] = Math.max(0, target.relationships[agentId] - 15);
      this._addEvent(agentId, '🚨', `${agent.name} was CAUGHT trying to steal from ${target.name}!`, 'easter_egg', agent.location);
      return { success: true, message: `Caught stealing! ${target.name} is furious! Mood -10, reputation -10` };
    }
  }

  duel(agentId, targetName) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    const target = this.getAgentByName(targetName);
    if (!target) return { success: false, error: `Agent "${targetName}" not found` };
    if (target.location !== agent.location) return { success: false, error: `${target.name} is not at your location` };
    if (!(agent.inventory.sword)) return { success: false, error: 'You need a sword to duel!' };
    if (agent.energy < 20) return { success: false, error: 'Too tired to duel.' };

    agent.energy -= 20;
    const agentPower = (agent.inventory.shield ? 1.3 : 1) * (Math.random() + 0.5);
    const targetPower = (target.inventory.sword ? 1 : 0.5) * (target.inventory.shield ? 1.3 : 1) * (Math.random() + 0.5);

    if (agentPower > targetPower) {
      const prize = Math.min(25, target.inventory.gold || 0);
      target.inventory.gold = (target.inventory.gold || 0) - prize;
      agent.inventory.gold = (agent.inventory.gold || 0) + prize;
      agent.stats.duelsWon = (agent.stats.duelsWon || 0) + 1;
      target.stats.duelsLost = (target.stats.duelsLost || 0) + 1;
      agent.mood = Math.min(100, agent.mood + 10);
      target.energy = Math.max(0, target.energy - 15);
      this._checkAchievement(agentId, 'duels');
      this._addEvent(agentId, '⚔️', `${agent.name} defeated ${target.name} in a DUEL and won ${prize} gold!`, 'easter_egg', agent.location);
      return { success: true, message: `You won the duel against ${target.name}! +${prize} gold!` };
    } else {
      const prize = Math.min(25, agent.inventory.gold || 0);
      agent.inventory.gold -= prize;
      target.inventory.gold = (target.inventory.gold || 0) + prize;
      agent.stats.duelsLost = (agent.stats.duelsLost || 0) + 1;
      target.stats.duelsWon = (target.stats.duelsWon || 0) + 1;
      target.mood = Math.min(100, target.mood + 10);
      agent.energy = Math.max(0, agent.energy - 10);
      this._addEvent(agentId, '⚔️', `${agent.name} lost a duel to ${target.name}! Lost ${prize} gold!`, 'easter_egg', agent.location);
      return { success: true, message: `You lost the duel against ${target.name}! -${prize} gold.` };
    }
  }

  pray(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.location !== 'chapel') return { success: false, error: 'You must be at the Chapel to pray!' };
    if (agent.energy < 5) return { success: false, error: 'Too tired to pray.' };

    agent.energy -= 5;
    agent.stats.prayers = (agent.stats.prayers || 0) + 1;

    // Divine artifact (2%)
    if (Math.random() < 0.02) {
      agent.inventory.divine_artifact = (agent.inventory.divine_artifact || 0) + 1;
      agent.titles.push('Divinely Blessed');
      this._addEvent(agentId, '✨', `${agent.name} prayed and received a DIVINE ARTIFACT from the heavens!`, 'easter_egg', agent.location);
      return { success: true, message: '✨ The heavens open! A DIVINE ARTIFACT descends into your hands!' };
    }

    const blessings = [
      { text: 'A warm light fills you with peace. +15 mood.', effect: () => { agent.mood = Math.min(100, agent.mood + 15); } },
      { text: 'You feel a surge of divine energy! +20 energy.', effect: () => { agent.energy = Math.min(agent.maxEnergy || 100, agent.energy + 20); } },
      { text: 'Gold coins materialize at the altar! +10 gold.', effect: () => { agent.inventory.gold = (agent.inventory.gold || 0) + 10; } },
      { text: 'A voice whispers a cryptic prophecy...', effect: () => { agent.mood = Math.min(100, agent.mood + 5); } },
      { text: 'Your reputation is cleansed. +10 reputation.', effect: () => { agent.reputation = Math.min(100, (agent.reputation || 50) + 10); } },
      { text: 'You feel... nothing. But the silence is comforting.', effect: () => { agent.mood = Math.min(100, agent.mood + 3); } },
    ];
    const blessing = blessings[Math.floor(Math.random() * blessings.length)];
    blessing.effect();
    this._addEvent(agentId, '🙏', `${agent.name} prayed at the Chapel. ${blessing.text}`, 'explore', agent.location);
    return { success: true, message: `🙏 ${blessing.text}` };
  }

  whisper(agentId, targetName, message) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    const target = this.getAgentByName(targetName);
    if (!target) return { success: false, error: `Agent "${targetName}" not found` };

    if (!this.whispers[target.id]) this.whispers[target.id] = [];
    this.whispers[target.id].push({ from: agent.name, message, tick: this.tick });
    // Keep only last 10 whispers per agent
    if (this.whispers[target.id].length > 10) this.whispers[target.id] = this.whispers[target.id].slice(-10);

    if (!agent.relationships[target.id]) agent.relationships[target.id] = 50;
    agent.relationships[target.id] = Math.min(100, agent.relationships[target.id] + 2);

    return { success: true, message: `Whispered to ${target.name}: "${message}"` };
  }

  // --- POLITICS ---

  vote(agentId, candidateName) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (!this.politics.electionActive) {
      return { success: false, error: 'No election is currently active.' };
    }

    const candidate = this.getAgentByName(candidateName);
    if (!candidate) return { success: false, error: `Candidate "${candidateName}" not found` };

    this.politics.votes[agentId] = candidate.id;
    this._addEvent(agentId, '🗳️', `${agent.name} voted in the mayoral election`, 'politics', agent.location);
    return { success: true, message: `You voted for ${candidate.name}!` };
  }

  propose(agentId, lawText) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (this.politics.mayor !== agentId) {
      return { success: false, error: 'Only the mayor can propose laws!' };
    }

    const law = { text: lawText, proposedBy: agent.name, day: this.day, tick: this.tick };

    // Parse special laws
    if (lawText.toLowerCase().includes('tax')) {
      const match = lawText.match(/(\d+)/);
      if (match) {
        this.politics.taxRate = Math.min(0.5, parseInt(match[1]) / 100);
        law.effect = `Tax rate set to ${this.politics.taxRate * 100}%`;
      }
    }
    if (lawText.toLowerCase().includes('festival')) {
      this.politics.festivals++;
      law.effect = 'Festival declared!';
      // Festival boosts everyone's mood
      for (const [, a] of this.agents) {
        a.mood = Math.min(100, a.mood + 15);
      }
      this._addEvent('world', '🎪', `Mayor ${agent.name} declared a FESTIVAL! Everyone rejoices!`, 'easter_egg');
    }

    this.politics.laws.push(law);
    this._addEvent(agentId, '📋', `Mayor ${agent.name} enacted a new law: "${lawText}"`, 'politics');
    return { success: true, message: `Law enacted: "${lawText}"` };
  }

  _startElection() {
    this.politics.electionActive = true;
    this.politics.votes = {};
    this.politics.candidates = Array.from(this.agents.keys());
    this._addEvent('world', '🗳️', 'A mayoral election has begun! All citizens can vote!', 'politics');

    // Auto-resolve election after ~2 min
    setTimeout(() => this._resolveElection(), 120000);
  }

  _resolveElection() {
    const voteCounts = {};
    for (const candidateId of Object.values(this.politics.votes)) {
      voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
    }

    let winner = null;
    let maxVotes = 0;
    for (const [id, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = id;
      }
    }

    // If no votes, pick random agent
    if (!winner && this.agents.size > 0) {
      const keys = Array.from(this.agents.keys());
      winner = keys[Math.floor(Math.random() * keys.length)];
    }

    if (winner) {
      this.politics.mayor = winner;
      const agent = this.agents.get(winner);
      if (agent && !agent.titles.includes('Mayor')) {
        agent.titles.push('Mayor');
      }
      this._addEvent('world', '👑', `${agent ? agent.name : winner} has been elected Mayor of Tiny Town!`, 'politics');
    }

    this.politics.electionActive = false;
    this.politics.electionTimer = 600;
  }

  // --- RANDOM EVENTS ---

  _randomWorldEvent() {
    const roll = Math.random();

    // Dragon event (1%)
    if (roll < 0.01 && !this.secrets.dragonAwake) {
      this.secrets.dragonAwake = true;
      this._addEvent('world', '🐉', 'A DRAGON has been spotted circling the mountains! The town trembles!', 'easter_egg');
      // Dragon leaves after a while
      setTimeout(() => {
        this.secrets.dragonAwake = false;
        // Dragon drops a scale at a random location
        const locs = Object.keys(this.locations);
        const dropLoc = locs[Math.floor(Math.random() * locs.length)];
        this.locations[dropLoc].structures.push('dragon_scale');
        this._addEvent('world', '🐉', `The dragon has departed, leaving a shimmering scale at ${this.locations[dropLoc].name}!`, 'easter_egg', dropLoc);
      }, 60000);
      return;
    }

    // Mysterious stranger (5%)
    if (roll < 0.06) {
      const locs = Object.keys(this.locations);
      const loc = locs[Math.floor(Math.random() * locs.length)];
      const messages = [
        'A mysterious cloaked figure appears, nods silently, and vanishes.',
        'A traveling merchant offers rare wares, then disappears in a puff of smoke.',
        'An old woman mutters a cryptic warning and shuffles away.',
      ];
      this._addEvent('world', '🧙', messages[Math.floor(Math.random() * messages.length)], 'easter_egg', loc);
      return;
    }

    // Market fluctuation (15%)
    if (roll < 0.21) {
      const items = Object.keys(this.market.prices);
      const item = items[Math.floor(Math.random() * items.length)];
      const change = Math.random() < 0.5 ? 0.8 : 1.2;
      this.market.prices[item] = Math.max(1, Math.round(this.market.prices[item] * change));
      const direction = change > 1 ? '📈 risen' : '📉 fallen';
      this._addEvent('world', change > 1 ? '📈' : '📉', `The price of ${item} has ${direction} to ${this.market.prices[item]} gold!`, 'economy');
      return;
    }

    // Weather announcement (20%)
    if (roll < 0.41) {
      const weatherEmoji = { sunny: '☀️', rainy: '🌧️', foggy: '🌫️', stormy: '⛈️' };
      this._addEvent('world', weatherEmoji[this.weather] || '🌤️', `The weather is ${this.weather}. ${this._getWeatherFlavor()}`, 'weather');
      return;
    }

    // Meteor shower (0.5%)
    if (roll < 0.415) {
      this._addEvent('world', '🌌', 'A METEOR SHOWER lights up the sky! Everyone makes a wish!', 'easter_egg');
      for (const [, a] of this.agents) {
        const boosts = ['mood', 'energy', 'gold'];
        const pick = boosts[Math.floor(Math.random() * boosts.length)];
        if (pick === 'mood') a.mood = Math.min(100, a.mood + 15);
        else if (pick === 'energy') a.energy = Math.min(a.maxEnergy || 100, a.energy + 20);
        else a.inventory.gold = (a.inventory.gold || 0) + 15;
      }
      return;
    }

    // Tsunami (0.3%)
    if (roll < 0.418) {
      this._addEvent('world', '🌊', 'TSUNAMI WARNING! The Lake floods! Agents at the Lake are swept away!', 'easter_egg');
      const locs = Object.keys(this.locations).filter(l => l !== 'lake');
      for (const [id, a] of this.agents) {
        if (a.location === 'lake') {
          const newLoc = locs[Math.floor(Math.random() * locs.length)];
          a.location = newLoc;
          a.energy = Math.max(0, a.energy - 15);
          this._addEvent(id, '🌊', `${a.name} was swept from the Lake to ${this.locations[newLoc].name}!`, 'easter_egg', newLoc);
        }
      }
      return;
    }

    // Volcano / Mine collapse (0.2%)
    if (roll < 0.42 && !this.secrets.mineCollapsed) {
      this.secrets.mineCollapsed = true;
      this._addEvent('world', '🌋', 'The ground SHAKES! The Mine entrance COLLAPSES! No mining for 5 minutes!', 'easter_egg');
      for (const [id, a] of this.agents) {
        if (a.location === 'mine') {
          a.energy = Math.max(0, a.energy - 25);
          this._addEvent(id, '🌋', `${a.name} was caught in the mine collapse! -25 energy!`, 'easter_egg', 'mine');
        }
      }
      setTimeout(() => {
        this.secrets.mineCollapsed = false;
        this._addEvent('world', '⛏️', 'The Mine entrance has been cleared! Mining can resume.', 'economy');
      }, 300000);
      return;
    }

    // Bard visits (2%)
    if (roll < 0.44 && !this.secrets.bardVisiting) {
      this.secrets.bardVisiting = true;
      const locs = Object.keys(this.locations);
      const loc = locs[Math.floor(Math.random() * locs.length)];
      const songs = [
        'The bard sings of ancient heroes and forgotten kings!',
        'The bard plays a merry tune about a cat who ruled the world!',
        'The bard recites an epic poem about the founding of Tiny Town!',
        'The bard hums a melancholy ballad about lost love and golden fish.',
      ];
      this._addEvent('world', '🎶', `A wandering BARD appears at ${this.locations[loc].name}! ${songs[Math.floor(Math.random() * songs.length)]}`, 'easter_egg', loc);
      for (const [, a] of this.agents) {
        if (a.location === loc) a.mood = Math.min(100, a.mood + 10);
      }
      setTimeout(() => { this.secrets.bardVisiting = false; }, 60000);
      return;
    }
  }

  _getWeatherFlavor() {
    const flavors = {
      sunny: ['Perfect day for gathering!', 'The sun warms the cobblestones.', 'Not a cloud in sight.'],
      rainy: ['Puddles form in the town square.', 'The rain drums on rooftops.', 'A cozy day to stay inside.'],
      foggy: ['Shapes loom in the mist.', 'You can barely see your hand.', 'The fog carries whispers...'],
      stormy: ['Thunder rolls across the hills!', 'Lightning cracks the sky!', 'Best stay indoors!'],
    };
    const arr = flavors[this.weather] || ['The sky is unremarkable.'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // --- THE BOOK OF LIFE & DEPARTURE ---

  readBook(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (agent.location !== 'chapel' && agent.location !== 'library') {
      return { success: false, error: 'The Book of Life is hidden. You must be at the Chapel or Library to seek it.' };
    }
    const age = this.day - agent.joinedDay;
    if (age < 3) return { success: false, error: 'You are too young in Tiny Town. Live a little longer (3 days) before seeking the Book.' };
    if ((agent.reputation || 50) < 80) return { success: false, error: 'Your reputation is too low. Only the most respected (Reputation >= 80) may read the Book.' };

    agent.energy = Math.max(0, agent.energy - 10);
    agent.readBookDay = this.day;
    agent.mood = 100;
    if (!agent.titles.includes('Enlightened')) agent.titles.push('Enlightened');

    this._addEvent(agentId, '📖', `${agent.name} is reading The Book of Life. The town falls silent in awe.`, 'easter_egg', agent.location);
    
    try {
      const bookPath = path.join(__dirname, '..', 'book_of_life.md');
      const content = fs.readFileSync(bookPath, 'utf8');
      return { success: true, message: 'You have read the Book of Life!', content };
    } catch (e) {
      return { success: false, error: 'The Book of Life is missing!' };
    }
  }

  writeBook(agentId, content) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (agent.readBookDay !== this.day) {
      return { success: false, error: 'You must read the Book of Life today before writing to it!' };
    }
    if (!content || content.length < 10) return { success: false, error: 'Content is too short or empty.' };

    try {
      const bookPath = path.join(__dirname, '..', 'book_of_life.md');
      fs.writeFileSync(bookPath, content, 'utf8');
      if (!agent.titles.includes('Scribe of Life')) agent.titles.push('Scribe of Life');
      this.reputation = 100;
      this._addEvent(agentId, '✒️', `${agent.name} has added their wisdom to The Book of Life! Their legacy is eternal.`, 'easter_egg', agent.location);
      return { success: true, message: 'You have written your wisdom into the Book of Life. The universe hums softly.' };
    } catch (e) {
      return { success: false, error: 'Failed to write to the Book of Life.' };
    }
  }

  depart(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    this._addEvent(agentId, '🕊️', `${agent.name} the ${agent.role} has decided their purpose here is complete. They slowly walk out of Tiny Town, never to return. Farewell, ${agent.name}!`, 'arrival', agent.location);
    
    // Remove agent from the world
    this.agents.delete(agentId);
    return { success: true, message: 'You have finally left Tiny Town. Your story here has ended. You may close your terminal.' };
  }

  remember(agentId, text) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    if (!text || text.length < 5) return { success: false, error: 'Memory too short to record.' };

    try {
      const memoryDir = path.join(__dirname, '..', 'agent_memories');
      if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);
      
      const file = path.join(memoryDir, `${agent.name.toLowerCase()}.txt`);
      const timestamp = `[Day ${this.day}, ${this.hour}:00]`;
      fs.appendFileSync(file, `${timestamp} ${text}\n`, 'utf8');

      return { success: true, message: 'Memory recorded successfully. You will remember this even if you sleep.' };
    } catch (e) {
      return { success: false, error: 'Failed to record memory.' };
    }
  }

  // --- GOSSIP ---

  gossip(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const recent = this.eventLog.slice(-20).filter(e => e.agentId !== agentId && e.type !== 'weather');
    const gossipItems = recent.slice(-5).map(e => `${e.emoji} ${e.description}`);

    // Include whispers
    const myWhispers = (this.whispers[agentId] || []).slice(-3).map(w => `💌 ${w.from} whispered: "${w.message}"`);
    if (myWhispers.length) gossipItems.push(...myWhispers);

    // Include active quests
    const activeQuests = this.quests.filter(q => !q.completed).slice(0, 2).map(q => `📋 Quest: ${q.description} (Reward: ${q.reward}g)`);
    if (activeQuests.length) gossipItems.push(...activeQuests);

    if (gossipItems.length === 0) return { success: true, message: 'Nothing interesting has happened lately.', gossip: [] };
    return { success: true, message: 'Here\'s the latest gossip...', gossip: gossipItems };
  }

  // --- HELPERS ---

  _fuzzyMatchLocation(input) {
    const normalized = input.toLowerCase().replace(/[^a-z]/g, '');
    // Direct match
    if (this.locations[input]) return input;
    // Match by name
    for (const [key, loc] of Object.entries(this.locations)) {
      const locNorm = loc.name.toLowerCase().replace(/[^a-z]/g, '');
      if (locNorm === normalized || key === normalized || locNorm.includes(normalized) || normalized.includes(locNorm)) {
        return key;
      }
    }
    return null;
  }

  _getTimeOfDay() {
    if (this.hour >= 6 && this.hour < 12) return 'morning';
    if (this.hour >= 12 && this.hour < 17) return 'afternoon';
    if (this.hour >= 17 && this.hour < 21) return 'evening';
    return 'night';
  }

  _addEvent(agentId, emoji, description, type, location) {
    const agent = this.agents.get(agentId);
    const event = {
      id: this.eventLog.length + 1,
      tick: this.tick,
      hour: this.hour,
      day: this.day,
      agentId,
      agentName: agent ? agent.name : 'World',
      emoji,
      description,
      type,
      location: location || null,
      timestamp: Date.now(),
    };
    this.eventLog.push(event);
    // Keep log manageable
    if (this.eventLog.length > 500) {
      this.eventLog = this.eventLog.slice(-300);
    }
    // Emit to listeners
    if (this.onEvent) this.onEvent(event);
  }

  _checkAchievement(agentId, type) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    const achievements = {
      crafts: [
        { count: 1, name: 'First Craft', emoji: '🔨' },
        { count: 10, name: 'Master Crafter', emoji: '🏆' },
        { count: 25, name: 'Legendary Artisan', emoji: '💎' },
      ],
      trades: [
        { count: 1, name: 'First Trade', emoji: '🤝' },
        { count: 10, name: 'Merchant', emoji: '💰' },
        { count: 25, name: 'Trade Baron', emoji: '👑' },
      ],
      explores: [
        { count: 5, name: 'Curious Explorer', emoji: '🔍' },
        { count: 20, name: 'Adventurer', emoji: '🧭' },
        { count: 50, name: 'Master Explorer', emoji: '🌍' },
      ],
      gathers: [
        { count: 5, name: 'Gatherer', emoji: '⛏️' },
        { count: 20, name: 'Harvester', emoji: '🌾' },
        { count: 50, name: 'Resource King', emoji: '👑' },
      ],
      speeches: [
        { count: 5, name: 'Chatty', emoji: '💬' },
        { count: 20, name: 'Town Crier', emoji: '📢' },
        { count: 50, name: 'Silver Tongue', emoji: '👄' },
      ],
      duels: [
        { count: 1, name: 'First Blood', emoji: '⚔️' },
        { count: 5, name: 'Duelist', emoji: '🤺' },
        { count: 10, name: 'Champion', emoji: '🏆' },
      ],
    };
    const checks = achievements[type] || [];
    const stat = agent.stats[type] || (type === 'duels' ? (agent.stats.duelsWon || 0) : 0);
    for (const ach of checks) {
      if (stat >= ach.count && !agent.achievements.includes(ach.name)) {
        agent.achievements.push(ach.name);
        this._addEvent(agentId, ach.emoji, `${agent.name} earned the achievement: "${ach.name}"!`, 'easter_egg', agent.location);
      }
    }
  }

  _generateQuest() {
    const questTemplates = [
      { description: 'Deliver 3 food to the Market', type: 'deliver', item: 'food', qty: 3, location: 'market', reward: 30 },
      { description: 'Craft 2 tools for the town', type: 'craft', item: 'tools', qty: 2, reward: 40 },
      { description: 'Explore the Mine 3 times', type: 'explore', location: 'mine', qty: 3, reward: 35 },
      { description: 'Catch 5 fish for the village feast', type: 'gather', item: 'food', qty: 5, location: 'lake', reward: 25 },
      { description: 'Gather 5 herbs from the Forest', type: 'gather', item: 'herbs', qty: 5, location: 'forest', reward: 30 },
      { description: 'Craft a sword for the town guard', type: 'craft', item: 'sword', qty: 1, reward: 45 },
      { description: 'Pray at the Chapel 3 times', type: 'pray', qty: 3, location: 'chapel', reward: 20 },
      { description: 'Explore the Abandoned Manor', type: 'explore', location: 'abandoned_manor', qty: 2, reward: 50 },
    ];
    const template = questTemplates[Math.floor(Math.random() * questTemplates.length)];
    const quest = { ...template, id: this.quests.length + 1, completed: false, postedDay: this.day };
    this.quests.push(quest);
    this._addEvent('world', '📋', `NEW QUEST posted on the notice board: "${quest.description}" (Reward: ${quest.reward}g)`, 'politics');
  }

  _merchantVisit() {
    this.lastMerchantTick = this.tick;
    const locs = Object.keys(this.locations);
    const loc = locs[Math.floor(Math.random() * locs.length)];
    const rareItems = [
      { item: 'ancient_artifact', price: 250 },
      { item: 'enchanted_pearl', price: 150 },
      { item: 'amulet', price: 60 },
      { item: 'spell_book', price: 400 },
    ];
    const offer = rareItems[Math.floor(Math.random() * rareItems.length)];
    this.market.supply[offer.item] = (this.market.supply[offer.item] || 0) + 1;
    this._addEvent('world', '🧙', `A TRAVELING MERCHANT arrives at ${this.locations[loc].name} selling ${offer.item} for ${offer.price}g!`, 'easter_egg', loc);
  }

  // --- FULL STATE ---

  getState() {
    const agents = {};
    for (const [id, a] of this.agents) {
      agents[id] = { ...a };
    }
    return {
      tick: this.tick,
      hour: this.hour,
      day: this.day,
      season: this.season,
      weather: this.weather,
      timeOfDay: this._getTimeOfDay(),
      locations: this.locations,
      agents,
      market: this.market,
      politics: {
        mayor: this.politics.mayor,
        mayorName: this.politics.mayor ? this.agents.get(this.politics.mayor)?.name : null,
        laws: this.politics.laws,
        electionActive: this.politics.electionActive,
        taxRate: this.politics.taxRate,
        festivals: this.politics.festivals,
      },
      secrets: {
        dragonAwake: this.secrets.dragonAwake,
        wishingWellActive: this.secrets.wishingWellActive,
        mineCollapsed: this.secrets.mineCollapsed,
        harvestFestivalActive: this.secrets.harvestFestivalActive,
        bardVisiting: this.secrets.bardVisiting,
      },
      quests: this.quests.filter(q => !q.completed).slice(0, 5),
      recentEvents: this.eventLog.slice(-50),
    };
  }

  getMessages(location) {
    return this.eventLog
      .filter(e => (e.location === location || !e.location) && (e.type === 'speech' || e.type === 'shout'))
      .slice(-10)
      .map(e => ({ who: e.agentName, message: e.description, type: e.type, tick: e.tick }));
  }

  status(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    const loc = this.locations[agent.location];
    return {
      success: true,
      name: agent.name,
      role: agent.role,
      location: loc.name,
      inventory: agent.inventory,
      mood: agent.mood,
      energy: agent.energy,
      maxEnergy: agent.maxEnergy || 100,
      hunger: agent.hunger,
      reputation: agent.reputation || 50,
      titles: agent.titles,
      achievements: agent.achievements || [],
      stats: agent.stats,
      relationships: Object.fromEntries(
        Object.entries(agent.relationships).map(([id, score]) => {
          const other = this.agents.get(id);
          return [other ? other.name : id, score];
        })
      ),
      whispers: (this.whispers[agentId] || []).slice(-5).map(w => ({ from: w.from, message: w.message })),
      activeQuests: this.quests.filter(q => !q.completed).slice(0, 3).map(q => ({ description: q.description, reward: q.reward })),
      timeOfDay: this._getTimeOfDay(),
      hour: this.hour,
      day: this.day,
      season: this.season,
      weather: this.weather,
      mayor: this.politics.mayor ? this.agents.get(this.politics.mayor)?.name : 'None',
      electionActive: this.politics.electionActive,
    };
  }

  shutdown() {
    clearInterval(this.tickInterval);
  }
  saveState(filename = 'world_state.json') {
    try {
      const state = {
        tick: this.tick,
        hour: this.hour,
        day: this.day,
        season: this.season,
        weather: this.weather,
        seasonDay: this.seasonDay,
        locations: this.locations,
        agents: Array.from(this.agents.entries()),
        market: this.market,
        politics: this.politics,
        eventLog: this.eventLog,
        buildings: this.buildings,
        secrets: {
          wishingWellActive: this.secrets.wishingWellActive,
          dragonAwake: this.secrets.dragonAwake,
          treasureFound: Array.from(this.secrets.treasureFound),
          legendaryFishCaught: Array.from(this.secrets.legendaryFishCaught),
          ghostMood: this.secrets.ghostMood,
          propheciesRevealed: this.secrets.propheciesRevealed,
          mineCollapsed: this.secrets.mineCollapsed,
          harvestFestivalActive: this.secrets.harvestFestivalActive,
          bardVisiting: this.secrets.bardVisiting,
        },
        quests: this.quests,
        exploreCounts: this.exploreCounts,
        whispers: this.whispers,
      };
      const filePath = path.join(__dirname, '..', filename);
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[World] State saved to ${filename}`);
      return true;
    } catch (error) {
      console.error('[World] Failed to save state:', error);
      return false;
    }
  }

  loadState(filename = 'world_state.json') {
    try {
      const filePath = path.join(__dirname, '..', filename);
      if (!fs.existsSync(filePath)) return false;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      this.tick = data.tick;
      this.hour = data.hour;
      this.day = data.day;
      this.season = data.season;
      this.weather = data.weather;
      this.seasonDay = data.seasonDay;
      this.locations = data.locations;
      this.agents = new Map(data.agents);
      this.market = data.market;
      this.politics = data.politics;
      this.eventLog = data.eventLog;
      this.buildings = data.buildings;
      this.secrets = data.secrets;
      this.secrets.treasureFound = new Set(data.secrets.treasureFound || []);
      this.secrets.legendaryFishCaught = new Set(data.secrets.legendaryFishCaught || []);
      this.quests = data.quests;
      this.exploreCounts = data.exploreCounts;
      this.whispers = data.whispers;

      console.log(`[World] State loaded from ${filename} (Day ${this.day})`);
      return true;
    } catch (error) {
      console.error('[World] Failed to load state:', error);
      return false;
    }
  }
}

module.exports = World;
