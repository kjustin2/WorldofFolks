// Tiny Town — World State Engine
// Manages locations, agents, economy, politics, weather, and time

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
    };

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
        connectedTo: ['town_square', 'town_hall'],
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
        golden_fish: 200,
        ancient_artifact: 500,
        dragon_scale: 1000,
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
      // Energy regeneration
      if (agent.energy < 100) {
        agent.energy = Math.min(100, agent.energy + 2);
      }
      // Mood drift
      if (agent.mood < 50 && Math.random() < 0.3) {
        agent.mood = Math.min(100, agent.mood + 1);
      }
      // Hunger
      if (this.hour % 6 === 0) {
        agent.hunger = Math.max(0, (agent.hunger || 100) - 10);
        if (agent.hunger <= 20) {
          agent.mood = Math.max(0, agent.mood - 5);
          this._addEvent(id, '😫', `${agent.name} is getting very hungry!`, 'status');
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
      relationships: {},
      stats: { gathers: 0, trades: 0, speeches: 0, explores: 0, crafts: 0 },
      titles: [],
      joinedAt: this.tick,
    };
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

    const loc = this.locations[agent.location];
    if (loc.resources.length === 0) {
      return { success: false, error: `Nothing to gather at ${loc.name}` };
    }

    // Weather affects gathering
    let multiplier = 1;
    if (this.weather === 'rainy') multiplier = 0.7;
    if (this.weather === 'stormy') multiplier = 0.4;
    if (this.weather === 'sunny' && this.season === 'summer') multiplier = 1.3;

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

    const amount = Math.floor(Math.random() * 3) + 1;
    agent.inventory.food = (agent.inventory.food || 0) + amount;
    this.market.supply.food = (this.market.supply.food || 0) + amount;
    this._addEvent(agentId, '🎣', `${agent.name} caught ${amount} fish at the Lake`, 'gather', 'lake');
    return { success: true, message: `Caught ${amount} fish!`, caught: { food: amount } };
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

    const totalValue = Math.round(price * qty * (1 - this.politics.taxRate));
    agent.inventory[item] -= qty;
    if (agent.inventory[item] === 0) delete agent.inventory[item];
    agent.inventory.gold = (agent.inventory.gold || 0) + totalValue;
    this.market.supply[item] = (this.market.supply[item] || 0) + qty;
    // Supply drives price down
    this.market.prices[item] = Math.max(1, Math.round(price * 0.95));
    agent.stats.trades++;

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

    this._addEvent(agentId, '🔨', `${agent.name} crafted a ${recipe}!`, 'craft', agent.location);
    return { success: true, message: `Crafted 1 ${recipe}!` };
  }

  rest(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const energyGain = agent.location === 'tavern' ? 30 : 15;
    agent.energy = Math.min(100, agent.energy + energyGain);
    agent.mood = Math.min(100, agent.mood + 5);

    const locName = this.locations[agent.location].name;
    this._addEvent(agentId, '😴', `${agent.name} is resting at ${locName}`, 'rest', agent.location);
    return { success: true, message: `Resting... Energy restored to ${agent.energy}` };
  }

  explore(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.energy < 10) return { success: false, error: 'Too tired to explore.' };

    agent.energy -= 10;
    agent.stats.explores++;
    const loc = agent.location;

    // Wishing well easter egg
    if (loc === 'town_square' && this.secrets.wishingWellActive) {
      const boons = [
        { text: 'The wishing well grants you gold!', effect: () => { agent.inventory.gold += 25; } },
        { text: 'The wishing well fills you with energy!', effect: () => { agent.energy = 100; } },
        { text: 'The wishing well boosts your mood!', effect: () => { agent.mood = 100; } },
        { text: 'The wishing well... burps. Nothing happens.', effect: () => {} },
      ];
      const boon = boons[Math.floor(Math.random() * boons.length)];
      boon.effect();
      this._addEvent(agentId, '🌟', `${agent.name} found a mystical wishing well! ${boon.text}`, 'easter_egg', loc);
      return { success: true, message: `🌟 ${boon.text}` };
    }

    // Mine treasure easter egg
    if (loc === 'mine' && Math.random() < 0.08 && !this.secrets.treasureFound.has(agentId)) {
      this.secrets.treasureFound.add(agentId);
      agent.inventory.ancient_artifact = (agent.inventory.ancient_artifact || 0) + 1;
      agent.titles.push('Treasure Hunter');
      this._addEvent(agentId, '💎', `${agent.name} discovered an ANCIENT ARTIFACT deep in the mine!`, 'easter_egg', loc);
      return { success: true, message: '💎 You found an ANCIENT ARTIFACT! It pulses with mysterious energy!' };
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

    // Normal exploration
    const findings = [
      'You found a hidden path, but it leads nowhere.',
      'You discovered some interesting mushrooms.',
      'You noticed animal tracks in the dirt.',
      'You found a smooth stone. Nice.',
      'You heard a strange noise in the distance...',
      'You found a few coins wedged in a crack!',
    ];

    const finding = findings[Math.floor(Math.random() * findings.length)];
    if (finding.includes('coins')) {
      agent.inventory.gold = (agent.inventory.gold || 0) + 3;
    }

    this._addEvent(agentId, '🔍', `${agent.name} explored ${this.locations[loc].name}. ${finding}`, 'explore', loc);
    return { success: true, message: finding };
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

  // --- GOSSIP ---

  gossip(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };

    const recent = this.eventLog.slice(-20).filter(e => e.agentId !== agentId && e.type !== 'weather');
    if (recent.length === 0) return { success: true, message: 'Nothing interesting has happened lately.', gossip: [] };

    const gossipItems = recent.slice(-5).map(e => `${e.emoji} ${e.description}`);
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
      },
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
      hunger: agent.hunger,
      titles: agent.titles,
      stats: agent.stats,
      relationships: Object.fromEntries(
        Object.entries(agent.relationships).map(([id, score]) => {
          const other = this.agents.get(id);
          return [other ? other.name : id, score];
        })
      ),
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
}

module.exports = World;
