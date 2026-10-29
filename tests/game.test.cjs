'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGame,makeFloor,validState,reachable,distances,visibleCells,viewState,hasLineOfSight,intentCells,COLS,ROWS,CELL,LEFT,TOP,TORCH_MAX}=require('../docs/game.js');
const DIRS=[[0,-1,'ArrowUp'],[1,0,'ArrowRight'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft']];
const clone=s=>JSON.parse(JSON.stringify(s)),idx=(x,y)=>y*COLS+x,dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function setup(random=()=>.314159,progress={}){const ends=[],huds=[],messages=[],game=createGame({progress,random,end:(...a)=>ends.push(a),hud:(...a)=>huds.push(a),toast:t=>messages.push(t),save(){}});return{game,ends,huds,messages,progress};}
function press(g,k){g.key(k,true);g.key(k,false);}
function tap(g,x,y){g.pointer('down',x,y);g.pointer('up',x,y);}
function revealAll(s){s.explored=Array(COLS*ROWS).fill(true);return s;}
function arena(){
  const s=makeFloor(1,42);s.grid=s.grid.map((r,y)=>r.map((_,x)=>x>0&&x<COLS-1&&y>0&&y<ROWS-1?0:1));s.hero.x=3;s.hero.y=3;s.hero.hp=9;s.hero.torch=24;s.monsters=[];s.items=[{id:'key',type:'key',x:7,y:1}];s.exit={x:7,y:8};s.shrine={x:2,y:2,used:false};s.mode='explore';return revealAll(s);
}
function monster(kind,x,y,extra={}){const maxHp=[3,5,3][kind];return{id:'test-'+kind,x,y,kind,hp:maxHp,maxHp,attack:kind===1?2:1,cooldown:0,intent:null,alert:0,target:{x,y},...extra};}
function route(s,target,known=false){
  const q=[{x:s.hero.x,y:s.hero.y,path:[]}],seen=new Set([s.hero.x+','+s.hero.y]);
  for(let n=0;n<q.length;n++){
    const p=q[n];if(p.x===target.x&&p.y===target.y)return p.path;
    for(const [dx,dy,key]of DIRS){const x=p.x+dx,y=p.y+dy,k=x+','+y;if(x<1||y<1||x>=COLS-1||y>=ROWS-1||s.grid[y][x]||seen.has(k)||(!s.hero.keys&&x===s.exit.x&&y===s.exit.y)||(known&&!s.explored[idx(x,y)]))continue;seen.add(k);q.push({x,y,path:p.path.concat(key)});}
  }return null;
}

test('1600 deterministic floors are connected with separated rewards and three enemy roles',()=>{
  for(let seed=0;seed<80;seed++)for(let floor=1;floor<=20;floor++){
    const s=makeFloor(floor,seed*1337);assert.equal(validState(s),true,'seed '+seed+', floor '+floor);
    const seen=reachable(s.grid,s.hero);assert.equal(seen.size,s.grid.flat().filter(v=>v===0).length);
    for(const p of [...s.items,s.exit,s.shrine,...s.monsters])assert.ok(seen.has(p.x+','+p.y));
    const locked=clone(s.grid);locked[s.exit.y][s.exit.x]=1;assert.equal(reachable(locked,s.hero).size,seen.size-1,'locked exit never cuts the key off');
    assert.deepEqual(new Set(s.monsters.map(m=>m.kind)),new Set([0,1,2]));assert.deepEqual(makeFloor(floor,seed*1337),s);
  }
});

test('walls occlude the torch, corners cannot be peeked, and darkness reduces the radius',()=>{
  const s=arena();s.hero.x=2;s.hero.y=2;s.grid[2][3]=1;
  assert.equal(hasLineOfSight(s.grid,2,2,3,2),true,'blocking wall itself is visible');
  assert.equal(hasLineOfSight(s.grid,2,2,4,2),false,'wall blocks the floor behind');
  assert.equal(hasLineOfSight(s.grid,2,2,3,3),false,'no diagonal corner peeking');
  const lit=visibleCells(s);assert.ok(lit.has(idx(3,2)));assert.ok(!lit.has(idx(4,2)));assert.ok(lit.has(idx(2,4)));
  s.hero.torch=0;const dark=visibleCells(s);assert.ok(dark.has(idx(2,3)));assert.ok(!dark.has(idx(2,4)));assert.ok(dark.size<lit.size);
});

test('explored terrain keeps memory, but items, exits, shrines and enemies never leak outside current light',()=>{
  const s=arena();s.hero.x=1;s.hero.y=1;s.monsters=[monster(2,7,7)];s.items=[{id:'key',type:'key',x:7,y:1},{id:'hidden-oil',type:'oil',x:6,y:7}];
  const v=viewState(s);assert.equal(v.items.length,0);assert.equal(v.monsters.length,0);assert.equal(v.exit,null);assert.ok(s.explored[idx(7,7)]);
  const h=setup();assert.equal(h.game.restore(s),true);const saved=h.game.snapshot(),translations=[];
  const gradient={addColorStop(){}};const ctx=new Proxy({}, {get(t,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;if(k==='translate')return(x,y)=>translations.push([x,y]);return t[k]||(()=>{});},set(t,k,v){t[k]=v;return true;}});
  h.game.draw(ctx);assert.deepEqual(h.game.snapshot(),saved,'draw cannot reveal or change the world');
  for(const hidden of [...s.items,...s.monsters])assert.ok(!translations.some(([x,y])=>x===LEFT+(hidden.x+.5)*CELL&&Math.abs(y-(TOP+(hidden.y+.5)*CELL))<3),'hidden entity was not drawn');
  const before=saved.explored.filter(Boolean).length;press(h.game,'ArrowRight');assert.ok(h.game.snapshot().explored.filter(Boolean).length>=before);
});

test('tap anywhere in a board direction moves one step, swipes and held key releases work',()=>{
  const s=arena();const h=setup();assert.equal(h.game.restore(s),true);
  tap(h.game,LEFT+7.5*CELL,TOP+3.5*CELL);assert.equal(h.game.snapshot().hero.x,4,'far-right tap moves right once');assert.equal(h.game.snapshot().turn,1);
  tap(h.game,LEFT+4.5*CELL,TOP+7.5*CELL);assert.equal(h.game.snapshot().hero.y,4,'far-down tap moves down once');
  h.game.pointer('down',200,300);h.game.pointer('up',150,300);assert.equal(h.game.snapshot().hero.x,3);
  h.game.key('ArrowUp',true);h.game.key('ArrowUp',true);assert.equal(h.game.snapshot().hero.y,3);h.game.key('ArrowUp',false);press(h.game,'ArrowUp');assert.equal(h.game.snapshot().hero.y,2);
  const before=h.game.snapshot();h.game.pointer('down',200,300);h.game.pointer('cancel',0,0);h.game.pointer('up',280,300);assert.deepEqual(h.game.snapshot(),before);
  assert.ok(h.huds.some(a=>a[2]==='TORCHE'),'fuel is visible in the shared HUD');
});

test('blocked movement is free, oil and healing cost one turn, darkness causes paced damage',()=>{
  const s=arena();s.hero.x=1;s.hero.y=1;s.hero.torch=8;s.hero.hp=5;s.hero.oil=1;
  const h=setup();assert.equal(h.game.restore(s),true);press(h.game,'ArrowLeft');assert.equal(h.game.snapshot().turn,0);assert.equal(h.game.snapshot().hero.torch,8);
  press(h.game,'f');let a=h.game.snapshot();assert.equal(a.hero.oil,0);assert.equal(a.hero.torch,27);assert.equal(a.turn,1);
  press(h.game,'e');a=h.game.snapshot();assert.equal(a.hero.hp,11);assert.equal(a.hero.potions,0);assert.equal(a.turn,2);assert.equal(a.hero.torch,26);
  a.hero.torch=0;a.darkTurns=0;assert.equal(h.game.restore(a),true);const hp=a.hero.hp;press(h.game,'Enter');press(h.game,'Enter');assert.equal(h.game.snapshot().hero.hp,hp);press(h.game,'Enter');assert.equal(h.game.snapshot().hero.hp,hp-1);
});

test('the shrine offers exclusive, paid choices and keeps upgrades across floors',()=>{
  const s=arena();s.hero.x=2;s.hero.y=2;s.hero.hp=5;s.hero.torch=5;s.coins=20;s.mode='shrine';
  const heal=setup();assert.equal(heal.game.restore(s),true);press(heal.game,'1');let a=heal.game.snapshot();assert.equal(a.coins,15);assert.equal(a.hero.hp,11);assert.equal(a.shrine.used,true);assert.equal(a.turn,1);
  const fuel=setup();assert.equal(fuel.game.restore(s),true);press(fuel.game,'2');a=fuel.game.snapshot();assert.equal(a.coins,14);assert.equal(a.hero.torch,28);assert.equal(a.hero.oil,1);
  const power=setup();assert.equal(power.game.restore(s),true);tap(power.game,334,300);a=power.game.snapshot();assert.equal(a.coins,10);assert.equal(a.hero.attack,3);assert.equal(a.shrine.used,true);
  a.hero.keys=1;a.items=[];a.hero.x=a.exit.x;a.hero.y=a.exit.y;a.status='won';a.mode='explore';assert.equal(power.game.restore(a),true);power.game.next();assert.equal(power.game.snapshot().hero.attack,3);assert.equal(power.game.snapshot().shrine.used,false);assert.equal(power.game.snapshot().coins,10);
  const poor=setup();s.coins=4;assert.equal(poor.game.restore(s),true);const initial=poor.game.snapshot();press(poor.game,'3');assert.deepEqual(poor.game.snapshot(),initial,'failed purchases spend neither fuel nor money');press(poor.game,'Enter');assert.equal(poor.game.snapshot().mode,'explore');assert.equal(poor.game.snapshot().turn,0);assert.equal(poor.game.snapshot().shrine.used,false);
});

test('melee has a telegraphed target; dodging beats it and killing cancels the attack',()=>{
  const s=arena();s.hero.hp=12;s.monsters=[monster(1,4,3)];const h=setup();assert.equal(h.game.restore(s),true);
  press(h.game,'Enter');let a=h.game.snapshot();assert.equal(a.hero.hp,12);assert.equal(a.monsters[0].intent.type,'melee');assert.deepEqual(intentCells(a,a.monsters[0]),[{x:3,y:3}]);
  press(h.game,'ArrowDown');a=h.game.snapshot();assert.equal(a.hero.hp,12,'step away from the red target');assert.equal(a.monsters[0].cooldown,1);
  const hit=setup();assert.equal(hit.game.restore(s),true);press(hit.game,'Enter');press(hit.game,'Enter');assert.equal(hit.game.snapshot().hero.hp,10,'staying on the target takes the announced hit');
  const kill=arena();kill.monsters=[monster(0,4,3,{hp:2,intent:{type:'melee',dx:-1,dy:0}})];const k=setup();assert.equal(k.game.restore(kill),true);press(k.game,'ArrowRight');a=k.game.snapshot();assert.equal(a.monsters.length,0);assert.equal(a.hero.hp,9);assert.equal(a.kills,1);assert.equal(a.coins,12);
});

test('archer lines are telegraphed and can be escaped, while walls block shooting',()=>{
  const s=arena();s.hero.x=3;s.hero.y=4;s.hero.hp=12;s.monsters=[monster(2,3,2)];const h=setup();assert.equal(h.game.restore(s),true);press(h.game,'Enter');let a=h.game.snapshot();assert.equal(a.monsters[0].intent.type,'ray');assert.ok(intentCells(a,a.monsters[0]).some(p=>p.x===3&&p.y===4));press(h.game,'ArrowRight');assert.equal(h.game.snapshot().hero.hp,12);
  const blocked=arena();blocked.hero.x=3;blocked.hero.y=4;blocked.grid[3][3]=1;blocked.monsters=[monster(2,3,2)];const b=setup();assert.equal(b.game.restore(blocked),true);press(b.game,'Enter');assert.equal(b.game.snapshot().monsters[0].intent,null);
});

test('v2 save round trips without references and rejects old or corrupt explored, intents and resources',()=>{
  const a=setup(),b=setup();a.game.reset();press(a.game,'ArrowRight');const saved=clone(a.game.snapshot());assert.equal(saved.version,2);assert.equal(b.game.restore(saved),true);assert.deepEqual(b.game.snapshot(),saved);saved.explored[0]=!saved.explored[0];assert.notDeepEqual(b.game.snapshot(),saved);
  const good=b.game.snapshot(),badIntent={...good.monsters[0],intent:{type:'ray',dx:1,dy:1}};
  const bad=[null,{}, {...good,version:1},{...good,floor:0},{...good,explored:[]},{...good,explored:good.explored.map(()=>false)},{...good,hero:{...good.hero,torch:-1}},{...good,hero:{...good.hero,oil:10}},{...good,hero:{...good.hero,hp:0}},{...good,mode:'shrine'},{...good,monsters:[badIntent]},{...good,monsters:[...good.monsters,{...good.monsters[0]}]},{...good,items:[]}];
  for(const corrupt of bad){assert.equal(b.game.restore(corrupt),false);assert.deepEqual(b.game.snapshot(),good);}
});

test('the key is required, victory and deaths end once, and restored terminal runs stay silent',()=>{
  const s=arena();s.hero.x=6;s.hero.y=8;const h=setup();assert.equal(h.game.restore(s),true);press(h.game,'ArrowRight');assert.equal(h.game.snapshot().hero.x,6);assert.equal(h.game.snapshot().turn,0);
  s.hero.keys=1;s.items=[];assert.equal(h.game.restore(s),true);press(h.game,'ArrowRight');assert.equal(h.game.snapshot().status,'won');assert.equal(h.ends.length,1);press(h.game,'Enter');assert.equal(h.ends.length,1);
  const b=setup();assert.equal(b.game.restore(h.game.snapshot()),true);assert.equal(b.ends.length,0);b.game.next();assert.equal(b.game.snapshot().floor,2);assert.equal(b.game.snapshot().status,'playing');
  const death=arena();death.hero.hp=1;death.hero.torch=0;death.darkTurns=2;const d=setup();assert.equal(d.game.restore(death),true);press(d.game,'Enter');assert.equal(d.game.snapshot().status,'lost');assert.equal(d.ends.length,1);press(d.game,'Enter');assert.equal(d.ends.length,1);
});

function playBot(seed,fog){
  const h=setup(()=>seed/80);h.game.reset();let knownKey=null,knownExit=null,knownOil=new Map();
  for(let action=0;action<280&&h.game.snapshot().status==='playing';action++){
    const s=h.game.snapshot(),hero=s.hero,v=viewState(s);
    for(const item of v.items){if(item.type==='key')knownKey={x:item.x,y:item.y};if(item.type==='oil')knownOil.set(item.id,{x:item.x,y:item.y});}
    for(const [id,p]of knownOil)if(s.explored[idx(p.x,p.y)]&&v.visible.has(idx(p.x,p.y))&&!v.items.some(i=>i.id===id))knownOil.delete(id);
    if(v.exit)knownExit={...v.exit};
    if(s.mode==='shrine'){if(hero.hp<=hero.maxHp-6&&s.coins>=5)press(h.game,'1');else if(hero.torch<=12&&s.coins>=6)press(h.game,'2');else if(s.coins>=10)press(h.game,'3');else press(h.game,'Enter');continue;}
    if(hero.hp<=6&&hero.potions){press(h.game,'e');continue;}
    if(hero.torch<=8&&hero.oil){press(h.game,'f');continue;}
    const adjacent=v.monsters.find(m=>dist(m,hero)===1);
    if(adjacent){const d=DIRS.find(([dx,dy])=>hero.x+dx===adjacent.x&&hero.y+dy===adjacent.y);press(h.game,d[2]);continue;}
    let target;
    if(!fog)target=hero.keys?s.exit:s.items.find(i=>i.type==='key');else target=hero.keys?knownExit:knownKey;
    if(hero.oil===0&&hero.torch<16&&knownOil.size){const oil=[...knownOil.values()].map(p=>({p,route:route(s,p,true)})).filter(o=>o.route&&o.route.length).sort((a,b)=>a.route.length-b.route.length)[0];if(oil&&oil.route.length<10)target=oil.p;}
    let path=target?route(s,target,fog):null;
    if(!path||!path.length){
      const options=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(s.explored[idx(x,y)]&&!s.grid[y][x]&&DIRS.some(([dx,dy])=>!s.explored[idx(x+dx,y+dy)])){const r=route(s,{x,y},true);if(r&&r.length)options.push(r);}
      options.sort((a,b)=>a.length-b.length);path=options[0];
    }
    if(!path||!path.length)break;press(h.game,path[0]);
  }return h;
}

test('a public-input bot can clear the first floor across 80 generated seeds',()=>{
  for(let seed=0;seed<80;seed++){const h=playBot(seed,false);assert.equal(h.game.snapshot().status,'won','seed '+seed);assert.equal(h.ends.length,1);assert.equal(validState(h.game.snapshot()),true);}
});

test('a fog-aware explorer can discover the unknown key and exit using only revealed routes',()=>{
  for(let seed=0;seed<80;seed++){const h=playBot(seed,true);assert.equal(h.game.snapshot().status,'won','fog seed '+seed+' '+JSON.stringify({hp:h.game.snapshot().hero.hp,torch:h.game.snapshot().hero.torch,turn:h.game.snapshot().turn}));assert.equal(h.ends.length,1);}
});


test('full-resource shrine purchases are refused, cards explain why, and returning later keeps the offer',()=>{
  const s=arena();s.hero.x=2;s.hero.y=2;s.hero.hp=s.hero.maxHp;s.hero.torch=TORCH_MAX;s.coins=99;s.mode='shrine';
  const h=setup();assert.equal(h.game.restore(s),true);const before=h.game.snapshot();
  press(h.game,'1');assert.deepEqual(h.game.snapshot(),before,'full health purchase cannot waste coins or a turn');
  press(h.game,'2');assert.deepEqual(h.game.snapshot(),before,'full torch purchase cannot waste coins or a turn');
  assert.ok(h.messages.some(t=>t.includes('vie est pleine')));assert.ok(h.messages.some(t=>t.includes('torche est pleine')));
  const strings=[],gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(t,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;if(k==='fillText')return t=>strings.push(t);return t[k]||(()=>{});},set(t,k,v){t[k]=v;return true;}});
  h.game.draw(ctx);assert.ok(strings.includes('Vie complète'));assert.ok(strings.includes('Torche suffisante'));assert.ok(strings.includes('REVENIR PLUS TARD'));assert.ok(!strings.includes('+0 PV'));
  press(h.game,'Enter');let a=h.game.snapshot();assert.equal(a.mode,'explore');assert.equal(a.shrine.used,false);assert.equal(a.coins,99);assert.equal(a.turn,0);
  assert.ok(h.messages.some(t=>t.includes('Aucune bénédiction consommée')&&t.includes('revenez')));
  press(h.game,'ArrowRight');press(h.game,'ArrowLeft');a=h.game.snapshot();assert.equal(a.mode,'shrine','walking back onto the altar reopens its unused offer');assert.equal(a.shrine.used,false);assert.equal(a.coins,99);
});
