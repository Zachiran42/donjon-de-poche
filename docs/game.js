(function (global) {
  'use strict';
  const COLS=7, ROWS=8, CELL=48, LEFT=42, TOP=122;
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
  const TYPES=['key','potion','chest','coin'];
  const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>0&&x<COLS-1&&y>0&&y<ROWS-1;
  const pk=(x,y)=>x+','+y;
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const integer=(n,l,h)=>Number.isInteger(n)&&n>=l&&n<=h;
  const copy=v=>JSON.parse(JSON.stringify(v));

  function randomFrom(seed) {
    let a=seed>>>0;
    return function() {
      a+=0x6D2B79F5;
      let t=Math.imul(a^(a>>>15),1|a);
      t^=t+Math.imul(t^(t>>>7),61|t);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function reachable(grid,start) {
    const seen=new Set([pk(start.x,start.y)]), queue=[start];
    for(let n=0;n<queue.length;n++) for(const d of DIRS) {
      const x=queue[n].x+d[0], y=queue[n].y+d[1], k=pk(x,y);
      if(inside(x,y)&&grid[y][x]===0&&!seen.has(k)) {seen.add(k);queue.push({x,y});}
    }
    return seen;
  }
  function makeFloor(floor,seed,previous) {
    const rng=randomFrom(seed+floor*7919);
    const grid=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>inside(x,y)?0:1));
    const fixed=new Set(['1,1','2,1','5,1','5,6','1,6','3,4']), candidates=[];
    for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(!fixed.has(pk(x,y))) candidates.push({x,y});
    for(let i=candidates.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    let walls=0;
    for(const p of candidates) {
      if(walls>=4+Math.min(3,Math.floor(floor/3))) break;
      grid[p.y][p.x]=1;
      if(reachable(grid,{x:1,y:1}).size!==30-walls-1) grid[p.y][p.x]=0;else walls++;
    }
    const maxHp=Math.min(20,12+Math.floor((floor-1)/2));
    const hero={x:1,y:1,hp:previous?Math.min(maxHp,previous.hero.hp+6):maxHp,maxHp,attack:Math.min(5,3+Math.floor((floor-1)/4)),potions:previous?previous.hero.potions:1,keys:0};
    const items=[{id:'key',x:5,y:1,type:'key'},{id:'chest',x:1,y:6,type:'chest'},{id:'potion',x:3,y:4,type:'potion'}];
    const free=candidates.filter(p=>grid[p.y][p.x]===0&&distance(p,hero)>=4), monsters=[];
    const count=Math.min(4,2+Math.floor((floor-1)/3));
    for(const p of free) {
      if(monsters.length>=count) break;
      if(monsters.some(m=>distance(m,p)<2)) continue;
      const max=3+Math.min(4,Math.floor((floor-1)/2));
      monsters.push({id:'m'+monsters.length,x:p.x,y:p.y,hp:max,maxHp:max,attack:floor>=7?2:1,stun:0,kind:monsters.length%2});
    }
    return {version:1,seed:seed>>>0,floor,grid,hero,items,monsters,exit:{x:5,y:6},coins:previous?previous.coins:0,turn:0,status:'playing',kills:previous?previous.kills:0};
  }
  function validState(s) {
    if(!s||s.version!==1||!integer(s.seed,0,4294967295)||!integer(s.floor,1,999)) return false;
    if(!Array.isArray(s.grid)||s.grid.length!==ROWS||s.grid.some(r=>!Array.isArray(r)||r.length!==COLS||r.some(v=>v!==0&&v!==1))) return false;
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(!inside(x,y)&&s.grid[y][x]!==1) return false;
    const h=s.hero;
    if(!h||!inside(h.x,h.y)||s.grid[h.y][h.x]!==0||!integer(h.maxHp,8,50)||!integer(h.hp,0,h.maxHp)||!integer(h.attack,1,12)||!integer(h.potions,0,99)||!integer(h.keys,0,1)) return false;
    if(!s.exit||!inside(s.exit.x,s.exit.y)||s.grid[s.exit.y][s.exit.x]!==0) return false;
    const reached=reachable(s.grid,h);
    if(reached.size!==s.grid.flat().filter(v=>v===0).length) return false;
    if(!['playing','won','lost'].includes(s.status)||(s.status!=='lost'&&h.hp===0)||(s.status==='lost'&&h.hp!==0)) return false;
    if(s.status==='won'&&(h.x!==s.exit.x||h.y!==s.exit.y||h.keys!==1)) return false;
    if(!integer(s.coins,0,10000000)||!integer(s.turn,0,10000000)||!integer(s.kills,0,1000000)) return false;
    if(!Array.isArray(s.monsters)||s.monsters.length>8||!Array.isArray(s.items)||s.items.length>20) return false;
    const occupied=new Set([pk(h.x,h.y)]), ids=new Set();
    for(const m of s.monsters) {
      if(!m||typeof m.id!=='string'||m.id.length>32||ids.has(m.id)||!inside(m.x,m.y)||s.grid[m.y][m.x]!==0||occupied.has(pk(m.x,m.y))||!integer(m.maxHp,1,20)||!integer(m.hp,1,m.maxHp)||!integer(m.attack,1,5)||!integer(m.stun,0,1)||!integer(m.kind,0,1)) return false;
      ids.add(m.id);occupied.add(pk(m.x,m.y));
    }
    const itemCells=new Set();
    for(const item of s.items) {
      if(!item||typeof item.id!=='string'||item.id.length>32||!TYPES.includes(item.type)||!inside(item.x,item.y)||s.grid[item.y][item.x]!==0||itemCells.has(pk(item.x,item.y))) return false;
      itemCells.add(pk(item.x,item.y));
    }
    if(s.status==='playing'&&h.keys===0&&!s.items.some(i=>i.type==='key')) return false;
    return true;
  }

  function createGame(api) {
    api=api||{};
    const progress=api.progress||(api.progress={});
    const call=(name,...args)=>typeof api[name]==='function'?api[name](...args):undefined;
    let state,clock=0,touch=null,fx=[],held=new Set(),shownX=1,shownY=1,ended=false;
    function hud() {if(state) call('hud','VIE',state.hero.hp+'/'+state.hero.maxHp,'ÉTAGE',String(state.floor),'PIÈCES',String(state.coins));}
    function persist() {hud();call('save');}
    function burst(x,y,text,color) {fx.push({x:LEFT+(x+.5)*CELL,y:TOP+(y+.4)*CELL,text,color,life:1});}
    function finish(won) {
      if(ended) return;
      ended=true;state.status=won?'won':'lost';
      progress.bestFloor=Math.max(Number(progress.bestFloor)||0,won?state.floor:state.floor-1);
      progress.bestCoins=Math.max(Number(progress.bestCoins)||0,state.coins);
      persist();
      const score=state.coins+state.kills*25+(state.floor-(won?0:1))*100;
      call('end',won?'Étage '+state.floor+' terminé !':'Votre aventure s’achève',won?'+6 PV pour la prochaine descente. La clé ouvre un nouvel étage.':'Vous avez atteint l’étage '+state.floor+'. Gardez une potion pour les rencontres difficiles.',score,won);
    }
    function pickUp() {
      const h=state.hero;
      for(let i=state.items.length-1;i>=0;i--) {
        const item=state.items[i];if(item.x!==h.x||item.y!==h.y) continue;
        if(item.type==='key') {h.keys=1;burst(h.x,h.y,'CLÉ','#f9d278');call('toast','Clé trouvée : rejoignez la porte dorée.');}
        if(item.type==='potion') {h.potions=Math.min(99,h.potions+1);burst(h.x,h.y,'+1 potion','#83e7c3');}
        if(item.type==='chest') {state.coins+=25+state.floor*5;h.potions=Math.min(99,h.potions+1);burst(h.x,h.y,'TRÉSOR !','#f9d278');call('toast','Coffre ouvert : des pièces et une potion.');}
        if(item.type==='coin') {state.coins+=8;burst(h.x,h.y,'+8','#f9d278');}
        state.items.splice(i,1);
      }
    }
    function enemyTurn() {
      const h=state.hero;
      for(const m of state.monsters) {
        if(m.stun) {m.stun=0;continue;}
        if(distance(m,h)===1) {
          h.hp=Math.max(0,h.hp-m.attack);burst(h.x,h.y,'−'+m.attack,'#ff8d9d');
          if(h.hp===0) {finish(false);return;}
        } else if(distance(m,h)<=4&&state.turn%2===0) {
          const moves=DIRS.map(d=>({x:m.x+d[0],y:m.y+d[1]})).filter(p=>inside(p.x,p.y)&&state.grid[p.y][p.x]===0&&distance(p,h)>0&&!state.monsters.some(o=>o!==m&&o.x===p.x&&o.y===p.y)&&!(p.x===state.exit.x&&p.y===state.exit.y));
          moves.sort((a,b)=>distance(a,h)-distance(b,h));
          if(moves.length&&distance(moves[0],h)<distance(m,h)) {m.x=moves[0].x;m.y=moves[0].y;}
        }
      }
    }
    function commit() {state.turn++;enemyTurn();if(state.status==='playing') persist();}
    function move(dx,dy) {
      if(!state||state.status!=='playing') return false;
      const h=state.hero,x=h.x+dx,y=h.y+dy;
      if(!inside(x,y)||state.grid[y][x]!==0) return false;
      const enemy=state.monsters.find(m=>m.x===x&&m.y===y);
      if(enemy) {
        enemy.hp-=h.attack;enemy.stun=1;burst(x,y,'−'+h.attack,'#fff1c4');
        if(enemy.hp<=0) {state.monsters=state.monsters.filter(m=>m!==enemy);state.kills++;state.coins+=8;burst(x,y,'+8','#f9d278');}
      } else {
        if(x===state.exit.x&&y===state.exit.y&&h.keys===0) {call('toast','La porte attend sa clé. Cherchez le symbole doré.');return false;}
        h.x=x;h.y=y;pickUp();
        if(x===state.exit.x&&y===state.exit.y) {finish(true);return true;}
      }
      commit();return true;
    }
    function potion() {
      if(!state||state.status!=='playing') return;
      const h=state.hero;
      if(!h.potions) {call('toast','Aucune potion. Les coffres en contiennent.');return;}
      if(h.hp===h.maxHp) {call('toast','Votre vie est déjà au maximum.');return;}
      h.potions--;const amount=Math.min(6,h.maxHp-h.hp);h.hp+=amount;burst(h.x,h.y,'+'+amount+' PV','#83e7c3');commit();
    }
    function wait() {if(state&&state.status==='playing') commit();}
    function reset() {
      const rng=typeof api.random==='function'?api.random:Math.random;
      const seed=Math.floor(Math.max(0,Math.min(.9999999999,rng()))*4294967296)>>>0;
      state=makeFloor(1,seed);fx=[];held.clear();touch=null;ended=false;shownX=1;shownY=1;persist();
    }
    function next() {
      if(!state||state.status!=='won') return;
      if(state.floor>=999) {reset();return;}
      state=makeFloor(state.floor+1,state.seed,state);fx=[];touch=null;held.clear();ended=false;shownX=1;shownY=1;persist();call('toast','Étage '+state.floor+' : +6 PV. Trouvez la nouvelle clé.');
    }
    function update(dt) {
      dt=Math.max(0,Math.min(.1,Number(dt)||0));clock+=dt;
      if(state) {shownX+=(state.hero.x-shownX)*Math.min(1,dt*18);shownY+=(state.hero.y-shownY)*Math.min(1,dt*18);}
      fx.forEach(p=>{p.life-=dt;p.y-=dt*26;});fx=fx.filter(p=>p.life>0);
    }
    function pointer(type,x,y) {
      if(type==='cancel') {touch=null;return;}
      if(type==='down') {touch={x,y};return;}
      if(type!=='up'||!touch) return;
      const start=touch;touch=null;if(!state||state.status!=='playing') return;
      const dx=x-start.x,dy=y-start.y;
      if(Math.max(Math.abs(dx),Math.abs(dy))>22) {if(Math.abs(dx)>Math.abs(dy)) move(Math.sign(dx),0);else move(0,Math.sign(dy));return;}
      if(x>=34&&x<=207&&y>=529&&y<=575) {potion();return;}
      if(x>=219&&x<=386&&y>=529&&y<=575) {wait();return;}
      const cx=Math.floor((x-LEFT)/CELL),cy=Math.floor((y-TOP)/CELL),h=state.hero;
      if(Math.abs(cx-h.x)+Math.abs(cy-h.y)===1) move(cx-h.x,cy-h.y);
      else if(cx===h.x&&cy===h.y) wait();
      else if(x>=LEFT&&x<LEFT+COLS*CELL&&y>=TOP&&y<TOP+ROWS*CELL) call('toast','Touchez une case voisine ou glissez dans une direction.');
    }
    function key(key,down) {
      const k=String(key).toLowerCase();if(!down) {held.delete(k);return;}if(held.has(k)) return;held.add(k);
      if(['arrowup','w','z'].includes(k)) move(0,-1);
      else if(['arrowdown','s'].includes(k)) move(0,1);
      else if(['arrowleft','a','q'].includes(k)) move(-1,0);
      else if(['arrowright','d'].includes(k)) move(1,0);
      else if(k===' '||k==='space'||k==='spacebar'||k==='e') potion();
      else if(k==='enter') wait();
    }
    function panel(ctx,x,y,w,h,radius,fill,stroke) {
      ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fillStyle=fill;ctx.fill();
      if(stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
    }
    function text(ctx,value,x,y,size,color,weight,align) {
      ctx.fillStyle=color;ctx.font=(weight||'500')+' '+size+'px system-ui, sans-serif';ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillText(value,x,y);
    }
    function drawItem(ctx,item) {
      const x=LEFT+(item.x+.5)*CELL,y=TOP+(item.y+.5)*CELL;
      ctx.save();ctx.translate(x,y);ctx.shadowBlur=14;ctx.shadowColor=item.type==='potion'?'#68dcb9':'#edc774';
      if(item.type==='key') {ctx.strokeStyle='#f6ce76';ctx.lineWidth=4;ctx.beginPath();ctx.arc(-5,-4,6,0,Math.PI*2);ctx.moveTo(0,1);ctx.lineTo(10,11);ctx.lineTo(14,7);ctx.moveTo(6,7);ctx.lineTo(10,3);ctx.stroke();}
      else if(item.type==='potion') {panel(ctx,-8,-5,16,20,5,'#74dbb8');panel(ctx,-4,-13,8,9,2,'#c0ecd5');ctx.shadowBlur=0;text(ctx,'+',0,5,15,'#15443c','800','center');}
      else if(item.type==='chest') {panel(ctx,-14,-9,28,23,4,'#b78543','#f4c578');ctx.fillStyle='#f4c578';ctx.fillRect(-14,-2,28,4);ctx.fillRect(-3,-1,6,10);}
      else {ctx.fillStyle='#f6ce76';ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    function draw(ctx) {
      const bg=ctx.createLinearGradient(0,0,420,600);bg.addColorStop(0,'#171b30');bg.addColorStop(1,'#0b101c');ctx.fillStyle=bg;ctx.fillRect(0,0,420,600);
      text(ctx,'LES PROFONDEURS',34,35,11,'#92a0bc','700');text(ctx,'Donjon de poche',34,65,27,'#f3eddb','800');
      if(!state) {text(ctx,'Préparation du donjon…',210,300,16,'#c7d3e7','500','center');return;}
      const h=state.hero;
      panel(ctx,307,31,79,48,12,'#272738','#44415a');text(ctx,'CLÉ',346.5,45,9,'#abb2c7','700','center');text(ctx,h.keys?'TROUVÉE':'À TROUVER',346.5,64,10,h.keys?'#f6ce76':'#a4abc1','800','center');
      text(ctx,'Une case, un tour. Approchez pour frapper.',34,99,11,'#a9b6cc','500');
      panel(ctx,LEFT-6,TOP-6,COLS*CELL+12,ROWS*CELL+12,15,'#0b101a','#3a4055');
      for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
        const px=LEFT+x*CELL,py=TOP+y*CELL;
        if(state.grid[y][x]) {
          panel(ctx,px+2,py+2,CELL-4,CELL-4,6,(x+y)%2?'#262c40':'#2d3347');
          ctx.fillStyle='#3a4259';ctx.fillRect(px+8,py+7,CELL-16,2);ctx.fillStyle='#1c2234';ctx.fillRect(px+2,py+CELL-8,CELL-4,4);
        } else {
          panel(ctx,px+2,py+2,CELL-4,CELL-4,5,(x+y)%2?'#18212e':'#1b2533');
          if(distance({x,y},h)===1&&state.status==='playing') {ctx.strokeStyle='#47655f';ctx.lineWidth=1;ctx.strokeRect(px+5,py+5,CELL-10,CELL-10);}
        }
      }
      const ex=LEFT+(state.exit.x+.5)*CELL,ey=TOP+(state.exit.y+.5)*CELL;
      ctx.save();ctx.shadowColor=h.keys?'#f0c77b':'#7e87a4';ctx.shadowBlur=h.keys?14+Math.sin(clock*3)*4:0;
      panel(ctx,ex-15,ey-20,30,40,[12,12,2,2],'#282a36',h.keys?'#f0c77b':'#64718b');ctx.shadowBlur=0;text(ctx,h.keys?'↓':'·',ex,ey+1,28,h.keys?'#f0c77b':'#64718b','800','center');ctx.restore();
      state.items.forEach(item=>drawItem(ctx,item));
      for(const m of state.monsters) {
        const x=LEFT+(m.x+.5)*CELL,y=TOP+(m.y+.5)*CELL+Math.sin(clock*2+m.x)*2;
        ctx.save();ctx.translate(x,y);ctx.fillStyle='#080d16';ctx.beginPath();ctx.ellipse(0,14,15,6,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=m.kind?'#ac83d2':'#d17e83';ctx.beginPath();ctx.moveTo(-15,12);ctx.quadraticCurveTo(-18,-17,0,-18);ctx.quadraticCurveTo(18,-17,15,12);ctx.lineTo(6,7);ctx.lineTo(0,13);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();
        ctx.fillStyle='#1c1730';ctx.fillRect(-8,-5,5,5);ctx.fillRect(3,-5,5,5);ctx.fillStyle='#ffd6bb';ctx.fillRect(-7,-4,2,2);ctx.fillRect(4,-4,2,2);
        panel(ctx,-14,17,28,4,2,'#3e2c42');panel(ctx,-14,17,28*m.hp/m.maxHp,4,2,'#ed99a1');ctx.restore();
      }
      const hx=LEFT+(shownX+.5)*CELL,hy=TOP+(shownY+.5)*CELL;
      ctx.save();ctx.translate(hx,hy);ctx.shadowBlur=18;ctx.shadowColor='#71cbd0';ctx.fillStyle='#77c9cd';ctx.beginPath();ctx.moveTo(-14,15);ctx.lineTo(-10,-7);ctx.quadraticCurveTo(0,-26,10,-7);ctx.lineTo(14,15);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      panel(ctx,-9,-7,18,13,5,'#163744');ctx.fillStyle='#fff0cb';ctx.fillRect(-5,-3,3,3);ctx.fillRect(3,-3,3,3);ctx.strokeStyle='#e9e7d9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(13,6);ctx.lineTo(22,-5);ctx.stroke();ctx.restore();
      for(const p of fx) {ctx.globalAlpha=Math.min(1,p.life*2);text(ctx,p.text,p.x,p.y,15,p.color,'800','center');}ctx.globalAlpha=1;
      panel(ctx,34,529,173,46,12,h.potions&&h.hp<h.maxHp?'#244a43':'#1b2c30','#3a655a');text(ctx,'POTION ×'+h.potions,120.5,546,12,'#a2e4ca','800','center');text(ctx,'+6 PV · un tour',120.5,563,10,'#91bdb0','500','center');
      panel(ctx,219,529,167,46,12,'#252a3e','#454b65');text(ctx,'ATTENDRE',302.5,546,12,'#c2c9df','800','center');text(ctx,'Laisser venir les monstres',302.5,563,9,'#939eb8','500','center');
      text(ctx,'Glissez ou touchez une case voisine · Coffre = potion',210,591,9,'#77869e','500','center');
      if(state.status!=='playing') {ctx.fillStyle='rgba(8,12,21,.42)';ctx.fillRect(LEFT,TOP,COLS*CELL,ROWS*CELL);text(ctx,state.status==='won'?'ÉTAGE EXPLORÉ':'AVENTURE TERMINÉE',210,300,20,'#f4e6bc','800','center');}
    }
    function snapshot() {return state?copy(state):null;}
    function restore(data) {
      try {if(!validState(data)) return false;state=copy(data);ended=state.status!=='playing';touch=null;held.clear();fx=[];shownX=state.hero.x;shownY=state.hero.y;hud();return true;}catch(_) {return false;}
    }
    return {reset,next,update,draw,pointer,key,snapshot,restore};
  }
  global.createGame=createGame;
  if(typeof module!=='undefined'&&module.exports) module.exports={createGame,makeFloor,validState,reachable};
})(typeof window!=='undefined'?window:globalThis);
