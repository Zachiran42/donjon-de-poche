'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createGame, makeFloor, validState} = require('../docs/game.js');
const dirs = [[0, -1, 'ArrowUp'], [1, 0, 'ArrowRight'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft']];
function setup(random = () => .314159) {
  const ends = [], progress = {}, game = createGame({progress, random, end: (...args) => ends.push(args), hud() {}, toast() {}, save() {}});
  return {game, ends, progress};
}
function press(game, key) { game.key(key, true); game.key(key, false); }
function search(grid, start, target) {
  const queue = [{x: start.x, y: start.y, path: []}], seen = new Set([start.x + ',' + start.y]);
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n];
    if (target && p.x === target.x && p.y === target.y) return p.path;
    for (const [dx, dy, key] of dirs) {
      const x = p.x + dx, y = p.y + dy, id = x + ',' + y;
      if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length || grid[y][x] || seen.has(id)) continue;
      seen.add(id); queue.push({x, y, path: p.path.concat(key)});
    }
  }
  return target ? null : seen;
}
function combatScenario() {
  const state = makeFloor(1, 42);
  state.grid = state.grid.map((row, y) => row.map((_, x) => x > 0 && x < 6 && y > 0 && y < 7 ? 0 : 1));
  state.hero = {x: 2, y: 2, hp: 8, maxHp: 12, attack: 3, potions: 1, keys: 0};
  state.monsters = [{id: 'test', x: 3, y: 2, hp: 6, maxHp: 6, attack: 1, stun: 0, kind: 0}];
  state.items = [{id: 'key', type: 'key', x: 5, y: 1}];
  return state;
}

test('1600 generated floors have connected terrain and reachable rewards', () => {
  for (let seed = 0; seed < 80; seed++) for (let floor = 1; floor <= 20; floor++) {
    const state = makeFloor(floor, seed * 1337), visited = search(state.grid, state.hero);
    assert.equal(validState(state), true);
    assert.equal(visited.size, state.grid.flat().filter(v => v === 0).length);
    for (const item of state.items) assert.ok(visited.has(item.x + ',' + item.y));
    assert.ok(state.monsters.length >= 2 && state.monsters.length <= 4);
    assert.deepEqual(makeFloor(floor, seed * 1337), state, 'generation is deterministic');
  }
});

test('save round trip is independent and corrupt saves preserve current state', () => {
  const a = setup(), b = setup(); a.game.reset();
  const saved = JSON.parse(JSON.stringify(a.game.snapshot()));
  assert.equal(b.game.restore(saved), true); assert.deepEqual(b.game.snapshot(), saved);
  saved.hero.hp = 1; assert.notEqual(b.game.snapshot().hero.hp, 1);
  const good = b.game.snapshot();
  for (const corrupt of [null, {}, {...good, floor: 0}, {...good, version: 2}, {...good, hero: {...good.hero, hp: 0}}, {...good, status: 'won'}, {...good, monsters: [...good.monsters, {...good.monsters[0]}]}]) {
    assert.equal(b.game.restore(corrupt), false); assert.deepEqual(b.game.snapshot(), good);
  }
});

test('contact attacks stagger, kills reward coins, healing and waiting consume a turn', () => {
  const {game} = setup(); assert.equal(game.restore(combatScenario()), true);
  press(game, 'ArrowRight');
  let state = game.snapshot();
  assert.equal(state.monsters[0].hp, 3); assert.equal(state.hero.hp, 8); assert.equal(state.turn, 1);
  press(game, 'ArrowRight'); state = game.snapshot();
  assert.equal(state.monsters.length, 0); assert.equal(state.kills, 1); assert.equal(state.coins, 8);
  assert.equal(state.hero.x, 2, 'attacking does not walk through a monster');
  press(game, 'e'); state = game.snapshot();
  assert.equal(state.hero.hp, 12); assert.equal(state.hero.potions, 0); assert.equal(state.turn, 3);
  press(game, 'Enter'); assert.equal(game.snapshot().turn, 4);
});

test('a key is required for the exit; victory and death each end once', () => {
  const h = setup(), initial = combatScenario();
  initial.monsters = []; initial.hero.x = 4; initial.hero.y = 6;
  assert.equal(h.game.restore(initial), true); press(h.game, 'ArrowRight');
  assert.equal(h.game.snapshot().status, 'playing'); assert.equal(h.game.snapshot().hero.x, 4);
  const unlocked = h.game.snapshot(); unlocked.hero.keys = 1;
  assert.equal(h.game.restore(unlocked), true); press(h.game, 'ArrowRight');
  assert.equal(h.game.snapshot().status, 'won'); assert.equal(h.ends.length, 1); assert.equal(h.ends[0][3], true);
  press(h.game, 'Enter'); assert.equal(h.ends.length, 1);
  const resume = setup(); assert.equal(resume.game.restore(h.game.snapshot()), true); assert.equal(resume.ends.length, 0);
  resume.game.next(); assert.equal(resume.game.snapshot().floor, 2); assert.equal(resume.game.snapshot().status, 'playing');
  const loss = makeFloor(1, 42);
  loss.hero.hp = 1; loss.monsters = [{id: 'last', x: 2, y: 1, hp: 3, maxHp: 3, attack: 1, stun: 0, kind: 0}];
  const losing = setup(); assert.equal(losing.game.restore(loss), true);
  press(losing.game, 'Enter'); assert.equal(losing.game.snapshot().status, 'lost'); assert.equal(losing.ends.length, 1);
  press(losing.game, 'Enter'); assert.equal(losing.ends.length, 1);
});

test('a basic legal-input strategy can clear the first floor across 80 seeds', () => {
  for (let seed = 0; seed < 80; seed++) {
    const {game, ends} = setup(() => seed / 80); game.reset();
    for (let actions = 0; actions < 250 && game.snapshot().status === 'playing'; actions++) {
      const state = game.snapshot(), hero = state.hero;
      if (hero.hp <= 6 && hero.potions) { press(game, 'e'); continue; }
      const adjacent = state.monsters.find(m => Math.abs(m.x - hero.x) + Math.abs(m.y - hero.y) === 1);
      const target = adjacent || (!hero.keys ? state.items.find(i => i.type === 'key') : state.exit);
      const route = search(state.grid, hero, target);
      assert.ok(route && route.length);
      press(game, route[0]);
    }
    assert.equal(game.snapshot().status, 'won', 'seed ' + seed + ' is attainable');
    assert.equal(ends.length, 1);
  }
});
