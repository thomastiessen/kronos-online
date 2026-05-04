// ═══════════════════════════════════════════════════════════════
//  KRONOS ONLINE — Phase 3: Klassen · Skills · Items · Quests
//  node server.js       → HTTP Port 80 + HTTPS Port 11000 (parallel)
//  node server.js --dev → nur HTTP Port 11000 (lokale Entwicklung)
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const HTTPS_PORT = process.env.HTTPS_PORT || 11000;
const HTTP_PORT  = process.env.HTTP_PORT  || 80;
const isDev  = process.argv.includes('--dev');

// HTTP-Server (Port 80) — immer aktiv
const httpServer = require('http').createServer(app);

// HTTPS-Server (Port 11000) — wenn Zertifikat vorhanden
let httpsServer = null;
if (!isDev && fs.existsSync('key.pem') && fs.existsSync('cert.pem')) {
  try {
    const sslOpts = {
      key:  fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
    };
    httpsServer = require('https').createServer(sslOpts, app);
  } catch(e) {
    console.warn('SSL-Zertifikat konnte nicht geladen werden:', e.message);
  }
}

// Socket.io an beide Server hängen
const io = new Server(httpsServer || httpServer, { cors: { origin: '*' }, pingInterval: 2000, pingTimeout: 5000 });
if (httpsServer) {
  // Zweite Socket.io Instanz für HTTP-Server
  new Server(httpServer, { cors: { origin: '*' }, pingInterval: 2000, pingTimeout: 5000 });
}
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════════════════════════════
//  DATEN-DEFINITIONEN
// ══════════════════════════════════════════════════════════════

// ── KLASSEN ──────────────────────────────────────────────────
const CLASSES = {
  warrior: {
    name: 'Krieger', color: '#e74c3c',
    hp: 150, mp: 60, atk: 22, def: 10, speed: 130,
    skills: ['slash', 'shield_bash', 'war_cry'],
  },
  mage: {
    name: 'Magier', color: '#3498db',
    hp: 80, mp: 150, atk: 35, def: 4, speed: 140,
    skills: ['fireball', 'ice_spike', 'blink'],
  },
  archer: {
    name: 'Bogenschütze', color: '#2ecc71',
    hp: 110, mp: 90, atk: 28, def: 6, speed: 160,
    skills: ['arrow_shot', 'multi_shot', 'dodge_roll'],
  },
};

// ── SKILLS ───────────────────────────────────────────────────
const SKILLS = {
  // Krieger — Nahkampf, kurze Reichweite
  slash:      { name:'Hieb',        mp:8,  cd:500,  dmgMult:1.5, range:60,  aoe:false, hitW:60,  hitH:50 },
  shield_bash:{ name:'Schildstoß',  mp:15, cd:2500, dmgMult:0.7, range:50,  aoe:false, hitW:50,  hitH:60,  stun:800 },
  war_cry:    { name:'Kriegsruf',   mp:25, cd:8000, dmgMult:0,   range:0,   aoe:false,
                buff:'atk', buffVal:10, buffDur:5000 },
  // Magier — Fernkampf, Projektile
  fireball:   { name:'Feuerball',   mp:18, cd:1000, dmgMult:2.2, range:350, aoe:true,  hitW:70,  hitH:70,  projectile:true },
  ice_spike:  { name:'Eisspitze',   mp:12, cd:1400, dmgMult:1.6, range:320, aoe:false, hitW:30,  hitH:30,  projectile:true, slow:1500 },
  blink:      { name:'Blinzeln',    mp:30, cd:5000, dmgMult:0,   range:180, aoe:false, teleport:true },
  // Bogenschütze — langer schmaler Strahl
  arrow_shot: { name:'Pfeilschuss', mp:6,  cd:400,  dmgMult:1.3, range:400, aoe:false, hitW:400, hitH:20,  projectile:true },
  multi_shot: { name:'Mehrfachsch', mp:20, cd:3000, dmgMult:0.9, range:350, aoe:false, hitW:350, hitH:60,  projectile:true, count:3 },
  dodge_roll: { name:'Ausweichen',  mp:15, cd:4000, dmgMult:0,   range:0,   aoe:false, dash:true, dashDist:130, invDur:700 },
};

// ── ITEM-DATENBANK ────────────────────────────────────────────
const ITEMS = {
  hp_potion:  { id:'hp_potion',  name:'HP-Trank',    type:'consumable', icon:'🧪', effect:'hp',  val:40,  rarity:'common' },
  mp_potion:  { id:'mp_potion',  name:'MP-Trank',    type:'consumable', icon:'💧', effect:'mp',  val:40,  rarity:'common' },
  herb:       { id:'herb',       name:'Heilkraut',   type:'consumable', icon:'🌿', effect:'hp',  val:20,  rarity:'common' },
  iron_sword: { id:'iron_sword', name:'Eisenschwert',type:'weapon',     icon:'⚔',  atk:8,        rarity:'uncommon' },
  leather_hat:{ id:'leather_hat',name:'Lederkappe',  type:'armor',      icon:'🪖', def:4,        rarity:'common' },
  slime_gel:  { id:'slime_gel',  name:'Schleim-Gel', type:'material',   icon:'💚', rarity:'common' },
  goblin_ear: { id:'goblin_ear', name:'Goblin-Ohr',  type:'material',   icon:'👂', rarity:'common' },
  bone_shard: { id:'bone_shard', name:'Knochensplit',type:'material',   icon:'🦴', rarity:'uncommon' },
  gold_coin:  { id:'gold_coin',  name:'Goldmünze',   type:'currency',   icon:'🪙', rarity:'common' },
  rare_gem:   { id:'rare_gem',   name:'Seltenheit',  type:'material',   icon:'💎', rarity:'rare' },
};

// ── MOB-TYPEN ─────────────────────────────────────────────────
const MOB_TYPES = {
  slime:   { name:'Schleim',  hp:30,  atk:8,  exp:12, speed:45, color:0x2ecc71, drops:[['slime_gel',0.8],['hp_potion',0.15],['gold_coin',0.5]] },
  goblin:  { name:'Goblin',   hp:55,  atk:14, exp:25, speed:65, color:0xe67e22, drops:[['goblin_ear',0.7],['gold_coin',0.6],['iron_sword',0.05]] },
  skeleton:{ name:'Skelett',  hp:75,  atk:18, exp:40, speed:55, color:0xecf0f1, drops:[['bone_shard',0.8],['mp_potion',0.2],['rare_gem',0.03]] },
  boss:    { name:'Schleimkönig', hp:400, atk:28, exp:200, speed:35, color:0x8e44ad, drops:[['rare_gem',0.9],['hp_potion',1],['gold_coin',1],['iron_sword',0.3]] },
};

// ── QUESTS ────────────────────────────────────────────────────
const QUEST_DEFS = [
  { id:'q1', title:'Erste Schritte',    desc:'Besiege 5 Schleime.',   goal:{ type:'kill', mob:'slime',   count:5  }, reward:{ exp:60,  gold:50,  item:'hp_potion'  } },
  { id:'q2', title:'Goblin-Problem',    desc:'Besiege 3 Goblins.',    goal:{ type:'kill', mob:'goblin',  count:3  }, reward:{ exp:100, gold:100, item:'iron_sword'  } },
  { id:'q3', title:'Knochenbrecher',    desc:'Besiege 2 Skelette.',   goal:{ type:'kill', mob:'skeleton',count:2  }, reward:{ exp:150, gold:150, item:'mp_potion'   } },
];

// ── SPAWN-DEFINITIONEN ────────────────────────────────────────
const MONSTER_SPAWNS = [
  { x:520,  y:380, type:'slime'    },
  { x:660,  y:380, type:'slime'    },
  { x:790,  y:380, type:'goblin'   },
  { x:900,  y:230, type:'slime'    },
  { x:1020, y:380, type:'goblin'   },
  { x:1100, y:200, type:'skeleton' },
  { x:1200, y:260, type:'goblin'   },
  { x:1320, y:310, type:'skeleton' },
  { x:1450, y:380, type:'slime'    },
  { x:750,  y:80,  type:'boss'     },
];

// ── PLATFORMS ─────────────────────────────────────────────────
const PLATFORMS = [];
function initPlatforms() {
  for (let x = 0; x < 1600; x += 32) PLATFORMS.push({ minX:x, maxX:x+32, y:448 });
  [[96,390,5],[256,340,4],[480,380,3],[640,310,5],[800,360,3],[950,280,4],
   [1100,340,5],[1250,390,3],[1380,310,4],[200,270,3],[400,230,2],[600,220,3],
   [850,200,3],[1050,230,2],[1300,260,4],[700,160,3],[1100,170,2]
  ].forEach(([x,y,cnt]) => {
    for (let i=0; i<cnt; i++) PLATFORMS.push({ minX:x+i*32, maxX:x+i*32+32, y:y-16 });
  });
}

const GRAVITY=600, MOB_HALF_H=18, MAP_WIDTH=1600, SPAWN_X=200, SPAWN_Y=300, TICK_RATE=20;

function sweptFloorY(mobX, prevY, nextY) {
  const prevFoot=prevY+MOB_HALF_H, nextFoot=nextY+MOB_HALF_H;
  let best=Infinity;
  PLATFORMS.forEach(p => {
    if (mobX<p.minX||mobX>p.maxX) return;
    if (p.y>=prevFoot && p.y<=nextFoot+2 && p.y<best) best=p.y;
  });
  return best===Infinity ? null : best;
}

// ══════════════════════════════════════════════════════════════
//  SPIELER-ERSTELLUNG
// ══════════════════════════════════════════════════════════════
function createPlayer(socketId, name, cls='warrior') {
  const c = CLASSES[cls] || CLASSES.warrior;
  return {
    id: socketId, name, class: cls,
    x: SPAWN_X, y: SPAWN_Y, velX:0, velY:0,
    hp: c.hp, maxHp: c.hp,
    mp: c.mp, maxMp: c.mp,
    atk: c.atk, def: c.def,
    exp: 0, level: 1,
    gold: 0,
    facing: 1, anim: 'idle', dead: false,
    invincible: 3000,
    lastUpdate: Date.now(),
    // Skills: { skillId → cooldownRemainingMs }
    skillCooldowns: {},
    // Aktive Buffs: [{ stat, val, expiresAt }]
    buffs: [],
    // Inventar: Array von { itemId, qty } max 20 Slots
    inventory: [],
    // Quests: { questId → { progress, done } }
    quests: {
      q1: { progress:0, done:false },
      q2: { progress:0, done:false },
      q3: { progress:0, done:false },
    },
  };
}

// ══════════════════════════════════════════════════════════════
//  MONSTER
// ══════════════════════════════════════════════════════════════
const monsters = [];
function initMonsters() {
  MONSTER_SPAWNS.forEach((sp, i) => {
    const t = MOB_TYPES[sp.type];
    monsters.push({
      id: 'mob_'+i, type: sp.type,
      x: sp.x, y: sp.y, spawnX: sp.x, spawnY: sp.y,
      velY: 0, hp: t.hp, maxHp: t.hp,
      dir: 1, speed: t.speed,
      timer: Math.random()*1500,
      alive: true, knockback: 0, knockDir: 1,
    });
  });
}

function rollDrops(mobType) {
  const drops = [];
  MOB_TYPES[mobType].drops.forEach(([itemId, chance]) => {
    if (Math.random() < chance) drops.push(itemId);
  });
  return drops;
}

function addToInventory(player, itemId) {
  const existing = player.inventory.find(s => s.id === itemId);
  if (existing) { existing.qty++; return; }
  if (player.inventory.length < 20) player.inventory.push({ id:itemId, qty:1 });
}

function getEffectiveAtk(player) {
  let bonus = 0;
  player.buffs = player.buffs.filter(b => b.expiresAt > Date.now());
  player.buffs.forEach(b => { if (b.stat==='atk') bonus += b.val; });
  return player.atk + bonus;
}

// ══════════════════════════════════════════════════════════════
//  MONSTER KI
// ══════════════════════════════════════════════════════════════
function tickMonsters(dt) {
  const dtSec = dt/1000;
  monsters.forEach(mob => {
    if (!mob.alive) return;
    mob.timer -= dt;

    // Schwerkraft
    mob.velY += GRAVITY*dtSec;
    const prevY=mob.y, nextY=mob.y+mob.velY*dtSec;
    const hit = sweptFloorY(mob.x, prevY, nextY);
    if (hit!==null) { mob.y=hit-MOB_HALF_H; mob.velY=0; }
    else { mob.y=nextY; if (mob.y>448-MOB_HALF_H) { mob.y=448-MOB_HALF_H; mob.velY=0; } }

    // Rückstoß
    if (mob.knockback>0) {
      mob.knockback-=dt;
      mob.x+=mob.knockDir*100*dtSec;
      mob.x=Math.max(0,Math.min(MAP_WIDTH,mob.x));
      return;
    }

    // KI
    let nearest=null, nearDist=Infinity;
    Object.values(players).forEach(p => {
      if (p.dead) return;
      const d=Math.abs(p.x-mob.x);
      if (d<nearDist) { nearDist=d; nearest=p; }
    });

    const t = MOB_TYPES[mob.type];
    if (nearest && nearDist<200) {
      mob.dir = nearest.x>mob.x ? 1 : -1;
      mob.x += t.speed*mob.dir*dtSec;
      const dy=Math.abs(nearest.y-mob.y);
      if (nearDist<28 && dy<30 && mob.timer<=0 && nearest.invincible<=0) {
        const dmg = Math.max(1, t.atk - nearest.def);
        nearest.hp = Math.max(0, nearest.hp-dmg);
        nearest.invincible=600; mob.timer=900;
        io.to(nearest.id).emit('player:damaged', { hp:nearest.hp, dmg });
        if (nearest.hp<=0) {
          nearest.dead=true;
          io.to(nearest.id).emit('player:died');
          setTimeout(()=>respawnPlayer(nearest.id), 3000);
        }
      }
    } else {
      if (mob.timer<=0) { mob.dir*=-1; mob.timer=1500+Math.random()*1000; }
      mob.x+=t.speed*0.5*mob.dir*dtSec;
      mob.x=Math.max(0,Math.min(MAP_WIDTH,mob.x));
    }
  });
}

function respawnPlayer(socketId) {
  const p=players[socketId]; if (!p) return;
  p.hp=p.maxHp; p.mp=p.maxMp; p.dead=false; p.invincible=3000;
  p.x=SPAWN_X; p.y=SPAWN_Y;
  io.to(socketId).emit('player:respawned', { x:p.x, y:p.y, hp:p.hp, mp:p.mp });
}

// ══════════════════════════════════════════════════════════════
//  SKILL-AUSFÜHRUNG (Server-seitig)
// ══════════════════════════════════════════════════════════════
function executeSkill(player, skillId, targetX, targetY) {
  const sk = SKILLS[skillId];
  if (!sk) return;
  const cls = CLASSES[player.class];
  if (!cls.skills.includes(skillId)) return;
  const now = Date.now();
  if (now < (player.skillCooldowns[skillId]||0)) return;
  if (player.mp < sk.mp) return;

  player.mp -= sk.mp;
  player.skillCooldowns[skillId] = now + sk.cd;

  // ── Teleport (Blink) ──────────────────────────────────────
  if (sk.teleport) {
    const dx = targetX - player.x;
    player.x += Math.sign(dx) * Math.min(Math.abs(dx), sk.range);
    player.x = Math.max(0, Math.min(MAP_WIDTH, player.x));
    io.to(player.id).emit('player:blink', { x:player.x, y:player.y });
  }

  // ── Dash (Dodge Roll) ────────────────────────────────────
  if (sk.dash) {
    player.x += player.facing * sk.dashDist;
    player.x = Math.max(0, Math.min(MAP_WIDTH, player.x));
    player.invincible = sk.invDur;
    io.to(player.id).emit('player:dash', { x:player.x, invincible:sk.invDur });
  }

  // ── Buff (War Cry) — kein Schaden, nur Buff ──────────────
  if (sk.buff) {
    player.buffs.push({ stat:sk.buff, val:sk.buffVal, expiresAt:now+sk.buffDur });
    io.to(player.id).emit('player:buffed', { buff:sk.buff, val:sk.buffVal, dur:sk.buffDur });
    io.to(player.id).emit('skill:used', { skillId, cdMs:sk.cd, mpLeft:player.mp });
    return;
  }

  // ── Schaden ──────────────────────────────────────────────
  if (sk.dmgMult > 0) {
    const baseDmg = Math.round(getEffectiveAtk(player) * sk.dmgMult);
    // Hitbox: Rechteck VON Spielerposition in Blickrichtung
    const px = player.x, py = player.y, f = player.facing;
    const hw = (sk.hitW||50)/2, hh = (sk.hitH||50)/2;

    // Für gerichtete Skills: Box startet an Spieler und geht in Blickrichtung
    // Für AoE (Feuerball): Box um Zielpunkt
    const isAoe = sk.aoe;

    monsters.forEach(mob => {
      if (!mob.alive) return;
      let inRange = false;

      if (isAoe) {
        // AoE: Kreis um Zielpunkt (Feuerball-Einschlag)
        const cx = targetX, cy = targetY;
        inRange = Math.abs(mob.x-cx) < hw && Math.abs(mob.y-cy) < hh;
      } else if (sk.projectile) {
        // Projektil: langer Strahl vom Spieler in Blickrichtung
        // Mob muss auf gleicher Y-Höhe UND in Reichweite auf X-Achse sein
        const mobRelX = (mob.x - px) * f; // positiv = vor dem Spieler
        inRange = mobRelX > 0 && mobRelX < sk.range && Math.abs(mob.y - py) < hh;
      } else {
        // Nahkampf: Box direkt vor dem Spieler
        const mobRelX = (mob.x - px) * f;
        inRange = mobRelX > -10 && mobRelX < sk.range && Math.abs(mob.y - py) < hh;
      }

      if (!inRange) return;
      const dmg = baseDmg + Math.floor(Math.random()*6);
      mob.hp -= dmg;
      mob.knockDir = mob.x > px ? 1 : -1;
      mob.knockback = sk.stun || 500;
      io.emit('mob:hit', { mobId:mob.id, dmg, x:mob.x, y:mob.y, skill:skillId });

      if (mob.hp <= 0) {
        mob.alive = false;
        io.emit('mob:died', { mobId:mob.id, x:mob.x, y:mob.y });
        rewardKill(player, mob);
        const si = parseInt(mob.id.split('_')[1]);
        setTimeout(()=>{
          const sp=MONSTER_SPAWNS[si], t=MOB_TYPES[sp.type];
          mob.x=sp.x; mob.y=sp.y; mob.hp=t.hp; mob.alive=true; mob.velY=0;
          io.emit('mob:respawned', { mobId:mob.id, x:mob.x, y:mob.y });
        }, mob.type==='boss'?30000:8000);
      }
    });
  }

  io.to(player.id).emit('skill:used', { skillId, cdMs:sk.cd, mpLeft:player.mp });
}

function rewardKill(player, mob) {
  const t = MOB_TYPES[mob.type];

  // EXP
  player.exp += t.exp;
  let leveledUp = false;
  const needed = 100 + (player.level-1)*50;
  if (player.exp >= needed) { player.exp -= needed; player.level++; leveledUp=true; }

  // Gold
  player.gold += Math.floor(Math.random()*10+5);

  // Drops
  const drops = rollDrops(mob.type);
  drops.forEach(itemId => addToInventory(player, itemId));

  // Quest-Fortschritt
  Object.values(QUEST_DEFS).forEach(qd => {
    const qp = player.quests[qd.id];
    if (!qp || qp.done) return;
    if (qd.goal.type==='kill' && qd.goal.mob===mob.type) {
      qp.progress++;
      if (qp.progress >= qd.goal.count) {
        qp.done=true;
        // Belohnung
        player.exp += qd.reward.exp;
        player.gold += qd.reward.gold;
        if (qd.reward.item) addToInventory(player, qd.reward.item);
        io.to(player.id).emit('quest:completed', { questId:qd.id, reward:qd.reward });
      }
      io.to(player.id).emit('quest:progress', { questId:qd.id, progress:qp.progress, goal:qd.goal.count });
    }
  });

  io.to(player.id).emit('player:exp', {
    exp:player.exp, level:player.level, leveledUp,
    gold:player.gold, drops,
    inventory:player.inventory,
  });
}

// ══════════════════════════════════════════════════════════════
//  SERVER TICK
// ══════════════════════════════════════════════════════════════
const players = {};
let lastTick = Date.now();
setInterval(() => {
  const now=Date.now(), dt=now-lastTick; lastTick=now;
  Object.values(players).forEach(p => {
    if (p.invincible>0) p.invincible-=dt;
    if (p.mp<p.maxMp && now%2000<dt) p.mp=Math.min(p.maxMp,p.mp+4);
  });
  tickMonsters(dt);

  const snapshot = {
    t: now,
    players: Object.values(players).map(p => ({
      id:p.id, name:p.name, class:p.class, x:p.x, y:p.y,
      hp:p.hp, maxHp:p.maxHp, facing:p.facing,
      anim:p.anim, dead:p.dead, level:p.level,
    })),
    monsters: monsters.map(m => ({
      id:m.id, type:m.type, x:m.x, y:m.y,
      hp:m.hp, maxHp:m.maxHp, alive:m.alive,
      dir:m.dir, knockback:m.knockback,
    })),
  };
  io.emit('world:snapshot', snapshot);
}, 1000/TICK_RATE);

// ══════════════════════════════════════════════════════════════
//  SOCKET EVENTS
// ══════════════════════════════════════════════════════════════
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  socket.on('player:join', ({ name, cls }) => {
    players[socket.id] = createPlayer(socket.id, name, cls||'warrior');
    const p = players[socket.id];
    console.log(`    → "${name}" (${p.class}) betritt die Welt`);
    socket.emit('player:welcome', {
      self: p, allPlayers: Object.values(players),
      monsters, questDefs: QUEST_DEFS, skillDefs: SKILLS, classDefs: CLASSES,
    });
    socket.broadcast.emit('player:joined', p);
  });

  socket.on('player:move', data => {
    const p=players[socket.id]; if (!p||p.dead) return;
    const dt=Date.now()-p.lastUpdate;
    const maxMove=(dt/1000)*700;
    const dx=Math.abs(data.x-p.x), dy=Math.abs(data.y-p.y);
    if (dx<=maxMove+10 && dy<=maxMove+10) {
      p.x=data.x; p.y=data.y; p.velX=data.velX||0;
      p.velY=data.velY||0; p.facing=data.facing||p.facing; p.anim=data.anim||'idle';
    }
    p.lastUpdate=Date.now();
  });

  // Basis-Angriff — keine Abklingzeit, kein MP-Kosten
  socket.on('player:attack', data => {
    const p=players[socket.id]; if (!p||p.dead) return;

    // Hitbox: 55px breit, 50px hoch, direkt vor dem Spieler
    const HIT_W=55, HIT_H=50;
    const px=p.x, py=p.y, f=p.facing;

    monsters.forEach(mob => {
      if (!mob.alive) return;
      const mobRelX = (mob.x - px) * f; // positiv = vor dem Spieler
      if (mobRelX < -10 || mobRelX > HIT_W) return;
      if (Math.abs(mob.y - py) > HIT_H) return;

      const dmg = Math.round(getEffectiveAtk(p)) + Math.floor(Math.random()*5);
      mob.hp -= dmg;
      mob.knockDir = mob.x>px?1:-1; mob.knockback=800;
      io.emit('mob:hit', { mobId:mob.id, dmg, x:mob.x, y:mob.y });
      if (mob.hp<=0) {
        mob.alive=false;
        io.emit('mob:died', { mobId:mob.id, x:mob.x, y:mob.y });
        rewardKill(p, mob);
        const si=parseInt(mob.id.split('_')[1]);
        setTimeout(()=>{
          const sp=MONSTER_SPAWNS[si], t=MOB_TYPES[sp.type];
          mob.x=sp.x; mob.y=sp.y; mob.hp=t.hp; mob.alive=true; mob.velY=0;
          io.emit('mob:respawned', { mobId:mob.id, x:mob.x, y:mob.y });
        }, mob.type==='boss'?30000:8000);
      }
    });
  });

  // Skill-Aktivierung
  socket.on('player:skill', ({ skillId, targetX, targetY, facing }) => {
    const p=players[socket.id]; if (!p||p.dead) return;
    if (facing) p.facing = facing; // Richtung vom Client übernehmen
    executeSkill(p, skillId, targetX, targetY);
  });

  // Item benutzen
  socket.on('player:useItem', ({ itemId }) => {
    const p=players[socket.id]; if (!p) return;
    const slot=p.inventory.find(s=>s.id===itemId); if (!slot||slot.qty<1) return;
    const item=ITEMS[itemId]; if (!item||item.type!=='consumable') return;
    if (item.effect==='hp') p.hp=Math.min(p.maxHp, p.hp+item.val);
    if (item.effect==='mp') p.mp=Math.min(p.maxMp, p.mp+item.val);
    slot.qty--;
    if (slot.qty<=0) p.inventory=p.inventory.filter(s=>s.id!==itemId);
    io.to(socket.id).emit('player:stats', { hp:p.hp, mp:p.mp, inventory:p.inventory });
  });

  socket.on('ping',     ()=>socket.emit('pong'));
  socket.on('chat:msg', ({ text })=>{
    const p=players[socket.id]; if (!p||!text||text.length>120) return;
    io.emit('chat:msg', { from:p.name, cls:p.class, text:text.trim().slice(0,120) });
  });

  socket.on('disconnect', ()=>{
    const p=players[socket.id];
    if (p) { console.log(`[-] ${p.name}`); delete players[socket.id]; io.emit('player:left', { id:socket.id }); }
  });
});

// ══════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════
initPlatforms();
initMonsters();

// HTTP immer starten
httpServer.listen(isDev ? HTTPS_PORT : HTTP_PORT, () => {
  console.log(`\n⚔  KRONOS ONLINE Phase 3`);
  console.log(`   HTTP  → http://localhost:${isDev ? HTTPS_PORT : HTTP_PORT}`);
});

// HTTPS parallel starten wenn Zertifikat vorhanden
if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`   HTTPS → https://localhost:${HTTPS_PORT}`);
    console.log(`   HTTPS → https://local.localhoast.de:${HTTPS_PORT}\n`);
  });
} else if (!isDev) {
  console.log(`   ⚠  Kein SSL-Zertifikat — nur HTTP aktiv`);
  console.log(`   → bash setup-letsencrypt.sh ausführen für HTTPS\n`);
}
