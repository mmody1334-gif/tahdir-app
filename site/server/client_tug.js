// ========== شدّ الحبل ==========
// لاعبان على شاشة واحدة (السبورة أو الآيباد): لكل لاعب أسئلته وأزراره. الإجابة الصحيحة تشدّ الحبل
// خطوة نحوه، والخطأ يجمّده لحظة. ثلاث إجابات صحيحة متتالية = «شدّة مضاعفة». يفوز من يسحب الراية لخطّه.
// الأصوات مولَّدة بـ WebAudio (بلا ملفات)، والمشهد SVG متحرّك، والاحتفال قصاصات ملوّنة على canvas.
var TUG_C=['#e21b3c','#1368ce'];
var tugA=null;
function tugCtx(){try{tugA=tugA||new (window.AudioContext||window.webkitAudioContext)();if(tugA.state==='suspended')tugA.resume();return tugA;}catch(e){return null;}}
function tone(a,type,f0,f1,t0,dur,vol){var o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f0,t0);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t0+dur);g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.012);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g);g.connect(a.destination);o.start(t0);o.stop(t0+dur+.05);}
function noise(a,t0,dur,vol,f0,f1,q){var n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;var s=a.createBufferSource();s.buffer=b;var bp=a.createBiquadFilter();bp.type='bandpass';bp.Q.value=q||1.2;bp.frequency.setValueAtTime(f0,t0);bp.frequency.exponentialRampToValueAtTime(f1,t0+dur);var g=a.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+dur*.25);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);s.connect(bp);bp.connect(g);g.connect(a.destination);s.start(t0);s.stop(t0+dur);}
function sfx(k){
  if(!sound)return;var a=tugCtx();if(!a)return;var t=a.currentTime;
  if(k==='ok'){tone(a,'sine',784,784,t,.12,.18);tone(a,'sine',1175,1175,t+.08,.22,.16);}
  else if(k==='pull'){noise(a,t,.28,.25,500,2600,1.4);tone(a,'sine',140,60,t,.18,.35);}
  else if(k==='bad'){tone(a,'square',160,110,t,.32,.07);tone(a,'sawtooth',120,90,t,.32,.05);}
  else if(k==='freeze'){tone(a,'triangle',1800,2600,t,.25,.05);}
  else if(k==='count'){tone(a,'sine',660,660,t,.18,.2);}
  else if(k==='go'){tone(a,'sine',990,990,t,.12,.22);tone(a,'sine',1320,1320,t+.1,.4,.22);noise(a,t,.6,.12,800,3000,.7);}
  else if(k==='fire'){tone(a,'sawtooth',300,1200,t,.35,.08);noise(a,t,.35,.1,1000,4000,1);}
  else if(k==='kick'){tone(a,'sine',150,45,t,.16,.45);}
  else if(k==='win'){[523,659,784,1046].forEach(function(f,i){tone(a,'triangle',f,f,t+i*.12,.32,.2);});tone(a,'triangle',1046,1046,t+.5,.8,.22);tone(a,'triangle',1318,1318,t+.5,.8,.15);noise(a,t+.3,1.6,.18,700,1800,.5);}
  else if(k==='tie'){tone(a,'triangle',523,392,t,.5,.18);}
}
function tugFigure(x,color,dir,i){
  // شخص يشدّ: dir=1 يميل يمينًا (فريق اليمين)، -1 يسارًا. الرأس والجسم والذراعان نحو الحبل
  var lean=dir*14,hx=x+lean;
  return '<g class="tf tf'+i+'" style="--d:'+dir+'">'+
    '<line x1="'+(x+dir*-6)+'" y1="250" x2="'+x+'" y2="205" stroke="#24323a" stroke-width="7" stroke-linecap="round"/>'+
    '<line x1="'+(x+dir*14)+'" y1="252" x2="'+x+'" y2="205" stroke="#24323a" stroke-width="7" stroke-linecap="round"/>'+
    '<line x1="'+x+'" y1="205" x2="'+hx+'" y2="150" stroke="'+color+'" stroke-width="16" stroke-linecap="round"/>'+
    '<line x1="'+(hx-dir*2)+'" y1="160" x2="'+(x-dir*26)+'" y2="172" stroke="'+color+'" stroke-width="7" stroke-linecap="round"/>'+
    '<circle cx="'+(hx+dir*3)+'" cy="132" r="15" fill="#f1c9a5" stroke="#24323a" stroke-width="2"/>'+
    '<path d="M'+(hx+dir*3-16)+' 128 a16 14 0 0 1 32 0 z" fill="'+color+'"/>'+
    '<circle cx="'+(hx+dir*9)+'" cy="133" r="2.2" fill="#24323a"/>'+
    '</g>';
}
function tugScene(){
  var r=TUG_C[0],b=TUG_C[1];
  return '<svg class="tug-svg" viewBox="0 0 800 290" role="img" aria-label="ساحة شدّ الحبل">'+
    '<defs><linearGradient id="tgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f6ff"/><stop offset="1" stop-color="#fff"/></linearGradient>'+
    '<pattern id="tgRope" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#c58b45"/><path d="M0 10 L7 0 M7 10 L14 0" stroke="#8a5a24" stroke-width="3"/></pattern></defs>'+
    '<rect width="800" height="290" fill="url(#tgSky)"/>'+
    '<rect y="252" width="800" height="38" fill="#cfe8c4"/><rect y="252" width="800" height="5" fill="#9ccb88"/>'+
    '<rect x="0" y="252" width="200" height="38" fill="'+b+'" opacity=".14"/><rect x="600" y="252" width="200" height="38" fill="'+r+'" opacity=".14"/>'+
    '<line x1="400" y1="60" x2="400" y2="290" stroke="#24323a" stroke-width="3" stroke-dasharray="8 8" opacity=".55"/>'+
    '<line x1="200" y1="90" x2="200" y2="290" stroke="'+b+'" stroke-width="4" stroke-dasharray="4 6"/><line x1="600" y1="90" x2="600" y2="290" stroke="'+r+'" stroke-width="4" stroke-dasharray="4 6"/>'+
    '<text x="200" y="84" text-anchor="middle" font-size="22">🏁</text><text x="600" y="84" text-anchor="middle" font-size="22">🏁</text>'+
    '<g id="tugMove" class="tug-move">'+
      '<rect x="215" y="166" width="370" height="10" rx="5" fill="url(#tgRope)"/>'+
      '<g class="tug-flag"><line x1="400" y1="171" x2="400" y2="210" stroke="#24323a" stroke-width="3"/><path d="M400 176 L428 186 L400 196 Z" fill="#ffd400" stroke="#24323a" stroke-width="2"/><circle cx="400" cy="171" r="7" fill="#ffd400" stroke="#24323a" stroke-width="2"/></g>'+
      '<g id="tugR" class="tug-team r">'+tugFigure(490,r,1,0)+tugFigure(555,r,1,1)+'</g>'+
      '<g id="tugB" class="tug-team b">'+tugFigure(310,b,-1,0)+tugFigure(245,b,-1,1)+'</g>'+
      '<g id="tugDust"></g>'+
    '</g></svg>';
}
function gTug(g){
  var names=[teams[0]?teams[0].name:'الفريق الأحمر',teams[1]?teams[1].name:'الفريق الأزرق'];
  var cfg={target:+(lsGet('tug_target')||5),time:+(lsGet('tug_time')||90),beat:lsGet('tug_beat')!==false};
  var h='<div class="g-setup tug-setup"><div class="tug-hero">'+tugScene()+'</div><h3>🪢 شدّ الحبل</h3>'+
    '<p class="muted">لاعبان (أو فريقان) على شاشة واحدة. كل جهة لها أسئلتها: الإجابة الصحيحة تشدّ الحبل نحوك، والخطأ يجمّدك لحظة. ثلاث إجابات صحيحة متتالية = 🔥 شدّة مضاعفة!</p>'+
    '<div class="tug-names"><label style="--tc:'+TUG_C[0]+'">🟥 اللاعب الأيمن<input id="tgN1" value="'+esc(names[0])+'" maxlength="24"></label><label style="--tc:'+TUG_C[1]+'">🟦 اللاعب الأيسر<input id="tgN2" value="'+esc(names[1])+'" maxlength="24"></label></div>'+
    '<div class="tug-opts"><label>طول الحبل <select id="tgT"><option value="4">قصير (سريع)</option><option value="5">عادي</option><option value="7">طويل</option><option value="9">طويل جدًا</option></select></label>'+
    '<label>الوقت <select id="tgS"><option value="60">دقيقة</option><option value="90">دقيقة ونصف</option><option value="120">دقيقتان</option><option value="180">3 دقائق</option><option value="0">بلا وقت</option></select></label>'+
    '<label class="tug-chk"><input type="checkbox" id="tgB"'+(cfg.beat?' checked':'')+'> طبول الحماس 🥁</label></div>'+
    '<button type="button" class="btn primary go-btn" id="tgGo">ابدأ النزال 🪢</button>'+
    '<p class="muted small">⌨️ على لوحة المفاتيح: اللاعب الأيمن 7 8 9 0 · اللاعب الأيسر 1 2 3 4</p></div>';
  $('gmain').innerHTML=stage(g.name,h);bindStage();
  $('tgT').value=String(cfg.target);$('tgS').value=String(cfg.time);
  $('tgGo').onclick=function(){
    names=[$('tgN1').value.trim()||'الأحمر',$('tgN2').value.trim()||'الأزرق'];
    if(teams[0])teams[0].name=names[0];if(teams[1])teams[1].name=names[1];saveTeams();
    cfg.target=+$('tgT').value;cfg.time=+$('tgS').value;cfg.beat=$('tgB').checked;
    lsSet('tug_target',cfg.target);lsSet('tug_time',cfg.time);lsSet('tug_beat',cfg.beat);
    tugPlay(g,names,cfg);
  };
}
function tugDeck(){
  var all=mcqPool(),short=all.filter(function(x){return String(x.stem).length<=230&&!x.table&&x.choices.every(function(c){return String(c).length<=80;});});
  return shuffle(short.length>=6?short:all);
}
function tugPlay(g,names,cfg){
  stopAll();tugCtx();
  var N=cfg.target,pos=0,over=false,started=false,P=[0,1].map(function(i){return {i:i,deck:tugDeck(),k:0,q:null,lock:true,streak:0,right:0,wrong:0,pulls:0};});
  // ترتيب مختلف للاعبين حتى لا يظهر السؤال نفسه للاثنين في الوقت نفسه
  P[1].deck=P[1].deck.slice(Math.floor(P[1].deck.length/2)).concat(P[1].deck.slice(0,Math.floor(P[1].deck.length/2)));
  var keys=[['7','8','9','0'],['1','2','3','4']];
  var panel=function(i){return '<section class="tug-p tug-p'+i+'" id="tgP'+i+'" style="--tc:'+TUG_C[i]+'"><header><b>'+esc(names[i])+'</b><span class="tug-st" id="tgSt'+i+'"></span></header><div class="tug-q" id="tgQ'+i+'" dir="auto"></div><div class="tug-ch" id="tgC'+i+'"></div><div class="tug-ice" id="tgI'+i+'" hidden>❄️<span>تجمّد!</span></div></section>';};
  var h='<div class="tug" id="tug">'+panel(0)+
    '<div class="tug-mid"><div class="tug-top"><span class="tug-lead" id="tgLead">⚖️ تعادل</span>'+(cfg.time?'<span class="tug-time" id="tgTime">'+cfg.time+'</span>':'')+'</div>'+tugScene()+
    '<div class="tug-crowd" aria-hidden="true"><span>📣</span><span>🙌</span><span>🎉</span><span>👏</span><span>📣</span><span>🙌</span></div>'+
    '<div class="tug-meter"><span style="--tc:'+TUG_C[0]+'"></span><i id="tgMeter"></i><span style="--tc:'+TUG_C[1]+'"></span></div></div>'+
    panel(1)+'<canvas class="tug-fx" id="tgFx"></canvas><div class="tug-cd" id="tgCd"></div></div>';
  $('gBody').innerHTML=h;$('gScore').innerHTML='';
  var mv=$('tugMove');
  var setPos=function(){
    var f=pos/N;mv.style.transform='translateX('+(f*200)+'px)';
    $('tgMeter').style.insetInlineStart=(50-f*46)+'%';
    $('tgLead').textContent=pos===0?'⚖️ تعادل':(pos>0?'💪 '+names[0]+' متقدّم':'💪 '+names[1]+' متقدّم');
    $('tgLead').style.color=pos===0?'':TUG_C[pos>0?0:1];
  };
  var stat=function(p){var s=$('tgSt'+p.i);if(s)s.innerHTML='✅ '+p.right+(p.streak>=2?' <span class="tug-fire">🔥'+p.streak+'</span>':'');};
  var show=function(p){
    if(p.k>=p.deck.length){p.deck=shuffle(p.deck);p.k=0;}
    var x=mixMcq(p.deck[p.k++]);p.q=x;p.lock=false;
    $('tgQ'+p.i).innerHTML=(x.img?'<img src="'+esc(x.img)+'" alt="">':'')+rich(x.stem);
    $('tgC'+p.i).innerHTML=x.choices.map(function(c,ci){return '<button type="button" class="tug-b" data-p="'+p.i+'" data-c="'+ci+'"><kbd>'+keys[p.i][ci]+'</kbd><span dir="auto">'+rich(c)+'</span></button>';}).join('');
    Array.prototype.forEach.call($('tgC'+p.i).querySelectorAll('.tug-b'),function(b){b.addEventListener('pointerdown',function(e){e.preventDefault();answer(p,+b.getAttribute('data-c'));});b.onclick=function(e){if(e.detail===0)answer(p,+b.getAttribute('data-c'));};});
    var el=$('tgP'+p.i);el.classList.remove('in');void el.offsetWidth;el.classList.add('in');
  };
  var dust=function(dir){var d=$('tugDust');if(!d)return;var x=dir>0?560:240,h2='';for(var i=0;i<6;i++)h2+='<circle class="tug-puff" cx="'+(x+(Math.random()*60-30))+'" cy="'+(248-Math.random()*10)+'" r="'+(5+Math.random()*7)+'" style="--dx:'+((Math.random()*40-20)*dir)+'px;animation-delay:'+(i*25)+'ms"/>';d.innerHTML=h2;};
  var pull=function(p,steps){
    var dir=p.i===0?1:-1;pos=Math.max(-N,Math.min(N,pos+dir*steps));p.pulls+=steps;
    var tm=$(p.i===0?'tugR':'tugB');tm.classList.remove('heave');void tm.getBoundingClientRect();tm.classList.add('heave');
    mv.classList.remove('jerk');void mv.getBoundingClientRect();mv.classList.add('jerk');
    dust(dir);sfx('pull');setPos();
    if(Math.abs(pos)>=N)finish(pos>0?0:1);
  };
  var answer=function(p,ci){
    if(over||!started||p.lock)return;p.lock=true;
    var bs=$('tgC'+p.i).querySelectorAll('.tug-b'),ok=ci===p.q.correct;
    bs[ci].classList.add(ok?'ok':'no');
    if(ok){
      p.right++;p.streak++;sfx('ok');
      var steps=p.streak>0&&p.streak%3===0?2:1;
      if(steps===2){sfx('fire');popText(p.i,'🔥 شدّة مضاعفة!');}
      stat(p);pull(p,steps);
      if(!over)setTimeout(function(){if(!over)show(p);},380);
    }else{
      p.wrong++;p.streak=0;stat(p);sfx('bad');bs[p.q.correct].classList.add('ok');
      var el=$('tgP'+p.i);el.classList.add('shake');setTimeout(function(){el.classList.remove('shake');},450);
      setTimeout(function(){if(over)return;$('tgI'+p.i).hidden=false;sfx('freeze');
        setTimeout(function(){if(over)return;$('tgI'+p.i).hidden=true;show(p);},1100);},700);
    }
  };
  var popText=function(i,t){var el=document.createElement('div');el.className='tug-pop';el.style.color=TUG_C[i];el.textContent=t;$('tgP'+i).appendChild(el);setTimeout(function(){el.remove();},1300);};
  var keyH=function(e){if(over||!started)return;var k=e.key;for(var i=0;i<2;i++){var ci=keys[i].indexOf(k);if(ci>=0&&P[i].q&&ci<P[i].q.choices.length){e.preventDefault();answer(P[i],ci);}}};
  document.addEventListener('keydown',keyH);stopFns.push(function(){document.removeEventListener('keydown',keyH);});
  // طبول الحماس: تتسارع كلما اقترب الحبل من أحد الخطّين
  var beatT=null,beat=function(){if(over)return;if(cfg.beat&&started)sfx('kick');var near=Math.abs(pos)/N;beatT=setTimeout(beat,620-near*330);};
  stopFns.push(function(){clearTimeout(beatT);});
  var timer=null;
  var finish=function(w){
    if(over)return;over=true;clearTimeout(beatT);if(timer)timer.stop();
    P.forEach(function(p){p.lock=true;});
    var tie=w<0;
    if(!tie){var lt=$(w===0?'tugB':'tugR'),wt=$(w===0?'tugR':'tugB');lt.classList.add('fall');wt.classList.add('cheer');sfx('win');confetti($('tgFx'),TUG_C[w]);track('tug_win',names[w]);}
    else sfx('tie');
    var s=function(p){return '<div class="tug-sum" style="--tc:'+TUG_C[p.i]+'"><b>'+esc(names[p.i])+'</b><span>✅ '+p.right+' صحيحة</span><span>❌ '+p.wrong+' خاطئة</span></div>';};
    setTimeout(function(){
      var cd=$('tgCd');if(!cd)return;
      cd.innerHTML='<div class="tug-res">'+(tie?'<div class="tug-trophy">🤝</div><h2>تعادل!</h2>':'<div class="tug-trophy">🏆</div><h2 style="color:'+TUG_C[w]+'">'+esc(names[w])+' يفوز!</h2>')+
        '<div class="tug-sums">'+s(P[0])+s(P[1])+'</div><div class="tug-again"><button type="button" class="btn primary" id="tgAgain">🔁 جولة جديدة</button><button type="button" class="btn" id="tgSwap">⇄ تبديل الجهتين</button><button type="button" class="btn" id="tgSet">⚙️ الإعدادات</button></div></div>';
      cd.className='tug-cd on res';
      $('tgAgain').onclick=function(){tugPlay(g,names,cfg);};
      $('tgSwap').onclick=function(){tugPlay(g,[names[1],names[0]],cfg);};
      $('tgSet').onclick=function(){gTug(g);};
    },tie?300:1600);
  };
  setPos();stat(P[0]);stat(P[1]);
  // العدّ التنازلي 3، 2، 1، انطلق!
  var cd=$('tgCd'),n=3;cd.className='tug-cd on';
  var step=function(){
    if(!$('tgCd'))return;
    if(n>0){cd.innerHTML='<span class="tug-n">'+n+'</span>';sfx('count');n--;setTimeout(step,800);}
    else{cd.innerHTML='<span class="tug-n go">انطلق!</span>';sfx('go');setTimeout(function(){if(!$('tgCd'))return;cd.className='tug-cd';cd.innerHTML='';started=true;show(P[0]);show(P[1]);beat();
      if(cfg.time)timer=runTimer2(cfg.time,function(){finish(pos===0?-1:(pos>0?0:1));});},650);}
  };
  setTimeout(step,250);
}
function runTimer2(secs,onEnd){
  var end=Date.now()+secs*1000,last=-1,iv=setInterval(function(){var el=$('tgTime');if(!el){clearInterval(iv);return;}var s=Math.max(0,Math.ceil((end-Date.now())/1000));
    if(s!==last){el.textContent=Math.floor(s/60)+':'+('0'+s%60).slice(-2);el.classList.toggle('low',s<=10);if(s<=5&&s>0)sfx('count');last=s;}
    if(s<=0){clearInterval(iv);onEnd();}},200);
  var stop=function(){clearInterval(iv);};stopFns.push(stop);return {stop:stop};
}
// قصاصات احتفال على canvas
function confetti(cv,main){
  if(!cv)return;var r=cv.getBoundingClientRect(),W=cv.width=r.width,H=cv.height=r.height,c=cv.getContext('2d'),cols=[main,'#ffd400','#26890c','#ffffff','#864cbf',main],ps=[];
  for(var i=0;i<170;i++)ps.push({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*13-4,s:4+Math.random()*7,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:cols[i%cols.length]});
  var t0=Date.now(),run=true;stopFns.push(function(){run=false;});
  (function fr(){if(!run||!document.body.contains(cv))return;c.clearRect(0,0,W,H);ps.forEach(function(p){p.vy+=.32;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.c;c.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);c.restore();});
    if(Date.now()-t0<4200)requestAnimationFrame(fr);else c.clearRect(0,0,W,H);})();
}
