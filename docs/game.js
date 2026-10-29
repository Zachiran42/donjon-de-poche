(function (global) {
  'use strict';
  const COLS=9, ROWS=10, CELL=38, LEFT=39, TOP=108, TORCH_MAX=30;
  const DIRS=[[0,-1],[1,0],[0,1],[-1,0]], TYPES=['key','potion','chest','coin','oil'];
  const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>0&&x<COLS-1&&y>0&&y<ROWS-1;
  const index=(x,y)=>y*COLS+x, pk=(x,y)=>x+','+y;
  const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const integer=(n,l,h)=>Number.isInteger(n)&&n>=l&&n<=h;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const wall=(grid,x,y)=>!grid[y]||grid[y][x]!==0;

  function randomFrom(seed) {
    let a=seed>>>0;
    return function() {
      a+=0x6D2B79F5; let t=Math.imul(a^(a>>>15),1|a);
      t^=t+Math.imul(t^(t>>>7),61|t);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function distances(grid,start) {
    const result=Array(COLS*ROWS).fill(-1), queue=[{x:start.x,y:start.y}];result[index(start.x,start.y)]=0;
    for(let n=0;n<queue.length;n++) for(const d of DIRS) {
      const x=queue[n].x+d[0],y=queue[n].y+d[1],i=index(x,y);
      if(inside(x,y)&&!wall(grid,x,y)&&result[i]<0) {result[i]=result[index(queue[n].x,queue[n].y)]+1;queue.push({x,y});}
    }
    return result;
  }
  function reachable(grid,start) {
    const ds=distances(grid,start),seen=new Set();
    for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(ds[index(x,y)]>=0)seen.add(pk(x,y));
    return seen;
  }
  /** A wall is visible itself, but blocks tiles behind it. Closed corners block diagonal peeking. */
  function hasLineOfSight(grid,ax,ay,bx,by) {
    if(!integer(ax,0,COLS-1)||!integer(ay,0,ROWS-1)||!integer(bx,0,COLS-1)||!integer(by,0,ROWS-1))return false;
    let x=ax,y=ay,dx=Math.abs(bx-ax),dy=Math.abs(by-ay),sx=ax<bx?1:-1,sy=ay<by?1:-1,error=dx-dy;
    while(x!==bx||y!==by) {
      const twice=error*2;let nx=x,ny=y;
      if(twice>-dy){error-=dy;nx+=sx;}if(twice<dx){error+=dx;ny+=sy;}
      if(nx!==x&&ny!==y&&(wall(grid,nx,y)||wall(grid,x,ny)))return false;
      x=nx;y=ny;
      if(x===bx&&y===by)return true;
      if(wall(grid,x,y))return false;
    }
    return true;
  }
  function visibleCells(s) {
    const h=s.hero,radius=h.torch>0?2.7:1.15,seen=new Set();
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(Math.hypot(x-h.x,y-h.y)<=radius&&hasLineOfSight(s.grid,h.x,h.y,x,y))seen.add(index(x,y));
    return seen;
  }
  function viewState(s) {
    const visible=visibleCells(s);
    return {visible,items:s.items.filter(i=>visible.has(index(i.x,i.y))),monsters:s.monsters.filter(m=>visible.has(index(m.x,m.y))),exit:visible.has(index(s.exit.x,s.exit.y))?s.exit:null,shrine:visible.has(index(s.shrine.x,s.shrine.y))?s.shrine:null};
  }
  function reveal(s) {for(const i of visibleCells(s))s.explored[i]=true;}
  function makeFloor(floor,seed,previous) {
    const rng=randomFrom(seed+floor*7919),heroStart={x:1,y:1};
    const grid=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>inside(x,y)?0:1));
    const fixed=new Set(['1,1','2,1','1,2','2,2']),candidates=[];
    for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(!fixed.has(pk(x,y)))candidates.push({x,y});
    for(let n=candidates.length-1;n>0;n--){const k=Math.floor(rng()*(n+1));[candidates[n],candidates[k]]=[candidates[k],candidates[n]];}
    let walls=0;const wallTarget=8+Math.min(5,Math.floor(floor/2));
    for(const p of candidates){if(walls>=wallTarget)break;grid[p.y][p.x]=1;if(reachable(grid,heroStart).size!==56-walls-1)grid[p.y][p.x]=0;else walls++;}
    const old=previous&&previous.hero;
    const hero={x:1,y:1,hp:old?Math.min(old.maxHp,old.hp+3):12,maxHp:old?old.maxHp:12,attack:old?old.attack:2,potions:old?old.potions:1,keys:0,torch:old?Math.min(TORCH_MAX,old.torch+8):TORCH_MAX,torchMax:TORCH_MAX,oil:old?Math.min(9,old.oil+1):1};
    const shrine={x:2,y:2,used:false},reserved=new Set(['1,1','2,1','1,2','2,2']);
    const startDistances=distances(grid,heroStart),free=candidates.filter(p=>!wall(grid,p.x,p.y));
    function choose(predicate,score) {
      const pool=free.filter(p=>!reserved.has(pk(p.x,p.y))&&(!predicate||predicate(p)));
      const fallback=pool.length?pool:free.filter(p=>!reserved.has(pk(p.x,p.y)));
      if(score)fallback.sort((a,b)=>score(b)-score(a));
      const choice=fallback[score?Math.floor(rng()*Math.min(3,fallback.length)):Math.floor(rng()*fallback.length)];
      reserved.add(pk(choice.x,choice.y));return {x:choice.x,y:choice.y};
    }
    // A locked staircase must never cut the rest of the map off from its key.
    const floorCount=grid.flat().filter(v=>v===0).length;
    const exits=free.filter(p=>!reserved.has(pk(p.x,p.y))).filter(p=>{grid[p.y][p.x]=1;const safe=reachable(grid,heroStart).size===floorCount-1;grid[p.y][p.x]=0;return safe;});
    exits.sort((a,b)=>startDistances[index(b.x,b.y)]-startDistances[index(a.x,a.y)]);
    const exit={...exits[Math.floor(rng()*Math.min(3,exits.length))]};reserved.add(pk(exit.x,exit.y));
    const exitDistances=distances(grid,exit);
    const key=choose(p=>startDistances[index(p.x,p.y)]>=6&&exitDistances[index(p.x,p.y)]>=6,p=>exitDistances[index(p.x,p.y)]);
    const nearOil=choose(p=>startDistances[index(p.x,p.y)]>=3&&startDistances[index(p.x,p.y)]<=5);
    const farOil=choose(p=>startDistances[index(p.x,p.y)]>=8);
    const chest=choose(p=>startDistances[index(p.x,p.y)]>=7);
    const potion=choose(p=>startDistances[index(p.x,p.y)]>=5);
    const items=[{id:'key',...key,type:'key'},{id:'oil-a',...nearOil,type:'oil'},{id:'oil-b',...farOil,type:'oil'},{id:'chest',...chest,type:'chest'},{id:'potion',...potion,type:'potion'}];
    const monsters=[],count=Math.min(6,3+Math.floor((floor-1)/3));
    for(let n=0;n<count;n++) {
      const kind=n%3,p=choose(p=>startDistances[index(p.x,p.y)]>=5&&!monsters.some(m=>distance(m,p)<2));
      const maxHp=[3,5,3][kind]+Math.min(4,Math.floor((floor-1)/3));
      monsters.push({id:'m'+n,...p,kind,hp:maxHp,maxHp,attack:[1,2,1][kind]+Math.min(2,Math.floor((floor-1)/7)),cooldown:0,intent:null,alert:0,target:{...p}});
    }
    const state={version:2,seed:seed>>>0,floor,grid,hero,items,monsters,exit,shrine,explored:Array(COLS*ROWS).fill(false),coins:previous?previous.coins:8,turn:0,darkTurns:0,mode:'explore',status:'playing',kills:previous?previous.kills:0};
    reveal(state);return state;
  }
  function intentCells(s,m) {
    if(!m.intent)return[];const cells=[],range=m.intent.type==='ray'?4:1;
    for(let n=1;n<=range;n++){const x=m.x+m.intent.dx*n,y=m.y+m.intent.dy*n;if(wall(s.grid,x,y))break;cells.push({x,y});}
    return cells;
  }
  function validState(s) {
    if(!s||s.version!==2||!integer(s.seed,0,4294967295)||!integer(s.floor,1,999))return false;
    if(!Array.isArray(s.grid)||s.grid.length!==ROWS||s.grid.some(r=>!Array.isArray(r)||r.length!==COLS||r.some(v=>v!==0&&v!==1)))return false;
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!inside(x,y)&&s.grid[y][x]!==1)return false;
    const h=s.hero;
    if(!h||!inside(h.x,h.y)||wall(s.grid,h.x,h.y)||!integer(h.maxHp,8,30)||!integer(h.hp,0,h.maxHp)||!integer(h.attack,1,7)||!integer(h.potions,0,9)||!integer(h.keys,0,1)||h.torchMax!==TORCH_MAX||!integer(h.torch,0,TORCH_MAX)||!integer(h.oil,0,9))return false;
    if(!s.exit||!inside(s.exit.x,s.exit.y)||wall(s.grid,s.exit.x,s.exit.y)||!s.shrine||!inside(s.shrine.x,s.shrine.y)||wall(s.grid,s.shrine.x,s.shrine.y)||typeof s.shrine.used!=='boolean'||pk(s.exit.x,s.exit.y)===pk(s.shrine.x,s.shrine.y))return false;
    if(reachable(s.grid,h).size!==s.grid.flat().filter(v=>v===0).length)return false;
    if(!['playing','won','lost'].includes(s.status)||(s.status!=='lost'&&h.hp===0)||(s.status==='lost'&&h.hp!==0))return false;
    if(s.status==='won'&&(h.x!==s.exit.x||h.y!==s.exit.y||h.keys!==1))return false;
    if(!['explore','shrine'].includes(s.mode)||(s.mode==='shrine'&&(s.status!=='playing'||s.shrine.used||h.x!==s.shrine.x||h.y!==s.shrine.y)))return false;
    if(!integer(s.coins,0,10000000)||!integer(s.turn,0,10000000)||!integer(s.kills,0,1000000)||!integer(s.darkTurns,0,10000000)||(h.torch>0&&s.darkTurns!==0))return false;
    if(!Array.isArray(s.explored)||s.explored.length!==COLS*ROWS||s.explored.some(v=>typeof v!=='boolean')||!s.explored[index(1,1)])return false;
    for(const i of visibleCells(s))if(!s.explored[i])return false;
    if(!Array.isArray(s.monsters)||s.monsters.length>9||!Array.isArray(s.items)||s.items.length>20)return false;
    const occupied=new Set([pk(h.x,h.y)]),ids=new Set();
    for(const m of s.monsters) {
      if(!m||typeof m.id!=='string'||m.id.length>32||ids.has(m.id)||!inside(m.x,m.y)||wall(s.grid,m.x,m.y)||occupied.has(pk(m.x,m.y))||!integer(m.maxHp,1,20)||!integer(m.hp,1,m.maxHp)||!integer(m.attack,1,5)||!integer(m.cooldown,0,1)||!integer(m.kind,0,2)||!integer(m.alert,0,4)||!m.target||!inside(m.target.x,m.target.y)||wall(s.grid,m.target.x,m.target.y))return false;
      if(m.intent!==null&&(!m.intent||!['melee','ray'].includes(m.intent.type)||!integer(m.intent.dx,-1,1)||!integer(m.intent.dy,-1,1)||Math.abs(m.intent.dx)+Math.abs(m.intent.dy)!==1||(m.intent.type==='ray'&&m.kind!==2)||m.cooldown!==0))return false;
      ids.add(m.id);occupied.add(pk(m.x,m.y));
    }
    const cells=new Set();let keys=0;
    for(const item of s.items) {
      if(!item||typeof item.id!=='string'||item.id.length>32||ids.has(item.id)||!TYPES.includes(item.type)||!inside(item.x,item.y)||wall(s.grid,item.x,item.y)||cells.has(pk(item.x,item.y))||(item.x===h.x&&item.y===h.y)||pk(item.x,item.y)===pk(s.exit.x,s.exit.y)||pk(item.x,item.y)===pk(s.shrine.x,s.shrine.y))return false;
      ids.add(item.id);cells.add(pk(item.x,item.y));if(item.type==='key')keys++;
    }
    if(keys!==(h.keys?0:1))return false;
    return true;
  }

  function createGame(api) {
    api=api||{};const progress=api.progress||(api.progress={});
    const call=(name,...args)=>typeof api[name]==='function'?api[name](...args):undefined;
    let state,clock=0,touch=null,fx=[],held=new Set(),shownX=1,shownY=1,ended=false;
    function hud(){if(state)call('hud','VIE',state.hero.hp+'/'+state.hero.maxHp,'TORCHE',state.hero.torch+'/'+TORCH_MAX,'ÉTAGE',String(state.floor));}
    function persist(){hud();call('save');}
    function burst(x,y,value,color){fx.push({gx:x,gy:y,x:LEFT+(x+.5)*CELL,y:TOP+(y+.4)*CELL,value,color,life:1});}
    function finish(won){
      if(ended)return;ended=true;state.status=won?'won':'lost';state.mode='explore';
      progress.bestFloor=Math.max(Number(progress.bestFloor)||0,won?state.floor:state.floor-1);progress.bestCoins=Math.max(Number(progress.bestCoins)||0,state.coins);
      persist();const score=state.coins+state.kills*20+(state.floor-(won?0:1))*100;
      call('end',won?'Étage '+state.floor+' traversé !':'La lumière s’éteint',won?'La descente suivante rend 3 PV, 8 tours de lumière et une fiole. Vos achats restent actifs.':'Explorez à la lumière, esquivez les cases rouges et gardez de l’huile pour le retour.',score,won);
    }
    function pickUp(){
      const h=state.hero;
      for(let i=state.items.length-1;i>=0;i--){const item=state.items[i];if(item.x!==h.x||item.y!==h.y)continue;
        if(item.type==='key'){h.keys=1;burst(h.x,h.y,'CLÉ','#f3cd78');call('toast','La clé est trouvée. Cherchez maintenant l’escalier.');}
        else if(item.type==='oil'){h.oil=Math.min(9,h.oil+1);burst(h.x,h.y,'+1 HUILE','#ffba64');call('toast','Fiole d’huile : utilisez RAVIVER au bon moment (+20 lumière, un tour).');}
        else if(item.type==='potion'){h.potions=Math.min(9,h.potions+1);burst(h.x,h.y,'+1 POTION','#8de0c6');}
        else if(item.type==='chest'){state.coins+=12+Math.min(10,state.floor);burst(h.x,h.y,'+'+(12+Math.min(10,state.floor))+' PIÈCES','#f3cd78');call('toast','Ce détour paie. L’autel échange vos pièces contre une seule bénédiction.');}
        else{state.coins+=4;burst(h.x,h.y,'+4','#f3cd78');}
        state.items.splice(i,1);
      }
    }
    function damage(amount){state.hero.hp=Math.max(0,state.hero.hp-amount);burst(state.hero.x,state.hero.y,'−'+amount+' PV','#ff8d9d');if(state.hero.hp===0){finish(false);return true;}return false;}
    function enemyTurn(){
      const h=state.hero,visible=visibleCells(state);
      for(const m of state.monsters){
        if(m.intent){const hit=intentCells(state,m).some(p=>p.x===h.x&&p.y===h.y);m.intent=null;m.cooldown=1;if(hit&&damage(m.attack))return;continue;}
        if(m.cooldown){m.cooldown--;continue;}
        const d=distance(m,h),canSeeHero=d<=5&&hasLineOfSight(state.grid,m.x,m.y,h.x,h.y)&&(h.torch>0||d<=1);
        if(canSeeHero){m.alert=4;m.target={x:h.x,y:h.y};}else if(m.alert)m.alert--;
        if(visible.has(index(m.x,m.y))&&d===1){m.intent={type:'melee',dx:h.x-m.x,dy:h.y-m.y};continue;}
        if(visible.has(index(m.x,m.y))&&m.kind===2&&d<=4&&(m.x===h.x||m.y===h.y)&&hasLineOfSight(state.grid,m.x,m.y,h.x,h.y)){m.intent={type:'ray',dx:Math.sign(h.x-m.x),dy:Math.sign(h.y-m.y)};continue;}
        if(!m.alert||(m.kind===1&&state.turn%2===1)||(m.kind===2&&state.turn%2===1))continue;
        const ds=distances(state.grid,m.target);
        const moves=DIRS.map(v=>({x:m.x+v[0],y:m.y+v[1]})).filter(p=>inside(p.x,p.y)&&!wall(state.grid,p.x,p.y)&&!(p.x===h.x&&p.y===h.y)&&!(p.x===state.exit.x&&p.y===state.exit.y)&&!state.monsters.some(o=>o!==m&&o.x===p.x&&o.y===p.y));
        moves.sort((a,b)=>ds[index(a.x,a.y)]-ds[index(b.x,b.y)]);
        if(moves.length&&ds[index(moves[0].x,moves[0].y)]<ds[index(m.x,m.y)]){m.x=moves[0].x;m.y=moves[0].y;}
      }
    }
    function commit(escape){
      state.turn++;const h=state.hero;
      if(h.torch>0){h.torch--;state.darkTurns=0;}else{state.darkTurns++;if(state.darkTurns%3===0&&damage(1))return;}
      reveal(state);if(escape){finish(true);return;}
      enemyTurn();if(state.status!=='playing')return;
      if(h.x===state.shrine.x&&h.y===state.shrine.y&&!state.shrine.used)state.mode='shrine';
      persist();
    }
    function move(dx,dy){
      if(!state||state.status!=='playing'||state.mode!=='explore')return false;
      const h=state.hero,x=h.x+dx,y=h.y+dy;if(!inside(x,y)||wall(state.grid,x,y))return false;
      const enemy=state.monsters.find(m=>m.x===x&&m.y===y);
      if(enemy){enemy.hp-=h.attack;burst(x,y,'−'+h.attack,'#fff0c5');if(enemy.hp<=0){state.monsters=state.monsters.filter(m=>m!==enemy);state.kills++;const reward=enemy.kind===1?6:4;state.coins+=reward;burst(x,y,'+'+reward+' PIÈCES','#f3cd78');}}
      else{
        if(x===state.exit.x&&y===state.exit.y&&!h.keys){call('toast','L’escalier est verrouillé. La clé reste à découvrir.');return false;}
        h.x=x;h.y=y;pickUp();
      }
      commit(!enemy&&x===state.exit.x&&y===state.exit.y);return true;
    }
    function potion(){
      if(!state||state.status!=='playing'||state.mode!=='explore')return false;const h=state.hero;
      if(!h.potions){call('toast','Aucune potion : un flacon attend peut-être dans l’ombre.');return false;}
      if(h.hp===h.maxHp){call('toast','Votre vie est déjà pleine. Gardez la potion.');return false;}
      h.potions--;const amount=Math.min(6,h.maxHp-h.hp);h.hp+=amount;burst(h.x,h.y,'+'+amount+' PV','#8de0c6');commit();return true;
    }
    function refuel(){
      if(!state||state.status!=='playing'||state.mode!=='explore')return false;const h=state.hero;
      if(!h.oil){call('toast','Plus d’huile. Un autel peut aussi raviver la torche.');return false;}
      if(h.torch>=TORCH_MAX-1){call('toast','La torche brûle déjà fort. Gardez votre huile.');return false;}
      h.oil--;const amount=Math.min(20,TORCH_MAX-h.torch);h.torch+=amount;state.darkTurns=0;burst(h.x,h.y,'+'+amount+' LUMIÈRE','#ffc16a');commit();return true;
    }
    function wait(){if(state&&state.status==='playing'&&state.mode==='explore'){commit();return true;}return false;}
    function shrineChoice(choice){
      if(!state||state.status!=='playing'||state.mode!=='shrine')return false;
      if(choice===0){state.mode='explore';persist();call('toast','Aucune bénédiction consommée. Explorez, puis revenez sur l’autel quand vous voulez.');return true;}
      const h=state.hero,cost=choice===1?5:choice===2?6:10+(h.attack-2)*3;
      if(![1,2,3].includes(choice)||state.coins<cost){call('toast','Pas assez de pièces pour cette bénédiction. Vous pouvez repartir sans achat.');return false;}
      if(choice===1&&h.hp===h.maxHp){call('toast','Votre vie est pleine : choisissez une autre bénédiction.');return false;}
      if(choice===2&&h.torch>=TORCH_MAX-1){call('toast','La torche est pleine : choisissez une autre bénédiction.');return false;}
      if(choice===3&&h.attack>=7){call('toast','Votre lame a atteint sa puissance maximale.');return false;}
      state.coins-=cost;state.shrine.used=true;state.mode='explore';
      if(choice===1){h.hp=Math.min(h.maxHp,h.hp+6);call('toast','Soin reçu. Les deux autres bénédictions disparaissent.');}
      if(choice===2){h.torch=Math.min(TORCH_MAX,h.torch+24);state.darkTurns=0;call('toast','La torche renaît. Les deux autres bénédictions disparaissent.');}
      if(choice===3){h.attack++;call('toast','Lame renforcée jusqu’à la fin de cette aventure.');}
      commit();return true;
    }
    function reset(){
      const rng=typeof api.random==='function'?api.random:Math.random,n=Number(rng());const seed=Math.floor(Math.max(0,Math.min(.9999999999,Number.isFinite(n)?n:.5))*4294967296)>>>0;
      state=makeFloor(1,seed);fx=[];held.clear();touch=null;ended=false;shownX=1;shownY=1;persist();call('toast','Chaque action consomme de la lumière. Les cases rouges annoncent la prochaine frappe.');
    }
    function next(){
      if(!state||state.status!=='won')return;if(state.floor>=999){reset();return;}
      state=makeFloor(state.floor+1,state.seed,state);fx=[];touch=null;held.clear();ended=false;shownX=1;shownY=1;persist();call('toast','Une nouvelle carte, la même aventure. Vos achats et ressources sont conservés.');
    }
    function update(dt){dt=Math.max(0,Math.min(.1,Number(dt)||0));clock+=dt;if(state){shownX+=(state.hero.x-shownX)*Math.min(1,dt*18);shownY+=(state.hero.y-shownY)*Math.min(1,dt*18);}fx.forEach(p=>{p.life-=dt;p.y-=dt*20;});fx=fx.filter(p=>p.life>0);}
    function pointer(type,x,y){
      if(type==='cancel'){touch=null;return;}if(type==='down'){touch={x,y};return;}if(type!=='up'||!touch)return;
      const start=touch;touch=null;if(!state||state.status!=='playing')return;
      if(state.mode==='shrine'){
        if(y>=224&&y<=376){for(let n=0;n<3;n++)if(x>=28+n*124&&x<=144+n*124){shrineChoice(n+1);return;}}
        if(x>=80&&x<=340&&y>=405&&y<=449)shrineChoice(0);return;
      }
      const dx=x-start.x,dy=y-start.y;
      if(Math.max(Math.abs(dx),Math.abs(dy))>20){if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx),0);else move(0,Math.sign(dy));return;}
      if(y>=517&&y<=562){if(x>=26&&x<=144)potion();else if(x>=151&&x<=269)refuel();else if(x>=276&&x<=394)wait();return;}
      if(x<LEFT||x>=LEFT+COLS*CELL||y<TOP||y>=TOP+ROWS*CELL)return;
      const cx=Math.floor((x-LEFT)/CELL),cy=Math.floor((y-TOP)/CELL),h=state.hero,tx=cx-h.x,ty=cy-h.y;
      if(!tx&&!ty){if(h.x===state.shrine.x&&h.y===state.shrine.y&&!state.shrine.used){state.mode='shrine';persist();}else wait();return;}
      if(Math.abs(tx)>=Math.abs(ty))move(Math.sign(tx),0);else move(0,Math.sign(ty));
    }
    function key(key,down){
      const k=String(key).toLowerCase();if(!down){held.delete(k);return;}if(held.has(k))return;held.add(k);
      if(state&&state.mode==='shrine'){if(['1','2','3'].includes(k))shrineChoice(Number(k));else if(k==='enter'||k==='0')shrineChoice(0);return;}
      if(['arrowup','w','z'].includes(k))move(0,-1);else if(['arrowdown','s'].includes(k))move(0,1);else if(['arrowleft','a','q'].includes(k))move(-1,0);else if(['arrowright','d'].includes(k))move(1,0);else if([' ','space','spacebar','e'].includes(k))potion();else if(k==='f')refuel();else if(k==='enter')wait();
    }
    function panel(ctx,x,y,w,h,radius,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
    function text(ctx,value,x,y,size,color,weight,align){ctx.fillStyle=color;ctx.font=(weight||'500')+' '+size+'px system-ui, sans-serif';ctx.textAlign=align||'left';ctx.textBaseline='middle';ctx.fillText(value,x,y);}
    function drawItem(ctx,item){
      const x=LEFT+(item.x+.5)*CELL,y=TOP+(item.y+.5)*CELL;ctx.save();ctx.translate(x,y);ctx.shadowBlur=10;ctx.shadowColor=item.type==='potion'?'#68dcb9':'#e9b96c';
      if(item.type==='key'){ctx.strokeStyle='#f3cc78';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-5,-3,5,0,Math.PI*2);ctx.moveTo(0,1);ctx.lineTo(9,10);ctx.lineTo(13,6);ctx.moveTo(5,6);ctx.lineTo(9,2);ctx.stroke();}
      else if(item.type==='potion'){panel(ctx,-7,-4,14,17,4,'#75d8b7');panel(ctx,-3,-10,6,7,2,'#c1e9d2');ctx.shadowBlur=0;text(ctx,'+',0,4,12,'#17453b','800','center');}
      else if(item.type==='oil'){panel(ctx,-7,-6,14,20,4,'#d29047','#ffe1a4');panel(ctx,-4,-11,8,6,2,'#c5b28b');ctx.shadowBlur=0;text(ctx,'•',0,3,17,'#fff0bc','800','center');}
      else if(item.type==='chest'){panel(ctx,-12,-8,24,20,4,'#ab7740','#ecc27b');ctx.fillStyle='#edc27a';ctx.fillRect(-12,-2,24,3);ctx.fillRect(-2,-1,4,9);}
      else{ctx.fillStyle='#efc674';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();}ctx.restore();
    }
    function drawMonster(ctx,m){
      const x=LEFT+(m.x+.5)*CELL,y=TOP+(m.y+.5)*CELL+Math.sin(clock*2+m.x)*1.5;ctx.save();ctx.translate(x,y);
      ctx.fillStyle='#090e14';ctx.beginPath();ctx.ellipse(0,12,13,5,0,0,Math.PI*2);ctx.fill();
      if(m.kind===1){panel(ctx,-12,-14,24,27,5,'#a286b6','#d2b2da');panel(ctx,-8,-5,16,14,4,'#484156');ctx.fillStyle='#ffb3a4';ctx.fillRect(-5,-8,3,3);ctx.fillRect(3,-8,3,3);}
      else if(m.kind===2){ctx.fillStyle='#c28d71';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(13,11);ctx.lineTo(-13,11);ctx.closePath();ctx.fill();panel(ctx,-8,-6,16,10,4,'#332631');ctx.fillStyle='#ffe3ad';ctx.fillRect(-4,-3,2,2);ctx.fillRect(3,-3,2,2);ctx.strokeStyle='#d6b78c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(9,3,7,-1.2,1.2);ctx.stroke();}
      else{ctx.fillStyle='#a5ae75';ctx.beginPath();ctx.moveTo(-13,11);ctx.quadraticCurveTo(-16,-14,0,-15);ctx.quadraticCurveTo(16,-14,13,11);ctx.lineTo(5,7);ctx.lineTo(0,12);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.fillStyle='#28352c';ctx.fillRect(-7,-4,4,4);ctx.fillRect(3,-4,4,4);}
      panel(ctx,-12,14,24,3,1,'#442f3d');panel(ctx,-12,14,24*m.hp/m.maxHp,3,1,'#ec9a99');
      if(m.intent)text(ctx,m.intent.type==='ray'?'TIR !':'!',0,-23,m.intent.type==='ray'?8:15,'#ffb79b','900','center');
      ctx.restore();
    }
    function drawShrineMenu(ctx){
      ctx.fillStyle='rgba(5,10,17,.91)';ctx.fillRect(LEFT-6,TOP-6,COLS*CELL+12,ROWS*CELL+12);
      text(ctx,'L’AUTEL DU VEILLEUR',210,160,18,'#f0dbaf','800','center');text(ctx,'Une seule bénédiction par étage.',210,185,11,'#aeb6bd','500','center');
      const h=state.hero,cards=[['SOIN',h.hp===h.maxHp?'Vie complète':'+'+Math.min(6,h.maxHp-h.hp)+' PV',5,'#91dcc0'],['LUMIÈRE',h.torch>=TORCH_MAX-1?'Torche suffisante':'+'+Math.min(24,TORCH_MAX-h.torch)+' lumière',6,'#ffbe6a'],['LAME',h.attack>=7?'Lame maximale':'+1 dégât',10+(h.attack-2)*3,'#c2a1e7']];
      cards.forEach((card,n)=>{const x=28+n*124,available=state.coins>=card[2]&&(n!==0||h.hp<h.maxHp)&&(n!==1||h.torch<TORCH_MAX-1)&&(n!==2||h.attack<7);panel(ctx,x,224,116,152,12,available?'#26303b':'#171d29',available?card[3]:'#39404a');text(ctx,String(n+1),x+58,248,14,card[3],'800','center');text(ctx,card[0],x+58,279,12,card[3],'800','center');text(ctx,card[1],x+58,307,12,'#e7e1d0','600','center');text(ctx,card[2]+' pièces',x+58,345,11,available?'#eacb84':'#77818d','700','center');});
      panel(ctx,80,405,260,44,10,'#1c2732','#55616e');text(ctx,'REVENIR PLUS TARD',210,427,12,'#d0d6d7','700','center');text(ctx,'Acheter consomme un tour.',210,470,10,'#9ba8b2','500','center');
    }
    function draw(ctx){
      const bg=ctx.createLinearGradient(0,0,420,600);bg.addColorStop(0,'#171c2c');bg.addColorStop(1,'#0b111b');ctx.fillStyle=bg;ctx.fillRect(0,0,420,600);
      text(ctx,'DONJON DE POCHE',26,31,22,'#f3ead4','800');text(ctx,'Un pas, un tour. L’ombre cache les dangers.',26,58,10,'#a8b3c4','500');
      if(!state)return;const h=state.hero,v=viewState(state);
      panel(ctx,310,16,84,46,10,'#2a2936','#484051');text(ctx,'PIÈCES',352,29,8,'#b8b4bd','700','center');text(ctx,String(state.coins),352,48,17,'#efca7a','800','center');
      panel(ctx,26,77,368,9,4,'#332a28');if(h.torch>0)panel(ctx,26,77,368*h.torch/TORCH_MAX,9,4,'#e8ae62');text(ctx,h.torch?'La lumière révèle les cases proches.':'BRAISE : vision réduite, −1 PV tous les 3 tours.',210,97,9,h.torch?'#bcb09b':'#f1ad8b','600','center');
      panel(ctx,LEFT-5,TOP-5,COLS*CELL+10,ROWS*CELL+10,12,'#080d14','#303b4b');
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        const i=index(x,y),px=LEFT+x*CELL,py=TOP+y*CELL;
        if(!state.explored[i]){ctx.fillStyle='#070c12';ctx.fillRect(px,py,CELL,CELL);continue;}
        const lit=v.visible.has(i),solid=state.grid[y][x];
        panel(ctx,px+1,py+1,CELL-2,CELL-2,4,solid?(lit?'#343b47':'#151c27'):(lit?((x+y)%2?'#293137':'#30363a'):'#101821'));
        if(solid){ctx.fillStyle=lit?'#50525a':'#222a35';ctx.fillRect(px+5,py+5,CELL-10,2);}
        else if(lit&&distance({x,y},h)===1){ctx.strokeStyle='#7d785f';ctx.lineWidth=1;ctx.strokeRect(px+4,py+4,CELL-8,CELL-8);}
      }
      // The warm torch wash is clipped to actual line-of-sight cells, never to hidden entities.
      ctx.save();ctx.beginPath();for(const i of v.visible){const x=i%COLS,y=Math.floor(i/COLS);ctx.rect(LEFT+x*CELL,TOP+y*CELL,CELL,CELL);}ctx.clip();
      const hx=LEFT+(shownX+.5)*CELL,hy=TOP+(shownY+.5)*CELL,r=(h.torch>0?3.1:1.4)*CELL;
      const glow=ctx.createRadialGradient(hx,hy,0,hx,hy,r);glow.addColorStop(0,'rgba(255,190,92,.28)');glow.addColorStop(.55,'rgba(255,166,67,.10)');glow.addColorStop(1,'rgba(255,135,55,0)');ctx.fillStyle=glow;ctx.fillRect(LEFT,TOP,COLS*CELL,ROWS*CELL);ctx.restore();
      for(const m of v.monsters)if(m.intent)for(const p of intentCells(state,m))if(v.visible.has(index(p.x,p.y))){ctx.fillStyle='rgba(234,106,100,.25)';ctx.fillRect(LEFT+p.x*CELL+3,TOP+p.y*CELL+3,CELL-6,CELL-6);ctx.strokeStyle='#d98b7e';ctx.lineWidth=1.4;ctx.strokeRect(LEFT+p.x*CELL+4,TOP+p.y*CELL+4,CELL-8,CELL-8);}
      if(v.shrine){const x=LEFT+(v.shrine.x+.5)*CELL,y=TOP+(v.shrine.y+.5)*CELL;panel(ctx,x-12,y-10,24,23,4,v.shrine.used?'#4a4247':'#725b82',v.shrine.used?'#62565e':'#ccb0da');text(ctx,v.shrine.used?'·':'✧',x,y,22,v.shrine.used?'#91818b':'#eddcba','800','center');}
      if(v.exit){const x=LEFT+(v.exit.x+.5)*CELL,y=TOP+(v.exit.y+.5)*CELL;panel(ctx,x-12,y-16,24,32,[9,9,2,2],'#34333b',h.keys?'#edc574':'#7b8295');text(ctx,h.keys?'↓':'×',x,y+1,23,h.keys?'#f0d299':'#8f9aad','800','center');}
      v.items.forEach(item=>drawItem(ctx,item));v.monsters.forEach(m=>drawMonster(ctx,m));
      ctx.save();ctx.translate(hx,hy);ctx.shadowBlur=14;ctx.shadowColor='#85c9c5';ctx.fillStyle='#79c8c6';ctx.beginPath();ctx.moveTo(-11,13);ctx.lineTo(-8,-6);ctx.quadraticCurveTo(0,-21,8,-6);ctx.lineTo(11,13);ctx.closePath();ctx.fill();ctx.shadowBlur=0;panel(ctx,-7,-6,14,10,4,'#1d3a43');ctx.fillStyle='#fff0cb';ctx.fillRect(-4,-3,2,2);ctx.fillRect(3,-3,2,2);ctx.strokeStyle='#e7dfcf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(11,4);ctx.lineTo(17,-5);ctx.stroke();ctx.fillStyle=h.torch?'#ffc36f':'#b57651';ctx.beginPath();ctx.ellipse(-14,-3,3.5,5+Math.sin(clock*9),0,0,Math.PI*2);ctx.fill();ctx.restore();
      for(const p of fx)if(v.visible.has(index(p.gx,p.gy))){ctx.globalAlpha=Math.min(1,p.life*2);text(ctx,p.value,p.x,p.y,11,p.color,'800','center');}ctx.globalAlpha=1;
      text(ctx,(h.keys?'CLÉ TROUVÉE':'CLÉ À DÉCOUVRIR')+'  ·  Lame '+h.attack+'  ·  '+(state.shrine.used?'Autel utilisé':'Autel : un choix'),210,501,9,h.keys?'#e9c782':'#9da9bc','600','center');
      const buttons=[['POTION ×'+h.potions,'+6 PV · un tour','#9adcc4'],['RAVIVER ×'+h.oil,'+'+Math.min(20,TORCH_MAX-h.torch)+' lumière · un tour','#e9bd77'],['ATTENDRE','Attirer / esquiver','#bac4dd']];
      buttons.forEach((b,n)=>{panel(ctx,26+n*125,517,118,45,10,'#202b38','#3e4c5d');text(ctx,b[0],85+n*125,534,11,b[2],'800','center');text(ctx,b[1],85+n*125,552,8,'#a2adbc','500','center');});
      text(ctx,'Touche une direction autour du héros, ou glisse.',210,578,10,'#91a0b0','600','center');text(ctx,'Rouge : frappe au prochain tour · F : huile · E : potion',210,594,8,'#748396','500','center');
      if(state.mode==='shrine')drawShrineMenu(ctx);
      if(state.status!=='playing'){ctx.fillStyle='rgba(5,10,17,.6)';ctx.fillRect(LEFT,TOP,COLS*CELL,ROWS*CELL);text(ctx,state.status==='won'?'DESCENTE OUVERTE':'AVENTURE TERMINÉE',210,300,18,'#f2ddb3','800','center');}
    }
    function snapshot(){return state?copy(state):null;}
    function restore(data){try{if(!validState(data))return false;state=copy(data);ended=state.status!=='playing';touch=null;held.clear();fx=[];shownX=state.hero.x;shownY=state.hero.y;hud();return true;}catch(_){return false;}}
    return {reset,next,update,draw,pointer,key,snapshot,restore};
  }
  global.createGame=createGame;
  if(typeof module!=='undefined'&&module.exports)module.exports={createGame,makeFloor,validState,reachable,distances,visibleCells,viewState,hasLineOfSight,intentCells,COLS,ROWS,CELL,LEFT,TOP,TORCH_MAX};
})(typeof window!=='undefined'?window:globalThis);
