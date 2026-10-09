(function(){
'use strict';
guard();
// ---------- ثوابت ----------
var GRADE_NUM={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
var HI_AO=['AO1','AO2'],LO_AO=['معرفة','تطبيق','استدلال'];
var AO_TXT={AO1:'AO1 · المعرفة والفهم',AO2:'AO2 · التطبيق والتحليل والتقييم','معرفة':'معرفة','تطبيق':'تطبيق','استدلال':'استدلال'};
var TYPE_TXT={mcq:'اختيار من متعدد',short:'إجابة قصيرة',long:'إجابة طويلة'};
var QNO=['الأول','الثاني','الثالث','الرابع'];
var DEF_HDR={dir:'المديرية العامة للتربية والتعليم بمحافظة البريمي',school:'مدرسة حذيفة بن محصن (5-12)',year:'2027/2026',term:'الأول'};
var me=null,courses=[],course=null,bank={lessons:[],items:[]},lessonById={},mode='quiz';
var cfg={quizNo:'الأول',total:10,lessons:{},unit:'',reviewCount:0};
var hdr=null,doc=null,dirty=false,paperView='quiz';
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,grade:course&&course.grade,detail:detail||'',title:title||''})});}catch(e){}}
function gnum(g){return GRADE_NUM[g]||99;}
function isHi(){return course&&gnum(course.grade)>=11;}
function aoList(){return isHi()?HI_AO:LO_AO;}
function clone(o){return JSON.parse(JSON.stringify(o));}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

// ---------- مواصفات الاختبار حسب الصف (وثيقة تقويم تعلم الطلبة) ----------
function spec(total){
  var g=gnum(course.grade);
  if(g>=11)return {total:10,targets:{AO1:3,AO2:7},mcq:{AO1:1,AO2:1},mcqCount:2,long:{count:1,marks:[4,5]},minItems:5,fixed:true};
  total=+total||(g===5?10:15);
  var k=Math.round(total*.4),a=Math.round(total*.4),r=total-k-a,t={'معرفة':k,'تطبيق':a,'استدلال':r};
  if(g===5)return {total:total,targets:t,mcqCount:Math.max(2,Math.round(total*.4)),long:{count:1,marks:[2,3]},minItems:5};
  return {total:total,targets:t,mcqCount:total>=15?3:2,long:{count:1,marks:[3,4]},minItems:5};
}

// ---------- تكوين الاختبار تلقائيًا ----------
function assemble(pool,sp,lessonIds){
  var order={};lessonIds.forEach(function(id,i){order[id]=i;});
  var best=null,bestScore=1e9;
  for(var att=0;att<700;att++){
    var rem=clone(sp.targets),chosen=[],used={},useL={};
    var take=function(it){chosen.push(it);used[it.qid]=1;rem[it.ao]=(rem[it.ao]||0)-it.marks;useL[it.lesson_id]=(useL[it.lesson_id]||0)+1;};
    var leastUsed=function(c){var mn=1e9;c.forEach(function(x){mn=Math.min(mn,useL[x.lesson_id]||0);});return c.filter(function(x){return (useL[x.lesson_id]||0)===mn;});};
    // 1) مفردة الإجابة الطويلة
    var longs=pool.filter(function(x){return x.type==='long'&&sp.long.marks.indexOf(x.marks)>=0&&(rem[x.ao]||0)>=x.marks;});
    if(!longs.length)longs=pool.filter(function(x){return x.type==='long'&&(rem[x.ao]||0)>=x.marks;});
    if(longs.length)take(pick(longs));
    // 2) الاختيار من متعدد
    if(sp.mcq){Object.keys(sp.mcq).forEach(function(ao){for(var n=0;n<sp.mcq[ao];n++){var c=pool.filter(function(x){return x.type==='mcq'&&x.ao===ao&&!used[x.qid];});if(c.length)take(pick(leastUsed(c)));}});}
    else{for(var n=0;n<sp.mcqCount;n++){var c=pool.filter(function(x){return x.type==='mcq'&&!used[x.qid]&&(rem[x.ao]||0)>=1&&x.ao!=='استدلال';});if(!c.length)c=pool.filter(function(x){return x.type==='mcq'&&!used[x.qid]&&(rem[x.ao]||0)>=1;});if(c.length)take(pick(leastUsed(c)));}}
    // 3) بقية الدرجات بمفردات قصيرة
    for(var guard=0;guard<40;guard++){
      var left=Object.keys(rem).filter(function(k){return rem[k]>0;});if(!left.length)break;
      var c=pool.filter(function(x){return x.type==='short'&&!used[x.qid]&&(rem[x.ao]||0)>=x.marks;});
      if(!c.length)break;
      take(pick(leastUsed(c)));
    }
    if(!sp.fixed){ // الصفوف 5–10: الدرجة الكلية مضبوطة، وتوزيع الأهداف بتفاوت درجة واحدة
      for(var g2=0;g2<20;g2++){
        var tr=0;Object.keys(rem).forEach(function(k){tr+=rem[k];});if(tr<=0)break;
        var c2=pool.filter(function(x){return (x.type==='short'||x.type==='mcq')&&!used[x.qid]&&x.marks<=tr&&(rem[x.ao]||0)-x.marks>=-1;});
        if(!c2.length)break;take(pick(leastUsed(c2)));
      }
    }
    var dev=0;
    if(sp.fixed)Object.keys(rem).forEach(function(k){dev+=Math.abs(rem[k]);});
    else{var tr2=0;Object.keys(rem).forEach(function(k){tr2+=rem[k];dev+=Math.max(0,Math.abs(rem[k])-1)+Math.abs(rem[k])*0.2;});dev+=Math.abs(tr2)*2;}
    var uncovered=lessonIds.filter(function(id){return !useL[id];}).length;
    var mc=chosen.filter(function(x){return x.type==='mcq';}).length,lc=chosen.filter(function(x){return x.type==='long';}).length;
    var score=dev*20+uncovered*3+(chosen.length<sp.minItems?8:0)+Math.abs(mc-(sp.mcqCount||2))*6+(lc?0:6)+Math.max(0,chosen.length-8);
    if(score<bestScore){bestScore=score;best=chosen;}
    if(score<0.5)break;
  }
  best=(best||[]).slice().sort(function(a,b){return (order[a.lesson_id]-order[b.lesson_id])||(tOrd(a)-tOrd(b));});
  // الطويلة في آخر الاختبار مثل النماذج الرسمية
  var longs2=best.filter(function(x){return x.type==='long';});best=best.filter(function(x){return x.type!=='long';}).concat(longs2);
  return best.map(clone);
}
function tOrd(x){return {mcq:0,short:1,long:2}[x.type]||1;}

// ---------- أدوات النص ----------
function rich(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');}
function lessonOf(it){return lessonById[it.lesson_id]||{};}
function tableLabel(n){return 'الجدول ('+n+')';}
function relabel(s,n){return String(s||'').replace(/الجدول\s*\(\s*[\d-]+\s*\)/g,tableLabel(n));}
function lineCount(it){if(it.type==='mcq')return 0;var m=+it.marks||1;if(it.lines)return it.lines;return it.type==='long'?Math.max(4,Math.ceil(m*1.6)):(m===1?1:m+1);}

// ---------- ورقة الاختبار (تُستخدم للشاشة والطباعة وملف Word) ----------
function titleText(d,key){
  var subj=d.subject,gr=d.grade;
  if(d.kind==='review')return (key?'نموذج إجابة ':'')+'مراجعة نهاية الوحدة '+(d.unit||'')+(d.unit_name?': '+d.unit_name:'')+' — مادة '+subj+' للصف '+gr;
  return (key?'نموذج إجابة ':'')+'الاختبار القصير '+d.quizNo+' لمادة '+subj+' للصف '+gr;
}
function headerHtml(d,key,word){
  var h=d.hdr||hdr,tot=sumMarks(d.items);
  var box=key?'':'<table class="sbox" style="border-collapse:collapse;margin-inline-start:auto"><tr><td style="border:1.5px solid #000;width:64px;height:30px"></td></tr><tr><td style="border:1.5px solid #000;width:64px;height:30px;text-align:center;font-weight:bold">'+tot+'</td></tr></table>';
  return '<table class="phead" style="width:100%;border-collapse:collapse"><tr>'+
    '<td style="width:30%;vertical-align:top;font-size:'+(word?'10pt':'.78em')+';line-height:1.5">سلطنة عُمان<br>وزارة التعليم<br>'+esc(h.dir)+'<br>'+esc(h.school)+'</td>'+
    '<td style="width:50%;text-align:center;vertical-align:middle"><div class="ptitle" style="font-weight:bold;font-size:'+(word?'13pt':'1.08em')+';background:#e6e6e6;padding:3px 6px">'+esc(titleText(d,key))+'</div>'+
    '<div style="font-size:'+(word?'11pt':'.92em')+'">الفصل الدراسي: '+esc(h.term)+' - العام الدراسي: '+esc(h.year)+'م</div></td>'+
    '<td style="width:20%;vertical-align:middle">'+box+'</td></tr></table>'+
    (key||d.kind==='review'&&!d.studentLine?'':'<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr><td style="border:1px solid #000;border-radius:8px;padding:4px 10px">اسم الطالب: ................................................ &nbsp; الصف: .............. &nbsp; التاريخ: ..............</td></tr></table>')+
    '<hr style="border:0;border-top:2px solid #000;margin:8px 0 12px">';
}
function sumMarks(items){return items.reduce(function(s,x){return s+(+x.marks||0);},0);}
function itemHtml(it,n,tno,word,ctrl){
  var stem=it.table?relabel(it.stem,tno):it.stem;
  var h='<div class="qi" data-i="'+(n-1)+'" style="margin:0 0 '+(word?'10pt':'16px')+';page-break-inside:avoid">';
  if(ctrl)h+=ctrl;
  h+='<p style="margin:0 0 4px"><b>'+n+')</b> '+rich(stem)+'</p>';
  if(it.table&&it.table.rows){
    h+='<table class="qt" style="border-collapse:collapse;margin:6px auto 6px;min-width:55%">'+(it.table.caption?'<caption style="font-weight:bold;padding:2px">'+esc(relabel(it.table.caption,tno))+'</caption>':'');
    it.table.rows.forEach(function(r,ri){h+='<tr>'+r.map(function(c){return (ri?'<td':'<th')+' style="border:1px solid #000;padding:3px 10px;text-align:center'+(ri?'':';background:#eee')+'">'+rich(c)+(ri?'</td>':'</th>');}).join('')+'</tr>';});
    h+='</table>';
  }
  if(it.type==='mcq'){
    h+='<p style="margin:2px 0 4px;font-weight:bold;color:#9b1c1c">(ظلّل الشكل ( '+(word?'⬭':'<span class="oval"></span>')+' ) المقترن بالإجابة الصحيحة)</p>';
    h+='<table class="chs" style="width:100%;border-collapse:collapse">';
    for(var r=0;r<2;r++){h+='<tr>';for(var c=0;c<2;c++){var k=r*2+c,ch=(it.choices||[])[k];h+='<td style="width:50%;padding:3px 4px;vertical-align:top">'+(ch==null?'':(word?'⬭ ':'<span class="oval"></span> ')+rich(ch))+'</td>';}h+='</tr>';}
    h+='</table><div style="text-align:left;font-weight:bold">['+it.marks+']</div>';
  }else{
    var L=lineCount(it);
    for(var i=0;i<L;i++)h+='<div class="aline" style="border-bottom:1px solid #000;height:'+(word?'20pt':'28px')+';margin:0 0 2px'+(i===L-1?';position:relative':'')+'">'+(i===L-1?'<span style="float:left;font-weight:bold;background:#fff;padding:0 4px">['+it.marks+']</span>':'')+'</div>';
  }
  return h+'</div>';
}
function quizHtml(d,word,withCtrl){
  var h=headerHtml(d,false,word),tno=0,lastL=null;
  d.items.forEach(function(it,i){
    if(d.kind==='review'&&it.lesson_id!==lastL){lastL=it.lesson_id;var L=lessonOf(it);h+='<h4 style="margin:14px 0 8px;font-size:'+(word?'12pt':'1em')+';border-bottom:1px dashed #888">الدرس: '+esc(L.title||'')+'</h4>';}
    if(it.table)tno++;
    h+=itemHtml(it,i+1,tno,word,withCtrl?ctrlHtml(i):'');
  });
  return h+'<p style="text-align:center;font-weight:bold;margin-top:18px">ـ انتهت الأسئلة ـ</p>';
}
function keyHtml(d,word){
  var hi=gnum(d.grade)>=11,tno=0;
  var th=function(t){return '<th style="border:1px solid #000;padding:4px;background:#dce9f5;font-size:'+(word?'10pt':'.85em')+'">'+t+'</th>';};
  var td=function(t,al){return '<td style="border:1px solid #000;padding:4px 6px;vertical-align:top;'+(al?'text-align:'+al+';':'')+'font-size:'+(word?'10pt':'.88em')+'">'+t+'</td>';};
  var h=headerHtml(d,true,word)+(hi?'<p style="text-align:center;margin:-4px 0 8px">المادة: '+esc(d.subject)+'</p>':'');
  h+='<table class="keyt" style="width:100%;border-collapse:collapse"><thead><tr>'+th('المفردة')+th('الإجابة')+th('الدرجة')+(hi?th('المعلومات الإضافية')+th('الوحدة'):'')+th('هدف التعلم')+th('هدف التقويم')+(hi?th('مستوى الصعوبة'):'')+'</tr></thead><tbody>';
  d.items.forEach(function(it,i){
    if(it.table)tno++;
    var ans=it.type==='mcq'?rich((it.choices||[])[it.correct]||''):rich(it.table?relabel(it.answer,tno):it.answer);
    var notes=it.notes?rich(it.table?relabel(it.notes,tno):it.notes):'';
    if(!hi&&notes)ans+='<div style="font-size:.85em;color:#444">'+notes+'</div>';
    var L=lessonOf(it);
    h+='<tr>'+td(i+1,'center')+td(ans)+td(it.marks,'center')+(hi?td(notes)+td(esc(L.unit||''),'center'):'')+td(esc(it.outcome||''),'center')+td(esc(it.ao||''),'center')+(hi?td(esc(it.difficulty||''),'center'):'')+'</tr>';
  });
  h+='<tr>'+td('<b>المجموع</b>','center')+td('')+td('<b>'+sumMarks(d.items)+'</b>','center')+(hi?td('')+td(''):'')+td('')+td(aoSummary(d))+(hi?td(''):'')+'</tr>';
  return h+'</tbody></table><p style="text-align:center;font-weight:bold;margin-top:14px">ـ نهاية نموذج الإجابة ـ</p>';
}
function aoSummary(d){var s={};d.items.forEach(function(x){s[x.ao]=(s[x.ao]||0)+(+x.marks||0);});return Object.keys(s).map(function(k){return esc(k)+': '+s[k];}).join('<br>');}
function ctrlHtml(i){
  return '<div class="qctl no-print"><span class="qmeta" data-meta="'+i+'"></span><span class="qbtns">'+
    '<button type="button" class="btn small" data-act="up" data-i="'+i+'" title="لأعلى">↑</button><button type="button" class="btn small" data-act="down" data-i="'+i+'" title="لأسفل">↓</button>'+
    '<button type="button" class="btn small" data-act="swap" data-i="'+i+'">استبدال</button><button type="button" class="btn small" data-act="edit" data-i="'+i+'">تعديل</button><button type="button" class="btn small danger" data-act="del" data-i="'+i+'">حذف</button></span></div>';
}

// ---------- مطابقة الوثيقة ----------
function checks(d){
  var out=[],items=d.items,tot=sumMarks(items),mc=items.filter(function(x){return x.type==='mcq';}),lg=items.filter(function(x){return x.type==='long';});
  var ao={};items.forEach(function(x){ao[x.ao]=(ao[x.ao]||0)+(+x.marks||0);});
  if(d.kind==='review'){out.push([true,items.length+' مفردة، المجموع '+tot+' درجة']);return out;}
  var sp=d.spec||spec(d.total);
  out.push([tot===sp.total,'الدرجة الكلية '+tot+' من '+sp.total]);
  aoList().forEach(function(k){var t=sp.targets[k]||0,v=ao[k]||0;out.push([isHi()?v===t:Math.abs(v-t)<=1,(isHi()?k:k)+': '+v+' درجة (المطلوب '+t+')']);});
  if(isHi()){
    out.push([items.length>=5,'عدد المفردات '+items.length+' (لا يقل عن 5)']);
    var m1=mc.filter(function(x){return x.ao==='AO1';}).length,m2=mc.filter(function(x){return x.ao==='AO2';}).length;
    out.push([mc.length===2&&m1>=1&&m2>=1,'اختيار من متعدد: '+mc.length+' (مفردتان تغطيان AO1 وAO2)']);
    out.push([lg.length>=1&&lg.every(function(x){return x.marks>=4&&x.marks<=5;}),'إجابة طويلة: '+lg.length+(lg.length?' ('+lg.map(function(x){return x.marks;}).join('، ')+' درجات)':'')+' — مفردة من 4 إلى 5 درجات']);
  }else{
    out.push([items.length>=5,'عدد المفردات '+items.length]);
    out.push([mc.length>=1,'اختيار من متعدد: '+mc.length]);
    out.push([lg.length>=1,'إجابة طويلة/مركّبة: '+lg.length]);
  }
  var ls={};items.forEach(function(x){ls[x.lesson_id]=1;});var n=Object.keys(ls).length;
  out.push([n>=2&&n<=5,'يغطي '+n+' دروس (الوثيقة: من 2 إلى 5 دروس)']);
  return out;
}

// ---------- الواجهة ----------
function renderSide(){
  var h='<section class="qcard"><h3>1. الصف والمادة</h3><select id="courseSel" class="qsel">'+courses.map(function(c){return '<option value="'+esc(c.key)+'"'+(course&&c.key===course.key?' selected':'')+'>'+esc(c.subject)+' — الصف '+esc(c.grade)+(c.quiz_items?'':' (بدون بنك أسئلة)')+'</option>';}).join('')+'</select>'+
    '<div class="seg" role="tablist"><button type="button" class="'+(mode==='quiz'?'on':'')+'" data-mode="quiz">اختبار قصير</button><button type="button" class="'+(mode==='review'?'on':'')+'" data-mode="review">مراجعة نهاية الوحدة</button></div></section>';
  if(!course){$('qside').innerHTML=h;bindSide();return;}
  var units=unitsList();
  if(mode==='quiz'){
    h+='<section class="qcard"><h3>2. الدروس المشمولة <span class="muted">(من 2 إلى 5)</span></h3><div class="lpick">';
    units.forEach(function(u){
      h+='<div class="lp-unit"><div class="lp-uh">الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</div>';
      u.lessons.forEach(function(l){var n=bank.items.filter(function(x){return x.lesson_id===l.id;}).length;
        h+='<label class="lp-l'+(n?'':' dim')+'"><input type="checkbox" data-lid="'+l.id+'"'+(cfg.lessons[l.id]?' checked':'')+(n?'':' disabled')+'> <span>'+esc(l.title)+'</span><span class="muted">'+n+'</span></label>';});
      h+='</div>';
    });
    h+='</div></section><section class="qcard"><h3>3. الإعدادات</h3><label class="qrow">رقم الاختبار <select id="qnoSel" class="qsel sm">'+QNO.map(function(q){return '<option'+(cfg.quizNo===q?' selected':'')+'>'+q+'</option>';}).join('')+'</select></label>'+
      (isHi()?'<p class="muted small">الصفان 11 و12: الدرجة 10 (AO1 = 3، AO2 = 7)، مفردتا اختيار من متعدد، ومفردة طويلة من 4 إلى 5 درجات، حسب وثيقة التقويم.</p>':'<label class="qrow">الدرجة الكلية <select id="totSel" class="qsel sm">'+[10,15,20].map(function(t){return '<option'+(+cfg.total===t?' selected':'')+'>'+t+'</option>';}).join('')+'</select></label><p class="muted small">التوزيع: 40% معرفة، 40% تطبيق، 20% استدلال.</p>')+
      '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن الاختبار</button></section>';
  }else{
    h+='<section class="qcard"><h3>2. الوحدة</h3><select id="unitSel" class="qsel">'+units.map(function(u){return '<option value="'+esc(u.unit)+'"'+(cfg.unit===u.unit?' selected':'')+'>الوحدة '+esc(u.unit)+(u.name?': '+esc(u.name):'')+'</option>';}).join('')+'</select>'+
      '<label class="qrow">عدد المفردات <select id="rcSel" class="qsel sm">'+[[0,'كل مفردات الوحدة'],[12,'12'],[20,'20'],[30,'30']].map(function(o){return '<option value="'+o[0]+'"'+(+cfg.reviewCount===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>'+
      '<button type="button" class="btn primary go-btn" id="makeBtn">كوّن المراجعة</button></section>';
  }
  h+='<section class="qcard"><h3>رأس الورقة</h3><div class="hdr-f">'+
    '<label>المديرية<input id="h_dir" value="'+esc(hdr.dir)+'"></label><label>المدرسة<input id="h_school" value="'+esc(hdr.school)+'"></label>'+
    '<label>الفصل الدراسي<select id="h_term"><option'+(hdr.term==='الأول'?' selected':'')+'>الأول</option><option'+(hdr.term==='الثاني'?' selected':'')+'>الثاني</option></select></label><label>العام الدراسي<input id="h_year" value="'+esc(hdr.year)+'" class="ltr"></label></div></section>'+
    '<section class="qcard"><h3>اختباراتي المحفوظة</h3><ul class="saved" id="savedList"><li class="muted">جارٍ التحميل…</li></ul></section>';
  $('qside').innerHTML=h;bindSide();loadSaved();
}
function unitsList(){
  var m={},order=[];bank.lessons.forEach(function(l){var k=String(l.unit);if(!m[k]){m[k]={unit:k,name:l.unit_name||'',lessons:[]};order.push(k);}m[k].lessons.push(l);});
  return order.sort(function(a,b){return parseInt(a,10)-parseInt(b,10);}).map(function(k){return m[k];});
}
function bindSide(){
  $('courseSel').onchange=function(){selectCourse(this.value);};
  Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'),function(b){b.onclick=function(){mode=b.getAttribute('data-mode');renderSide();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-lid]'),function(b){b.onchange=function(){var id=+b.getAttribute('data-lid');if(b.checked)cfg.lessons[id]=1;else delete cfg.lessons[id];var n=Object.keys(cfg.lessons).length;if(n>5)toast('الوثيقة: الاختبار القصير يغطي من 2 إلى 5 دروس');};});
  if($('qnoSel'))$('qnoSel').onchange=function(){cfg.quizNo=this.value;if(doc&&doc.kind==='quiz'){doc.quizNo=this.value;renderDoc();}};
  if($('totSel'))$('totSel').onchange=function(){cfg.total=+this.value;};
  if($('unitSel'))$('unitSel').onchange=function(){cfg.unit=this.value;};
  if($('rcSel'))$('rcSel').onchange=function(){cfg.reviewCount=+this.value;};
  if($('makeBtn'))$('makeBtn').onclick=make;
  ['dir','school','year','term'].forEach(function(k){var el=$('h_'+k);if(el)el.onchange=function(){hdr[k]=el.value.trim()||DEF_HDR[k];lsSet(hdrKey(),hdr);if(doc){doc.hdr=clone(hdr);renderDoc();}};});
}
function hdrKey(){return 'tahdir_quiz_hdr_'+(me?me.username:'');}
function selectCourse(key){
  course=courses.filter(function(c){return c.key===key;})[0]||null;cfg.lessons={};cfg.unit='';
  if(!course){renderSide();return;}
  lsSet('tahdir_quiz_course',key);
  cfg.total=gnum(course.grade)===5?10:15;
  $('qmain').innerHTML='<div class="welcome"><h2>جارٍ تحميل بنك الأسئلة…</h2></div>';
  return api('/api/quiz/bank?key='+encodeURIComponent(key)).then(function(r){
    bank=r;lessonById={};bank.lessons.forEach(function(l){lessonById[l.id]=l;});
    var u=unitsList();cfg.unit=u.length?u[0].unit:'';
    renderSide();
    if(!doc)welcome();
  },function(e){toast(e.message);});
}
function welcome(){
  var n=bank.items.length;
  $('qmain').innerHTML='<div class="welcome qwel"><h2>التقويم: اختبارات قصيرة ومراجعات</h2><p>'+(n?'في بنك الأسئلة '+n+' مفردة لهذا الصف، مكتوبة من مخرجات التعلم في كل درس ووفق «وثيقة تقويم تعلم الطلبة». اختر الدروس من القائمة ثم اضغط «كوّن الاختبار».':'لا توجد أسئلة جاهزة لهذا الصف بعد. يمكنك تكوين اختبار وكتابة مفرداتك بنفسك.')+'</p>'+
    '<div class="welcome-steps"><span>1. اختر الدروس</span><span>2. كوّن الاختبار</span><span>3. استبدل أو عدّل ما تريد</span><span>4. اطبع أو حمّل Word</span></div>'+(n?'':'<p><button type="button" class="btn primary" id="blankBtn">اختبار فارغ أكتب مفرداته</button></p>')+'</div>';
  if($('blankBtn'))$('blankBtn').onclick=function(){newDoc('quiz',[]);};
}
function poolFor(ids){var s={};ids.forEach(function(i){s[i]=1;});return bank.items.filter(function(x){return s[x.lesson_id];});}
function lessonOrder(){return bank.lessons.map(function(l){return l.id;});}
function newDoc(kind,items,extra){
  doc=Object.assign({kind:kind,subject:course.subject,grade:course.grade,course:course.key,quizNo:cfg.quizNo,total:cfg.total,hdr:clone(hdr),items:items,lessons:Object.keys(cfg.lessons).map(Number),id:null,title:''},extra||{});
  doc.spec=kind==='quiz'?spec(cfg.total):null;
  dirty=true;paperView='quiz';renderDoc();
}
function make(){
  if(!course)return;
  if(mode==='quiz'){
    var ids=lessonOrder().filter(function(id){return cfg.lessons[id];});
    if(!ids.length){toast('اختر درسًا واحدًا على الأقل');return;}
    var items=assemble(poolFor(ids),spec(cfg.total),ids);
    if(!items.length){toast('لا توجد مفردات كافية في الدروس المختارة');return;}
    newDoc('quiz',items);track('quiz_make',ids.length+' دروس',titleText(doc));
  }else{
    var u=unitsList().filter(function(x){return x.unit===cfg.unit;})[0];if(!u)return;
    var ids2=u.lessons.map(function(l){return l.id;}),pool=poolFor(ids2),pick2=pool;
    if(cfg.reviewCount&&pool.length>cfg.reviewCount){ // توزيع متوازن على الدروس
      var by={};pool.forEach(function(x){(by[x.lesson_id]=by[x.lesson_id]||[]).push(x);});Object.keys(by).forEach(function(k){by[k]=shuffle(by[k]);});
      pick2=[];var i=0;while(pick2.length<cfg.reviewCount&&i<200){ids2.forEach(function(id){if(by[id]&&by[id].length&&pick2.length<cfg.reviewCount)pick2.push(by[id].shift());});i++;}
    }
    var ord={};ids2.forEach(function(id,i){ord[id]=i;});
    pick2=pick2.slice().sort(function(a,b){return (ord[a.lesson_id]-ord[b.lesson_id])||(tOrd(a)-tOrd(b));}).map(clone);
    if(!pick2.length){toast('لا توجد مفردات لهذه الوحدة');return;}
    newDoc('review',pick2,{unit:u.unit,unit_name:u.name,lessons:ids2});track('review_make','الوحدة '+u.unit,titleText(doc));
  }
}
function renderDoc(){
  if(!doc){welcome();return;}
  var ck=checks(doc),allOk=ck.every(function(c){return c[0];});
  var h='<div class="qbar no-print"><div class="qbar-t"><input class="title-in sm" id="docTitle" value="'+esc(doc.title||titleText(doc))+'" aria-label="اسم الاختبار في قائمتك"><div class="muted small">'+(doc.id?'محفوظ في اختباراتي':'غير محفوظ بعد')+(dirty&&doc.id?' · فيه تعديلات لم تُحفظ':'')+'</div></div>'+
    '<div class="qbar-b"><button type="button" class="btn primary" id="printBtn">🖨 طباعة / PDF</button><button type="button" class="btn" id="wordBtn">⬇ تحميل Word</button><button type="button" class="btn" id="saveBtn">حفظ</button>'+(doc.kind==='quiz'?'<button type="button" class="btn" id="remakeBtn">نسخة أخرى</button>':'')+'<button type="button" class="btn" id="addBtn">+ مفردة</button></div></div>'+
    '<div class="checks no-print '+(allOk?'ok':'warn')+'"><b>'+(doc.kind==='review'?'المراجعة':(allOk?'✓ مطابق لمواصفات الاختبار القصير في وثيقة التقويم':'⚠ راجع النقاط المعلّمة'))+'</b><ul>'+ck.map(function(c){return '<li class="'+(c[0]?'y':'n')+'">'+(c[0]?'✓':'⚠')+' '+esc(c[1])+'</li>';}).join('')+'</ul></div>'+
    '<div class="ptabs no-print" role="tablist"><button type="button" class="ltab'+(paperView==='quiz'?' on':'')+'" data-pv="quiz">ورقة '+(doc.kind==='review'?'المراجعة':'الاختبار')+'</button><button type="button" class="ltab'+(paperView==='key'?' on':'')+'" data-pv="key">نموذج الإجابة</button></div>'+
    '<div class="paper" id="paper">'+(paperView==='quiz'?quizHtml(doc,false,true):keyHtml(doc,false))+'</div>';
  $('qmain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-meta]'),function(el){var it=doc.items[+el.getAttribute('data-meta')],L=lessonOf(it);el.textContent=TYPE_TXT[it.type]+' · '+(AO_TXT[it.ao]||it.ao||'')+' · '+(it.difficulty||'')+' · '+it.marks+' درجة'+(L.title?' · '+L.title:'');});
  Array.prototype.forEach.call(document.querySelectorAll('[data-pv]'),function(b){b.onclick=function(){paperView=b.getAttribute('data-pv');renderDoc();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-act]'),function(b){b.onclick=function(){itemAct(b.getAttribute('data-act'),+b.getAttribute('data-i'));};});
  $('docTitle').onchange=function(){doc.title=this.value.trim();dirty=true;};
  $('printBtn').onclick=printDoc;$('wordBtn').onclick=wordDoc;$('saveBtn').onclick=saveDoc;$('addBtn').onclick=addItem;
  if($('remakeBtn'))$('remakeBtn').onclick=function(){var ids=doc.lessons&&doc.lessons.length?doc.lessons:Object.keys(cfg.lessons).map(Number);var it=assemble(poolFor(ids),doc.spec||spec(doc.total),ids);if(it.length){doc.items=it;dirty=true;renderDoc();toast('نسخة جديدة من الاختبار نفسه');}};
}
function itemAct(a,i){
  var it=doc.items[i];if(!it)return;
  if(a==='up'&&i>0){doc.items.splice(i-1,0,doc.items.splice(i,1)[0]);}
  else if(a==='down'&&i<doc.items.length-1){doc.items.splice(i+1,0,doc.items.splice(i,1)[0]);}
  else if(a==='del'){doc.items.splice(i,1);}
  else if(a==='swap'){
    var inDoc={};doc.items.forEach(function(x){if(x.qid)inDoc[x.qid]=1;});
    var ids=doc.lessons&&doc.lessons.length?doc.lessons:[it.lesson_id];
    var pool=poolFor(ids).filter(function(x){return !inDoc[x.qid];});
    var c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao&&x.marks===it.marks;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type&&x.ao===it.ao;});
    if(!c.length)c=pool.filter(function(x){return x.type===it.type;});
    if(!c.length){toast('لا توجد مفردة بديلة مناسبة في الدروس المختارة');return;}
    var same=c.filter(function(x){return x.lesson_id===it.lesson_id;});
    doc.items[i]=clone(pick(same.length?same:c));toast(doc.items[i].marks!==it.marks?'استُبدلت (تغيّرت الدرجة)':'استُبدلت المفردة');
  }else if(a==='edit'){editItem(i);return;}
  dirty=true;renderDoc();
}
// ---------- محرّر المفردة ----------
function editItem(i,isNew){
  var it=i==null?isNew:doc.items[i];var ao=aoList();
  var ls=bank.lessons.length?bank.lessons:[{id:0,title:'—'}];
  var h='<div class="ed"><div class="ed-row"><label>النوع<select id="e_type">'+['mcq','short','long'].map(function(t){return '<option value="'+t+'"'+(it.type===t?' selected':'')+'>'+TYPE_TXT[t]+'</option>';}).join('')+'</select></label>'+
    '<label>الدرجة<input id="e_marks" type="number" min="1" max="8" value="'+esc(it.marks||1)+'"></label>'+
    '<label>هدف التقويم<select id="e_ao">'+ao.map(function(a){return '<option'+(it.ao===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select></label>'+
    '<label>الصعوبة<select id="e_diff">'+['منخفضة','متوسطة','مرتفعة'].map(function(a){return '<option'+(it.difficulty===a?' selected':'')+'>'+a+'</option>';}).join('')+'</select></label></div>'+
    '<label>الدرس<select id="e_lesson">'+ls.map(function(l){return '<option value="'+l.id+'"'+(+it.lesson_id===l.id?' selected':'')+'>'+esc(l.title)+'</option>';}).join('')+'</select></label>'+
    '<label>نص المفردة <span class="muted">(ضع الكلمة بين ** ** لتظهر بخط عريض)</span><textarea id="e_stem" rows="4">'+esc(it.stem||'')+'</textarea></label>'+
    '<div id="e_mcq"'+(it.type==='mcq'?'':' hidden')+'><div class="muted small">البدائل الأربعة — اختر الصحيح:</div>'+[0,1,2,3].map(function(k){return '<div class="ed-ch"><input type="radio" name="e_c" value="'+k+'"'+(+it.correct===k?' checked':'')+'><input id="e_ch'+k+'" value="'+esc((it.choices||[])[k]||'')+'"></div>';}).join('')+'</div>'+
    '<div id="e_ans"'+(it.type==='mcq'?' hidden':'')+'><label>نموذج الإجابة <span class="muted">(كل سطر = درجة)</span><textarea id="e_answer" rows="4">'+esc(it.answer||'')+'</textarea></label></div>'+
    '<div class="ed-row"><label>هدف التعلم<input id="e_outcome" value="'+esc(it.outcome||'')+'" class="ltr"></label><label class="grow">المعلومات الإضافية<input id="e_notes" value="'+esc(it.notes||'')+'"></label></div>'+
    (it.table?'<p class="muted small">هذه المفردة فيها جدول بيانات يبقى كما هو.</p>':'')+'</div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">'+(i==null?'مفردة جديدة':'تعديل المفردة '+(i+1))+'</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ</button></div>';
  box.classList.add('wide');ov.hidden=false;
  $('e_type').onchange=function(){var m=this.value==='mcq';$('e_mcq').hidden=!m;$('e_ans').hidden=m;if(m)$('e_marks').value=1;};
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  $('mCancel').onclick=close;ov.onclick=function(e){if(e.target===ov)close();};
  $('mOk').onclick=function(){
    var n=clone(it);n.type=$('e_type').value;n.marks=Math.max(1,parseInt($('e_marks').value,10)||1);n.ao=$('e_ao').value;n.difficulty=$('e_diff').value;
    n.lesson_id=+$('e_lesson').value;n.stem=$('e_stem').value.trim();n.outcome=$('e_outcome').value.trim();n.notes=$('e_notes').value.trim();
    if(!n.stem){toast('اكتب نص المفردة');return;}
    if(n.type==='mcq'){n.choices=[0,1,2,3].map(function(k){return $('e_ch'+k).value.trim();});var r=document.querySelector('input[name="e_c"]:checked');n.correct=r?+r.value:0;n.marks=1;
      if(n.choices.some(function(x){return !x;})){toast('اكتب البدائل الأربعة');return;}}
    else{n.answer=$('e_answer').value.trim();delete n.choices;delete n.correct;}
    if(n.qid&&JSON.stringify(n)!==JSON.stringify(it))n.edited=true;
    if(i==null){if(!n.qid)n.qid=0;doc.items.push(n);}else doc.items[i]=n;
    close();dirty=true;renderDoc();
  };
}
function addItem(){
  var inDoc={};doc.items.forEach(function(x){if(x.qid)inDoc[x.qid]=1;});
  var ids=doc.lessons&&doc.lessons.length?doc.lessons:lessonOrder();
  var pool=poolFor(ids).filter(function(x){return !inDoc[x.qid];});
  var ov=$('modal'),box=$('modalBox');
  var list=function(f){return pool.filter(function(x){return !f||x.type===f;}).slice(0,150).map(function(x){var L=lessonOf(x);return '<li><button type="button" class="pk" data-q="'+x.qid+'"><span class="pk-m">'+esc(TYPE_TXT[x.type])+' · '+esc(x.ao)+' · '+x.marks+' د · '+esc(L.title||'')+'</span>'+rich(x.stem.length>220?x.stem.slice(0,220)+'…':x.stem)+'</button></li>';}).join('')||'<li class="muted">لا توجد مفردات أخرى في هذه الدروس.</li>';};
  box.innerHTML='<h3 id="mTitle">إضافة مفردة</h3><div class="seg sm"><button type="button" class="on" data-f="">الكل</button><button type="button" data-f="mcq">اختيار من متعدد</button><button type="button" data-f="short">قصيرة</button><button type="button" data-f="long">طويلة</button></div><ul class="picker" id="pickList">'+list('')+'</ul><div class="m-actions"><button type="button" class="btn" id="mCancel">إغلاق</button><button type="button" class="btn primary" id="mNew">اكتب مفردة جديدة</button></div>';
  box.classList.add('wide');ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  var bindPick=function(){Array.prototype.forEach.call(box.querySelectorAll('[data-q]'),function(b){b.onclick=function(){var q=+b.getAttribute('data-q');var x=pool.filter(function(y){return y.qid===q;})[0];if(x){doc.items.push(clone(x));dirty=true;close();renderDoc();toast('أُضيفت المفردة في آخر الورقة');}};});};
  bindPick();
  Array.prototype.forEach.call(box.querySelectorAll('[data-f]'),function(b){b.onclick=function(){Array.prototype.forEach.call(box.querySelectorAll('[data-f]'),function(x){x.classList.toggle('on',x===b);});$('pickList').innerHTML=list(b.getAttribute('data-f'));bindPick();};});
  $('mCancel').onclick=close;ov.onclick=function(e){if(e.target===ov)close();};
  $('mNew').onclick=function(){close();editItem(null,{type:'short',marks:1,ao:aoList()[0],difficulty:'منخفضة',lesson_id:ids[0]||0,stem:'',answer:'',outcome:'',notes:''});};
}
// ---------- الطباعة وملف Word ----------
function chooseParts(title){
  return new Promise(function(res){
    var ov=$('modal'),box=$('modalBox');
    box.innerHTML='<h3 id="mTitle">'+esc(title)+'</h3><div class="parts"><label><input type="radio" name="pp" value="both" checked> الورقة ونموذج الإجابة</label><label><input type="radio" name="pp" value="quiz"> ورقة '+(doc.kind==='review'?'المراجعة':'الاختبار')+' فقط</label><label><input type="radio" name="pp" value="key"> نموذج الإجابة فقط</label></div><div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">متابعة</button></div>';
    ov.hidden=false;var close=function(v){ov.hidden=true;box.innerHTML='';res(v);};
    $('mCancel').onclick=function(){close(null);};$('mOk').onclick=function(){var r=document.querySelector('input[name="pp"]:checked');close(r?r.value:'both');};
  });
}
var leavingOk=0,IN_APP=/TahdirApp/.test(navigator.userAgent),MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function fileName(){return (doc.title||titleText(doc)).replace(/[\\/:*?"<>|]+/g,'-').slice(0,90);}
// التحميل من السيرفر برابط حقيقي: يعمل في التطبيق وفي متصفح الموبايل والكمبيوتر
function serverFile(format,html,win){
  toast('جارٍ التجهيز…');
  return api('/api/export',{format:format,name:fileName(),html:html}).then(function(r){
    if(win){try{win.location.href=r.url;return;}catch(e){}}
    leavingOk=Date.now();var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
  },function(e){if(win)try{win.close();}catch(x){}toast(e.message);});
}
function partsHtml(p,word){return (p!=='key'?(word?'':'<div class="pg">')+quizHtml(doc,word,false)+(word?'':'</div>'):'')+(word&&p==='both'?'<br clear="all" style="page-break-before:always">':'')+(p!=='quiz'?(word?'':'<div class="pg">')+keyHtml(doc,word)+(word?'':'</div>'):'');}
function printDoc(){
  chooseParts('طباعة / حفظ PDF').then(function(p){
    if(!p)return;
    track('quiz_print',p,titleText(doc));
    if(!IN_APP&&!MOBILE){ // الكمبيوتر: طباعة مباشرة من الصفحة
      var a=$('printArea');a.innerHTML=(p!=='key'?'<div class="ppage">'+quizHtml(doc,false,false)+'</div>':'')+(p!=='quiz'?'<div class="ppage">'+keyHtml(doc,false)+'</div>':'');
      document.body.classList.add('printing');
      setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing');a.innerHTML='';},500);},60);
      return;
    }
    // الموبايل والتطبيق: صفحة طباعة مستقلة (في التطبيق تُفتح في Chrome)
    var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
    serverFile('print',partsHtml(p,false),w).then(function(){if(IN_APP)toast('تُفتح صفحة الطباعة في المتصفح… اختر «حفظ PDF» أو الطابعة');});
  });
}
function wordDoc(){
  chooseParts('تحميل ملف Word').then(function(p){
    if(!p)return;
    var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(titleText(doc))+'</title>'+
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->'+
      '<style>@page WordSection1{size:595.3pt 841.9pt;margin:36pt 40pt 36pt 40pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic","Traditional Arabic",Arial;font-size:13pt;direction:rtl}p{margin:0 0 4pt}table{direction:rtl}.oval{display:inline-block;width:16pt;height:9pt;border:1pt solid #000;border-radius:5pt}</style></head>'+
      '<body dir="rtl" lang="AR-OM"><div class="WordSection1" dir="rtl">'+partsHtml(p,true)+'</div></body></html>';
    track('quiz_word',p,titleText(doc));
    serverFile('doc',html,null).then(function(){toast(IN_APP?'يُحمَّل ملف Word عبر المتصفح، ستجده في «التنزيلات»':'تم تحميل ملف Word');});
  });
}
function saveDoc(){
  var t=($('docTitle')&&$('docTitle').value.trim())||titleText(doc);doc.title=t;
  return api('/api/quizzes',{id:doc.id,title:t,grade:doc.grade,subject:doc.subject,kind:doc.kind,data:doc}).then(function(r){doc.id=r.id;dirty=false;renderDoc();loadSaved();toast('حُفظ في اختباراتي');track('quiz_save',doc.kind,t);},function(e){toast(e.message);});
}
function loadSaved(){
  if(!$('savedList'))return;
  api('/api/quizzes').then(function(r){
    var l=r.quizzes||[];var el=$('savedList');if(!el)return;
    el.innerHTML=l.length?l.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-delq="'+q.id+'" aria-label="حذف">×</button></li>';}).join(''):'<li class="muted">لا يوجد. بعد تكوين اختبار اضغط «حفظ».</li>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openSaved(+b.getAttribute('data-open'));};});
    Array.prototype.forEach.call(el.querySelectorAll('[data-delq]'),function(b){b.onclick=function(){dialog({title:'حذف الاختبار المحفوظ؟',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-delq'),null,'DELETE').then(function(){if(doc&&doc.id===+b.getAttribute('data-delq'))doc.id=null;loadSaved();toast('حُذف');});});};});
  },function(){});
}
function openSaved(id){
  api('/api/quizzes/'+id).then(function(r){
    var d=r.quiz.data;d.id=r.quiz.id;d.title=r.quiz.title;
    var go=function(){doc=d;dirty=false;paperView='quiz';if(d.kind==='quiz'){cfg.quizNo=d.quizNo||cfg.quizNo;}renderDoc();renderSide();};
    if(!course||course.key!==d.course){var c=courses.filter(function(x){return x.key===d.course;})[0];if(c){selectCourse(c.key).then(go);return;}}
    go();
  },function(e){toast(e.message);});
}
// ---------- البداية ----------
$('logoutBtn').onclick=logout;
window.addEventListener('beforeunload',function(e){if(Date.now()-leavingOk<5000)return;if(doc&&dirty&&doc.items.length){e.preventDefault();e.returnValue='';}});
Promise.all([api('/api/me'),api('/api/courses')]).then(function(r){
  me=r[0];$('who').textContent=me.name;if(me.role==='admin'&&$('adminLink'))$('adminLink').hidden=false;
  hdr=Object.assign(clone(DEF_HDR),lsGet(hdrKey())||{});
  courses=(r[1].courses||[]).sort(function(a,b){return (gnum(a.grade)-gnum(b.grade))||a.subject.localeCompare(b.subject,'ar');});
  if(!courses.length){$('qmain').innerHTML='<div class="welcome"><h2>لا توجد صفوف متاحة لحسابك</h2><p>تواصل مع أ. محمد مجدي.</p></div>';return;}
  var last=lsGet('tahdir_quiz_course'),c=courses.filter(function(x){return x.key===last;})[0]||courses.filter(function(x){return x.quiz_items;})[0]||courses[0];
  selectCourse(c.key);
},function(e){$('qmain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
