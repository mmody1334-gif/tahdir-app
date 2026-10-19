// «أستطيع أن ✓»: قوائم التقييم الذاتي في نهاية كل وحدة (كما في كتاب الطالب).
// البيانات في site/data/cando.json (مصدرها site/data/cando_src/*.txt ← tools/build_cando.py)،
// وتصل للصفحة في window.CANDO. لكل مادة صفوف، ولكل صف وحدات، ولكل وحدة صفوف الجدول.
(function(){
'use strict';
guard();
var CD=window.CANDO||{};
var SUBJ_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية'];
var SUBJ_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍'};
var GN={'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var COLS=['أحتاج إلى بذل المزيد من الجهد','متمكّن إلى حدٍّ ما','مستعدّ للمضيّ قدمًا'];
var UNIT_ORD=['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة','الحادية عشرة','الثانية عشرة'];
var IN_APP_=typeof IN_APP!=='undefined'&&IN_APP,MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function arDig(s){return String(s).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d];});}
// رقم الموضوع كما في الكتاب: «١-٢» يُقرأ من اليمين (الوحدة ثم الدرس)
function refHtml(r){return '<bdo dir="rtl">'+esc(arDig(r))+'</bdo>';}
function unitTitle(u){var n=parseInt(u.u,10);return 'الوحدة '+(UNIT_ORD[n-1]||arDig(u.u))+': '+u.name;}
function subjects(){var s={};Object.keys(CD).forEach(function(k){s[CD[k].subject]=1;});return Object.keys(s).sort(function(a,b){var x=SUBJ_ORDER.indexOf(a),y=SUBJ_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y);});}
function gradesOf(s){return Object.keys(CD).filter(function(k){return CD[k].subject===s;}).sort(function(a,b){return (GN[CD[a].grade]||0)-(GN[CD[b].grade]||0);});}
function gradeRange(s){var g=gradesOf(s).map(function(k){return GN[CD[k].grade];});if(!g.length)return '';var a=Math.min.apply(null,g),b=Math.max.apply(null,g);return a===b?'الصف '+a:'الصفوف '+a+'–'+b;}

var subj=lsGet('cando_subject'),cur=null,openG={},marks={};
try{var _c=JSON.parse(lsGet('cando_cur')||'null');if(_c&&CD[_c.k])cur=_c;}catch(e){}

function renderTree(){
  var ss=subjects(),tree=$('tree');
  if(ss.indexOf(subj)<0)subj=cur&&CD[cur.k]?CD[cur.k].subject:ss[0];
  var h='<label class="subj-pick"><span class="subj-ic" aria-hidden="true">'+(SUBJ_ICON[subj]||'📘')+'</span><span class="subj-l">المادة</span><select id="subjSel" aria-label="اختر المادة">'+
    ss.map(function(x){return '<option value="'+esc(x)+'"'+(x===subj?' selected':'')+'>'+esc(x)+' · '+esc(gradeRange(x))+'</option>';}).join('')+'</select></label>'+
    '<h2 class="tree-h">'+(SUBJ_ICON[subj]||'')+' '+esc(subj)+'</h2>';
  tree.innerHTML=h;
  $('subjSel').onchange=function(){subj=this.value;lsSet('cando_subject',subj);renderTree();};
  gradesOf(subj).forEach(function(k){
    var C=CD[k],n=C.units.reduce(function(a,u){return a+u.rows.length;},0);
    var gDiv=document.createElement('div');gDiv.className='g-block';
    var gBtn=document.createElement('button');gBtn.type='button';gBtn.className='g-btn';
    gBtn.innerHTML='<span class="g-name">الصف '+esc(C.grade)+'</span><span class="g-meta">'+C.units.length+' وحدات <span class="chev">▾</span></span>';
    var gBody=document.createElement('div');gBody.className='g-body';
    if(openG[k]||(cur&&cur.k===k))gBody.classList.add('open');
    C.units.forEach(function(u,i){
      var b=document.createElement('button');b.type='button';b.className='u-btn cd-u'+(cur&&cur.k===k&&cur.i===i?' active':'');
      b.innerHTML='<span class="u-num">'+esc(u.u)+'</span><span class="u-name">'+esc(u.name)+'</span><span class="u-badge">'+u.rows.length+'</span>';
      b.title='عرض قائمة التقييم الذاتي للوحدة';
      b.onclick=function(){cur={k:k,i:i};lsSet('cando_cur',JSON.stringify(cur));renderTree();show();if(window.innerWidth<900){var p=$('panel');if(p&&p.scrollIntoView)p.scrollIntoView({behavior:'smooth',block:'start'});}};
      gBody.appendChild(b);
    });
    var all=document.createElement('button');all.type='button';all.className='cd-all';all.textContent='🖨 طباعة كل وحدات الصف ('+n+' هدفًا)';
    all.onclick=function(){printUnits(k,C.units.map(function(_,i){return i;}));};
    gBody.appendChild(all);
    gBtn.onclick=function(){openG[k]=!gBody.classList.contains('open');gBody.classList.toggle('open');};
    gDiv.appendChild(gBtn);gDiv.appendChild(gBody);tree.appendChild(gDiv);
  });
}

// ورقة الوحدة: بتنسيق مضمَّن حتى تبقى كما هي في الطباعة وملف Word وصفحة التصدير
var TEAL='#1b8f9a',TEAL_L='#7fc4cc',TEAL_D='#0e6f78';
function sheetHtml(k,i,opts){
  opts=opts||{};var C=CD[k],u=C.units[i],live=!!opts.live;
  var th='background:'+TEAL+';color:#fff;border:1.5px solid #10464c;padding:6px 6px;font-weight:700;text-align:center;vertical-align:middle;font-size:'+(live?'.86rem':'11pt')+';line-height:1.35';
  var td='border:1.5px solid #10464c;padding:6px 10px;vertical-align:top;background:#fff;color:#111;line-height:1.75;font-size:'+(live?'.98rem':'12.5pt');
  var tdc='border:1.5px solid #10464c;background:#fff;text-align:center;vertical-align:middle;width:12%;font-size:'+(live?'1.3rem':'16pt')+';color:'+TEAL_D+';font-weight:700';
  var h='<div class="cd-sheet" style="direction:rtl;font-family:inherit">'+
    '<div style="font-weight:700;color:#c2185b;font-size:'+(live?'.92rem':'11pt')+';border-bottom:2px solid '+TEAL+';padding-bottom:4px;margin-bottom:8px">'+esc(unitTitle(u))+'</div>'+
    '<div style="background:'+TEAL_L+';border:1px solid '+TEAL+';padding:0 0 10px">'+
    '<div style="background:'+TEAL+';color:#fff;font-weight:800;padding:6px 12px;font-size:'+(live?'1.12rem':'14pt')+'">قائمة تقييم ذاتي</div>'+
    '<div style="padding:6px 14px;font-size:'+(live?'.9rem':'11pt')+';color:#0b2b2e">بعد دراسة الوحدة، أكمل الجدول كالآتي:</div>'+
    '<div style="padding:0 12px"><table class="cd-t" style="width:100%;border-collapse:collapse;table-layout:fixed">'+
    '<colgroup><col style="width:'+(live?'46%':'48%')+'"><col style="width:'+(live?'12%':'10%')+'"><col><col><col></colgroup>'+
    '<thead><tr><th style="'+th+'">أستطيع أن</th><th style="'+th+'">أراجع الموضوع</th>'+COLS.map(function(c){return '<th style="'+th+'">'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>';
  u.rows.forEach(function(r,ri){
    var mk=marks[k+'|'+i+'|'+ri];
    h+='<tr><td style="'+td+'">'+esc(r.t)+(r.b&&r.b.length?'<ul style="margin:4px 0 0;padding-inline-start:22px">'+r.b.map(function(b){return '<li>'+esc(b)+'</li>';}).join('')+'</ul>':'')+'</td>'+
      '<td style="'+td+';text-align:center;vertical-align:middle;white-space:nowrap">'+refHtml(r.r)+'</td>'+
      COLS.map(function(c,ci){return '<td style="'+tdc+'"'+(live?' class="cd-c'+(mk===ci?' on':'')+'" data-r="'+ri+'" data-c="'+ci+'" role="button" tabindex="0" aria-label="'+esc(c)+'"':'')+'>'+(live&&mk===ci?'✓':'')+'</td>';}).join('')+'</tr>';
  });
  h+='</tbody></table></div></div></div>';
  return h;
}
function show(){
  var p=$('panel');
  if(!cur||!CD[cur.k]){
    p.innerHTML='<div class="welcome cd-welcome"><div class="cd-big">✓</div><h2>أستطيع أن…</h2><p>قوائم «التقييم الذاتي» في نهاية كل وحدة من كتاب الطالب، للفصل الدراسي الأول.</p><p class="muted">اختر المادة، ثم افتح الصف واضغط على الوحدة.</p></div>';
    return;
  }
  var C=CD[cur.k],u=C.units[cur.i];
  p.innerHTML='<div class="cd-head"><div><div class="cd-crumb">'+esc(C.subject)+' · الصف '+esc(C.grade)+' · الفصل الدراسي الأول</div><h2>'+esc(unitTitle(u))+'</h2></div>'+
    '<div class="cd-tools"><button type="button" class="btn primary small" id="cdPrint">🖨 طباعة / PDF</button><button type="button" class="btn small" id="cdWord">⬇ Word</button><button type="button" class="btn small" id="cdCopy">📋 نسخ الجدول</button><button type="button" class="btn small" id="cdClear" title="مسح علامات ✓ من الجدول">مسح العلامات</button></div></div>'+
    '<p class="cd-hint">💡 اضغط على أي خانة لوضع ✓ (مفيد عند عرض الجدول على السبورة). الطباعة تخرج الجدول فارغًا ليكمله الطالب.</p>'+
    '<div class="cd-wrap">'+sheetHtml(cur.k,cur.i,{live:true})+'</div>'+
    '<div class="cd-nav">'+(cur.i>0?'<button type="button" class="btn small" id="cdPrev">→ الوحدة السابقة</button>':'<span></span>')+(cur.i<C.units.length-1?'<button type="button" class="btn small" id="cdNext">الوحدة التالية ←</button>':'')+'</div>';
  Array.prototype.forEach.call(p.querySelectorAll('.cd-c'),function(c){
    var tog=function(){var key=cur.k+'|'+cur.i+'|'+c.getAttribute('data-r'),ci=+c.getAttribute('data-c');if(marks[key]===ci)delete marks[key];else marks[key]=ci;show();};
    c.onclick=tog;c.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}};
  });
  $('cdPrint').onclick=function(){printUnits(cur.k,[cur.i]);};
  $('cdWord').onclick=function(){wordUnits(cur.k,[cur.i]);};
  $('cdCopy').onclick=copySheet;
  $('cdClear').onclick=function(){Object.keys(marks).forEach(function(m){if(m.indexOf(cur.k+'|'+cur.i+'|')===0)delete marks[m];});show();};
  if($('cdPrev'))$('cdPrev').onclick=function(){cur.i--;lsSet('cando_cur',JSON.stringify(cur));renderTree();show();};
  if($('cdNext'))$('cdNext').onclick=function(){cur.i++;lsSet('cando_cur',JSON.stringify(cur));renderTree();show();};
}
function fname(k,ids){var C=CD[k];return ('أستطيع أن - '+C.subject+' - الصف '+C.grade+(ids.length===1?' - الوحدة '+C.units[ids[0]].u:'')).replace(/[\\/:*?"<>|]+/g,'-');}
function pagesHtml(k,ids,cls){return ids.map(function(i){return '<div class="'+cls+'">'+sheetHtml(k,i)+'</div>';}).join('');}
function serverFile(format,html,win,name){
  toast('جارٍ التجهيز…');
  return api('/api/export',{format:format,name:name||'أستطيع أن',html:html}).then(function(r){
    if(win){try{win.location.href=r.url;return;}catch(e){}}
    var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
  },function(e){if(win)try{win.close();}catch(x){}toast(e.message);});
}
function printUnits(k,ids){
  track('cando_print',CD[k].subject+'|'+CD[k].grade+'|'+ids.length,fname(k,ids));
  if(!IN_APP_&&!MOBILE){$('printArea').innerHTML=pagesHtml(k,ids,'ppage');doPrint(fname(k,ids));return;}
  var w=null;if(!IN_APP_){try{w=window.open('','_blank');}catch(e){w=null;}}
  serverFile('print',pagesHtml(k,ids,'pg'),w,fname(k,ids)).then(function(){if(IN_APP_)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');});
}
function wordUnits(k,ids){
  track('cando_word',CD[k].subject+'|'+CD[k].grade,fname(k,ids));
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(fname(k,ids))+'</title>'+
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'+
    '<style>@page WordSection1{size:595.3pt 841.9pt;margin:30pt 30pt 30pt 30pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic","Traditional Arabic",Arial;font-size:12.5pt}</style></head>'+
    '<body dir="rtl"><div class="WordSection1">'+ids.map(function(i){return sheetHtml(k,i);}).join('<br clear="all" style="page-break-before:always">')+'</div></body></html>';
  serverFile('doc',html,null,fname(k,ids)).then(function(){toast(IN_APP_?'يُحمَّل ملف Word عبر المتصفح، ستجده في «التنزيلات»':'تم تحميل ملف Word');});
}
function copySheet(){
  var C=CD[cur.k],u=C.units[cur.i],html=sheetHtml(cur.k,cur.i);
  var txt=unitTitle(u)+'\nقائمة تقييم ذاتي\nأستطيع أن\tأراجع الموضوع\t'+COLS.join('\t')+'\n'+u.rows.map(function(r){return r.t+(r.b?' '+r.b.map(function(b){return '• '+b;}).join(' '):'')+'\t'+r.r;}).join('\n');
  var done=function(){toast('تم نسخ الجدول — الصقه في Word أو نور');track('cando_copy',C.subject+'|'+C.grade+'|'+u.u,unitTitle(u));};
  try{
    if(navigator.clipboard&&window.ClipboardItem){
      navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([txt],{type:'text/plain'})})]).then(done,function(){fallback();});
      return;
    }
  }catch(e){}
  fallback();
  function fallback(){
    var d=document.createElement('div');d.contentEditable='true';d.style.cssText='position:fixed;left:-9999px;top:0';d.innerHTML=html;document.body.appendChild(d);
    var r=document.createRange();r.selectNodeContents(d);var s=getSelection();s.removeAllRanges();s.addRange(r);
    var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    s.removeAllRanges();d.remove();if(ok)done();else toast('تعذّر النسخ، استخدم «Word» بدلًا منه');
  }
}
renderTree();show();
})();
