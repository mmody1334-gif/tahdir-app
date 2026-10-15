(function(){
'use strict';
guard();
var GRADE_ORDER=['الصف الخامس','الصف السادس','الصف السابع','الصف الثامن','الصف التاسع','الصف العاشر','الصف الحادي عشر','الصف الثاني عشر','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الأول الثانوي','الثاني الثانوي','الثالث الثانوي','المسار العام'];
function ckey(l){return (l.subject||'')+'|'+l.grade;}
var LEGACY_SUBJ={'':1,'الأحياء':1,'العلوم':1,'اللغة الإنجليزية':1};
function toolMin(l,v){return LEGACY_SUBJ[l.subject||'']?v:'3.4.0';}
function isEn(l){return /انجليز|إنجليز|English/i.test(l.subject||'');}
// المواد: كل معلم يختار مادته ثم تظهر صفوفها
var SUBJ_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌'};
var SUBJ_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات'];
var subj=null;try{subj=localStorage.getItem('tahdir_subject');}catch(e){}
function subjOf(l){return l.subject||'';}
function subjIcon(s){return SUBJ_ICON[s]||'📘';}
function subjects(){var s={};lessons.forEach(function(l){s[subjOf(l)]=1;});return Object.keys(s).sort(function(a,b){var x=SUBJ_ORDER.indexOf(a),y=SUBJ_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ar');});}
function gradeRange(s){var g=lessons.filter(function(l){return subjOf(l)===s;}).map(function(l){return GRADE_ORDER.indexOf(l.grade);}).filter(function(i){return i>=0;});if(!g.length)return '';var a=Math.min.apply(null,g)+1,b=Math.max.apply(null,g)+1;return a===b?'الصف '+GRADE_ORDER[a-1]:'الصفوف '+a+'–'+b;}
function inGroup(l){var ss=subjects();if(ss.length<2)return true;return subjOf(l)===subj;}
var me=null,lessons=[],currentId=null,openGrades={},openUnits={},viewed={};
var DEF_SETTINGS={level:['التذكُّر','الإبداع'],strategies:['التعلم التعاوني','التعلم التشاركي','التعلم الذاتي'],resources:['الكتاب','السبورة التقليدية','جهاز عرض البيانات','الوسائط المتعددة (سمعية - بصرية)']};
var settings=JSON.parse(JSON.stringify(DEF_SETTINGS));
function lsGet(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function editsKey(){return 'tahdir_edits_'+me.username;}
var ESSENTIAL=[
  {key:'concepts',label:'المفاهيم',icon:'mol'},
  {key:'pre_learning',label:'التهيئة / التمهيد / التعلم القبلي',icon:'seed'},
  {key:'activities_teach',label:'إجراءات سير الدرس / الأنشطة التدريسية',icon:'scope'},
  {key:'formative',label:'التقويم التكويني',icon:'cell'},
  {key:'closing',label:'التقويم الختامي',icon:'leaf'},
  {key:'homework',label:'الأنشطة والمهام المنزلية',icon:'flask'},
  {key:'outcomes',label:'المخرجات التعليمية',icon:'dna',note:'تُعلَّم كلها تلقائيًا في نور'},
  {key:'weekly',label:'ملاحظات ضمن خطة الدراسة الأسبوعية',icon:'seed',note:'يشاهدها الطالب وولي الأمر'}
];
var EN_LABEL={strategies:'Strategies',resources:'Teaching aids & resources'};
var EXTRA=[
  {key:'strategies',label:'الاستراتيجيات كما وردت في ملف التحضير'},
  {key:'resources',label:'الوسائل ومصادر التعلم'},
  {key:'enrich',label:'نشاط إثرائي / علاجي (تفريد التعليم)'},
  {key:'misconceptions',label:'المفاهيم الخاطئة وسوء الفهم'}
];
var ICONS={
  dna:'<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12s10 6 10 6"/><path d="M8.5 7h7M8.5 17h7M10 12h4"/>',
  cell:'<ellipse cx="12" cy="12" rx="9" ry="7.5"/><circle cx="13" cy="11" r="3"/><circle cx="13" cy="11" r=".9" fill="currentColor"/><path d="M6 14.5c1-.8 2-.8 3 0"/>',
  leaf:'<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>',
  mol:'<circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="7" r="2.3"/><circle cx="12" cy="17" r="2.3"/><path d="M8 8.3l2.7 6.6M16 8.3l-2.7 6.6M8.3 7h7.4"/>',
  seed:'<path d="M12 21v-8"/><path d="M12 13c-4 0-6-3-6-7 4 0 6 3 6 7z"/><path d="M12 11c0-4 2-6 6-6 0 4-2 6-6 6z"/>',
  scope:'<path d="M6 21h12M9 21v-3h6v3M10 18l-1-3 5-9 3 1.6-5 9"/><path d="M13.5 4.5l1.3-2.2 3 1.7-1.3 2.2"/><path d="M15 17a5 5 0 0 0 3-7"/>',
  flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>'
};
function icon(n){return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||'')+'</svg>';}
function track(type,l,detail){
  try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,lesson_id:l&&l.id,detail:detail||''})});}catch(e){}
}
function grades(){var s={},out=[];lessons.forEach(function(l){if(!inGroup(l))return;var k=ckey(l);if(!s[k]){s[k]=1;out.push(k);}});
  return out.sort(function(a,b){var x=a.split('|'),y=b.split('|');var gi=GRADE_ORDER.indexOf(x[1]),gj=GRADE_ORDER.indexOf(y[1]);return (gi-gj)||x[0].localeCompare(y[0],'ar');});}
function multiSubj(){var s={};lessons.forEach(function(l){s[l.subject||'']=1;});return Object.keys(s).length>1;}
function unitsOf(g){var s={};lessons.forEach(function(l){if(ckey(l)===g)s[l.unit]=1;});return Object.keys(s).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);});}
function lessonsOf(g,u){return lessons.filter(function(l){return ckey(l)===g&&String(l.unit)===String(u);}).sort(function(a,b){return (a.lesson_no||0)-(b.lesson_no||0)||a.id-b.id;});}
function isEmpty(l){return !(l.pre_learning||l.outcomes||l.activities_teach);}

function renderTree(){
  var tree=$('tree'),ss=subjects();
  if(ss.length>1&&ss.indexOf(subj)<0)subj=ss[0];
  tree.innerHTML=(ss.length>1?'<label class="subj-pick"><span class="subj-ic" aria-hidden="true">'+subjIcon(subj)+'</span><span class="subj-l">المادة</span><select id="subjSel" aria-label="اختر المادة">'+ss.map(function(x){return '<option value="'+esc(x)+'"'+(x===subj?' selected':'')+'>'+esc(x)+' · '+esc(gradeRange(x))+'</option>';}).join('')+'</select></label>':'')+'<h2 class="tree-h">'+(ss.length>1?subjIcon(subj)+' '+esc(subj):'الكتاب المدرسي')+'</h2>';
  if($('subjSel'))$('subjSel').onchange=function(){subj=this.value;try{localStorage.setItem('tahdir_subject',subj);}catch(e){}renderTree();};
  grades().forEach(function(g){
    var gDiv=document.createElement('div');gDiv.className='g-block';
    var count=lessons.filter(function(l){return ckey(l)===g;}).length,gp=g.split('|');
    var gBtn=document.createElement('button');gBtn.className='g-btn';gBtn.type='button';
    gBtn.innerHTML='<span class="g-name">الصف '+esc(gp[1])+'</span><span class="g-meta">'+count+' درس <span class="chev">▾</span></span>';
    var gBody=document.createElement('div');gBody.className='g-body';
    if(openGrades[g]||lessons.some(function(l){return l.id===currentId&&ckey(l)===g;}))gBody.classList.add('open');
    unitsOf(g).forEach(function(u){
      var ls=lessonsOf(g,u),key=g+'|'+u;
      var uDiv=document.createElement('div');uDiv.className='u-block';
      var uBtn=document.createElement('button');uBtn.className='u-btn';uBtn.type='button';
      var uName=(ls[0]&&ls[0].unit_name)||'';
      uBtn.innerHTML='<span class="u-num">'+esc(u)+'</span><span class="u-name">'+(uName?esc(uName):'الوحدة '+esc(u))+'</span><span class="u-badge">'+ls.length+'</span>';
      var lList=document.createElement('div');lList.className='l-list';
      if(openUnits[key]||ls.some(function(l){return l.id===currentId;}))lList.classList.add('open');
      ls.forEach(function(l){
        var b=document.createElement('button');b.type='button';var e=isEmpty(l);
        b.className='l-item'+(l.id===currentId?' active':'')+(e?' empty':'');
        b.innerHTML='<span>'+esc(l.title||'(بدون عنوان)')+'</span>'+(e?'<span class="l-flag">فارغ</span>':'');
        b.onclick=function(){selectLesson(l.id);};lList.appendChild(b);
      });
      uBtn.onclick=function(){openUnits[key]=!lList.classList.contains('open');lList.classList.toggle('open');};
      uDiv.appendChild(uBtn);uDiv.appendChild(lList);gBody.appendChild(uDiv);
    });
    gBtn.onclick=function(){openGrades[g]=!gBody.classList.contains('open');gBody.classList.toggle('open');};
    gDiv.appendChild(gBtn);gDiv.appendChild(gBody);tree.appendChild(gDiv);
  });
}
function linksOf(t){
  var m=String(t||'').match(/https?:\/\/[^\s)<>"]+/g);if(!m)return '';
  var u=[];m.forEach(function(x){x=x.replace(/[.,،]+$/,'');if(u.indexOf(x)<0)u.push(x);});
  return '<div class="links">'+u.map(function(x){var host=x.replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');return '<a href="'+esc(x)+'" target="_blank" rel="noopener noreferrer">فتح الرابط: '+esc(host)+'</a>';}).join('')+'</div>';
}
var EN_LABEL={concepts:'Concepts',pre_learning:'Warm-up',activities_teach:'Lesson Procedures',formative:'Formative Assessment',closing:'Closing Assessment',homework:'Homework',outcomes:'Objectives',weekly:'Weekly Study Plan Comments (Arabic, for parents)',strategies:'Strategies',resources:'Resources',enrich:'Enrichment / Remedial',misconceptions:'Common Mistakes'};
function fieldBlock(l,f,ess){
  if(isEn(l)&&EN_LABEL[f.key])f={key:f.key,icon:f.icon,note:f.key==='outcomes'?'Noor ticks all lesson outcomes automatically':f.key==='weekly'?'':f.note,label:EN_LABEL[f.key]+' · '+f.label};
  var admin=me.role==='admin';
  return '<section class="sec'+(ess?' ess':' extra')+'">'+
    '<div class="sec-head"><h3>'+(ess?icon(f.icon):'')+'<span>'+esc(isEn(l)&&EN_LABEL[f.key]?EN_LABEL[f.key]:f.label)+'</span></h3>'+(f.note?'<span class="sec-note">'+esc(f.note)+'</span>':'')+
    ((l.ai_filled||[]).indexOf(f.key)>=0?'<span class="sugg" title="كتبها المساعد لاكتمال التحضير">مقترح</span>':'')+'</div>'+
    '<textarea class="field" dir="auto" id="f_'+f.key+'" spellcheck="false">'+esc(l[f.key]||'')+'</textarea>'+linksOf(l[f.key])+
    '<div class="sec-actions"><button type="button" class="btn small primary" data-copy="'+f.key+'">نسخ</button>'+
    '<button type="button" class="btn small" data-save="'+f.key+'">'+(admin?'حفظ للجميع':'حفظ على جهازي')+'</button></div></section>';
}
function buildCopyAll(l){
  if(isEn(l)||l.subject==='اللغة العربية'){ // تحضير الإنجليزي بالإنجليزية بالكامل
    var e='Title:\n'+(l.title||'')+'\n\nStrategies: '+(l.strategies||'')+'\nResources: '+(l.resources||'')+'\n\n';
    [['concepts','Concepts'],['pre_learning','Warm-up'],['activities_teach','Lesson Procedures'],['formative','Formative Assessment'],['closing','Closing Assessment'],['homework','Homework'],['outcomes','Objectives']].forEach(function(f){e+='— '+f[1]+' —\n'+(l[f[0]]||'')+'\n\n';});
    return e.trim();
  }
  var out='العنوان:\n'+(l.title||'')+'\n\n';
  if(isEn(l))out+='Strategies: '+(l.strategies||'')+'\nResources: '+(l.resources||'')+'\n\n';
  else out+='المستوى: '+settings.level.join('، ')+'\nالاستراتيجيات: '+settings.strategies.join('، ')+'\nالمصادر التعليمية: '+settings.resources.join('، ')+'\n\n';
  ESSENTIAL.forEach(function(f){if(f.key==='weekly'&&!l.weekly)return;out+='— '+f.label+' —\n'+(l[f.key]||'')+'\n\n';});
  return out.trim();
}
function buildCopyJson(l){
  var c=function(k){return hwVal(l,k);};
  var pre=c('pre_learning'),preOnly=(pre.match(/(^|\n)\s*التعلم القبلي\s*[:：][^\n]*/)||[''])[0].trim();
  var objective='';
  if(isEn(l)){objective=c('outcomes').split('\n').map(function(x){return x.replace(/^[•◆\-\s]+/,'').trim();}).filter(Boolean).join('\n');}
  else if(l.grade==='الخامس'){ // عبارات «أستطيع أن» تُكتب في خانة «إضافة مخرج تعليمي آخر»
    var ol=c('outcomes').split('\n').map(function(x){return x.trim();}).filter(Boolean);
    var main=ol.filter(function(x){return !/^5E/i.test(x);});if(!main.length)main=ol;
    objective=main.map(function(x){return x.replace(/^[0-9A-Za-z]+\s*[:：]\s*/,'');}).join('\n');
  }
  return JSON.stringify({source:'tahdir-al-aali',kind:'prep',title:l.title||'',grade:l.grade,subject:l.subject||'',unit:String(l.unit),unit_name:l.unit_name||'',lesson_no:lessonNo(l),term:+l.term||1,
    objective:objective,
    fields:{lesson_vocabulary:c('concepts'),description:pre,pre_learning:preOnly||pre,thinking_skills:c('activities_teach'),
    formative_assessment:c('formative'),closing_assessment:c('closing'),activities:c('homework'),weekly_study_plan_comments:c('weekly')},tick_all_outcomes:true,
    selects:{taxonomies:settings.level,strategies:(l.sel_strategies&&l.sel_strategies.length)?l.sel_strategies:settings.strategies,teaching_aids:(l.sel_resources&&l.sel_resources.length)?l.sel_resources:settings.resources}});
}
function saveField(l,k,v,btn){
  if(me.role==='admin'){
    var payload={};payload[k]=v;
    return api('/api/admin/lessons/'+l.id,payload).then(function(){l[k]=v;dropSugg(l,k,btn);renderTree();toast('حُفظ للجميع');},function(e){toast(e.message);});
  }
  var ed=lsGet(editsKey())||{};ed[l.id]=ed[l.id]||{};ed[l.id][k]=v;lsSet(editsKey(),ed);
  l[k]=v;dropSugg(l,k,btn);renderTree();toast('حُفظ على جهازك');
}
function dropSugg(l,k,btn){if(l.ai_filled)l.ai_filled=l.ai_filled.filter(function(x){return x!==k;});var s=btn&&btn.closest('.sec');var tg=s&&s.querySelector('.sugg');if(tg)tg.remove();}
var lessonTab='prep';
function isMcq(l){return l.hw_type==='mcq';}
function hwBlock(l){
  var admin=me.role==='admin',mcq=isMcq(l),h='<div class="copybar"><div class="copybar-text"><strong>'+(mcq?'واجب اختيار من متعدد: سؤالان بأربعة اختيارات':'واجب مقالي من سؤالين')+'</strong><span>اضغط «إرسال الواجب إلى نور» ونور مفتوحة: تُفتح صفحة إضافة المهمة لهذا الصف وتُجهَّز تلقائيًا، احفظها، ثم تُضاف الأسئلة في «إضافة مجموعة مفردات دفعة واحدة».</span></div>'+
    '<div class="copybar-btns"><button type="button" class="btn primary" id="sendHwBtn">إرسال الواجب إلى نور</button><button type="button" class="btn" id="copyHwBtn">نسخ للأداة</button><button type="button" class="btn" id="copyHwTxt">نسخ كنص</button></div></div>'+
    '<div class="hw-mark"><label for="hwMark">درجة كل سؤال</label><input id="hwMark" type="number" min="0" step="0.5" value="'+esc(settings.hwMark==null?1:settings.hwMark)+'"></div><div class="secs">';
  [1,2].forEach(function(n){
    h+='<section class="sec ess"><div class="sec-head"><h3>'+icon(n===1?'seed':'leaf')+'<span>السؤال '+n+'</span></h3><span class="sugg" title="كتبه المساعد من محتوى الدرس">مقترح</span></div>'+
      '<textarea class="field" dir="auto" id="f_hw_q'+n+'" spellcheck="false">'+esc(l['hw_q'+n]||'')+'</textarea>'+
      '<div class="sec-head" style="margin-top:10px"><h3 style="font-size:.86rem;color:var(--mute)"><span>'+(mcq?'الاختيارات الأربعة: السطر الأول هو الإجابة الصحيحة (يُخلط ترتيبها تلقائيًا عند الإرسال)':'الإجابة النموذجية')+'</span></h3></div>'+
      '<textarea class="field" dir="auto" id="f_hw_a'+n+'" spellcheck="false">'+esc(l['hw_a'+n]||'')+'</textarea>'+
      '<div class="sec-actions"><button type="button" class="btn small primary" data-copy="hw_q'+n+'">نسخ السؤال</button>'+
      '<button type="button" class="btn small" data-save="hw_q'+n+'">'+(admin?'حفظ السؤال للجميع':'حفظ السؤال')+'</button>'+
      '<button type="button" class="btn small" data-save="hw_a'+n+'">'+(mcq?(admin?'حفظ الاختيارات للجميع':'حفظ الاختيارات'):(admin?'حفظ الإجابة للجميع':'حفظ الإجابة'))+'</button></div></section>';
  });
  return h+'</div>';
}
function hwVal(l,k){var el=$('f_'+k);return el?el.value:(l[k]||'');}
function shuffled(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function mcqChoices(raw){return String(raw||'').split('\n').map(function(x){return x.trim();}).filter(Boolean).slice(0,6);}
function hwItems(l){var m=settings.hwMark==null?1:settings.hwMark;
  if(isMcq(l))return [1,2].map(function(n){var c=mcqChoices(hwVal(l,'hw_a'+n));if(c.length<2)return {text:''};var right=c[0],mix=shuffled(c);
    return {type:'mcq',text:hwVal(l,'hw_q'+n),choices:mix,correct:mix.indexOf(right)+1,answer:right,mark:m};}).filter(function(x){return x.text.trim();});
  return [1,2].map(function(n){return {text:hwVal(l,'hw_q'+n),answer:hwVal(l,'hw_a'+n),mark:m};}).filter(function(x){return x.text.trim();});}
function lessonNo(l){if(l.lesson_no)return +l.lesson_no;var n=0;for(var i=0;i<lessons.length;i++){var x=lessons[i];if(ckey(x)===ckey(l)&&String(x.unit)===String(l.unit)){n++;if(x.id===l.id)return n;}}return 0;}
function buildHwJson(l){var t=$('f_title');return JSON.stringify({source:'tahdir-al-aali',kind:'homework',title:(t&&t.value.trim())||l.title||'',base_title:l.title||'',grade:l.grade,subject:l.subject||'',unit:String(l.unit),lesson_no:lessonNo(l),items:hwItems(l)});}
function sendToNour(kind,json,okMsg,minVer,fallback){
  var need=IN_APP||hasExt()?minVer:(verCmp(minVer,TOOL_FORCE)>0?minVer:TOOL_FORCE);
  if(!toolOk(need)){
    if(!IN_APP&&toolVersion()&&!hasExt()&&!toolOk()){forceToolUpdate();return false;}
    if(toolVersion()){toolDialog('لإرسال تحضير هذه المادة إلى نور حدّث «أداة نور» إلى الإصدار '+TOOL_LATEST+' (اضغط «تثبيت الأداة» ثم «تحديث» في Tampermonkey).');return false;}
    toolDialog(toolVersion()?'أداة نور عندك قديمة. حدّثها مرة واحدة وبعدها تتحدث تلقائيًا.':'الإرسال إلى نور يحتاج تثبيت «أداة نور» مرة واحدة على متصفحك.');
    return false;
  }
  var done=false,ev='tahdir-'+kind+'-ack';
  function onAck(){done=true;document.removeEventListener(ev,onAck);toast(okMsg);}
  document.addEventListener(ev,onAck);
  try{var o=JSON.parse(json);o.nonce=Date.now().toString(36)+Math.random().toString(36).slice(2,8);json=JSON.stringify(o);}catch(e){}
  // في المتصفح نستخدم أسماء أحداث لا تسمعها النسخ القديمة المكررة من الأداة
  document.dispatchEvent(new CustomEvent((IN_APP?'tahdir-send-':'tahdir-v3-send-')+kind,{detail:json}));
  setTimeout(function(){if(!done){document.removeEventListener(ev,onAck);toast('لم تستجب الأداة. أعد تحميل الصفحة وحاول مرة أخرى');}},1500);
  return true;
}
function sendHw(l){
  if(!hwItems(l).length){toast('لا توجد أسئلة في هذا الواجب');return;}
  if(sendToNour('hw',buildHwJson(l),'أُرسل الواجب ✓ تابع في نور',toolMin(l,isMcq(l)?'2.6':'2.3'),function(){copyText(buildHwJson(l));track('copy_hw',l);}))track('send_hw',l,'send');
}
function sendPrep(l){
  if(sendToNour('prep',buildCopyJson(l),'أُرسل التحضير ✓ تابع في نور',toolMin(l,isEn(l)?'2.9':'2.3'),function(){copyText(buildCopyJson(l));track('copy_json',l);}))track('send_prep',l,'send');
}
function buildHwText(l){var L='أبجدهو';return 'واجب: '+(l.title||'')+'\n\n'+hwItems(l).map(function(x,i){return (i+1)+'- '+x.text+(x.choices?'\n'+x.choices.map(function(c,k){return '   '+L[k]+') '+c;}).join('\n'):'');}).join('\n\n');}
function renderLesson(l){
  var p=$('panel'),admin=me.role==='admin';
  var h='<article class="lesson"><div class="crumb">'+(l.subject?esc(l.subject)+' <span>›</span> ':'')+'الصف '+esc(l.grade)+' <span>›</span> الوحدة '+esc(l.unit)+(l.unit_name?' · '+esc(l.unit_name):'')+'</div>'+
    '<div class="lesson-head"><input class="title-in" id="f_title" value="'+esc(l.title)+'" aria-label="عنوان الدرس">'+
    '<div class="head-actions"><button type="button" class="btn small" data-save="title">'+(admin?'حفظ العنوان للجميع':'حفظ العنوان')+'</button></div></div>'+
    ((l.ai_filled||[]).filter(function(k){return k!=='concepts';}).length?'<div class="empty-note">الخانات المعلّمة «مقترح» لم تكن في ملف التحضير الأصلي. راجعها قبل الاستخدام.</div>':'')+
    (isEmpty(l)?'<div class="empty-note">لم يُرفع تحضير لهذا الدرس بعد.</div>':'')+
    '<div class="ltabs" role="tablist"><button type="button" role="tab" class="ltab'+(lessonTab==='prep'?' on':'')+'" data-ltab="prep">التحضير</button><button type="button" role="tab" class="ltab'+(lessonTab==='hw'?' on':'')+'" data-ltab="hw">الواجب الإلكتروني</button></div>'+
    '<div id="hwPane"'+(lessonTab==='hw'?'':' hidden')+'>'+hwBlock(l)+'</div><div id="prepPane"'+(lessonTab==='prep'?'':' hidden')+'>'+
    '<div class="copybar"><div class="copybar-text"><strong>التحضير إلى نور</strong><span>اضغط «إرسال التحضير إلى نور» ونور مفتوحة: تُفتح «إضافة تحضير» لهذا الصف ويُختار الدرس وتُملأ الأركان. يبقى لك التواريخ وزر «إضافة».</span></div>'+
    '<div class="copybar-btns"><button type="button" class="btn primary" id="sendPrepBtn">إرسال التحضير إلى نور</button><button type="button" class="btn" id="copyJsonBtn">نسخ للأداة</button><button type="button" class="btn" id="copyAllBtn">نسخ كنص</button></div></div><div class="secs">';
  ESSENTIAL.forEach(function(f){if(f.key==='weekly'&&!l.weekly&&!isEn(l))return;h+=fieldBlock(l,f,true);});
  h+='</div><button type="button" class="extra-toggle" id="extraToggle" aria-expanded="false"><span>عناصر مرجعية من ملف التحضير الأصلي</span><span class="muted">لا تُنسخ إلى نور</span></button><div class="extra-body" id="extraBody" hidden>';
  EXTRA.forEach(function(f){h+=fieldBlock(l,f,false);});
  h+='</div></div></article>';
  p.innerHTML=h;
  Array.prototype.forEach.call(p.querySelectorAll('[data-ltab]'),function(b){b.onclick=function(){lessonTab=b.getAttribute('data-ltab');renderLesson(l);};});
  $('sendHwBtn').onclick=function(){sendHw(l);};
  $('copyHwBtn').onclick=function(){copyText(buildHwJson(l));track('copy_hw',l);};
  $('copyHwTxt').onclick=function(){copyText(buildHwText(l));track('copy_hw',l,'text');};
  $('hwMark').onchange=function(){var v=parseFloat(this.value);if(!(v>=0))v=1;settings.hwMark=v;lsSet('tahdir_settings_v1',settings);toast('تم حفظ الدرجة');};
  $('extraToggle').onclick=function(){var b=$('extraBody');b.hidden=!b.hidden;this.setAttribute('aria-expanded',String(!b.hidden));};
  $('copyAllBtn').onclick=function(){copyText(buildCopyAll(l));track('copy_all',l);};
  $('sendPrepBtn').onclick=function(){sendPrep(l);};
  $('copyJsonBtn').onclick=function(){copyText(buildCopyJson(l));track('copy_json',l);};
  Array.prototype.forEach.call(p.querySelectorAll('[data-copy]'),function(b){b.onclick=function(){var k=b.getAttribute('data-copy');copyText($('f_'+k).value);track('copy_field',l,k);};});
  Array.prototype.forEach.call(p.querySelectorAll('[data-save]'),function(b){b.onclick=function(){var k=b.getAttribute('data-save');saveField(l,k,$('f_'+k).value.trim?$('f_'+k).value:$('f_'+k).value,b);};});
}
function selectLesson(id){
  currentId=id;var l=lessons.filter(function(x){return x.id===id;})[0];if(!l)return;
  renderTree();renderLesson(l);
  if(!viewed[id]){viewed[id]=1;track('view',l);}
  if(window.innerWidth<=860){try{$('panel').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}}
}
function showWelcome(t,m){$('panel').innerHTML='<div class="welcome">'+$('cellArt').innerHTML+'<h2>'+esc(t)+'</h2><p>'+esc(m)+'</p></div>';}
function openSettings(){
  var groups=[['level','المستوى'],['strategies','الاستراتيجيات'],['resources','المصادر التعليمية']];
  var h='<div class="settings"><h2>القيم الثابتة في كل تحضير</h2><p class="muted">تُضاف هذه القيم مع كل نسخ، وتختارها أداة نور من القوائم. تُحفظ على جهازك.</p>';
  groups.forEach(function(g){h+='<section class="sec"><div class="sec-head"><h3><span>'+g[1]+'</span></h3></div><div class="chips" id="chips_'+g[0]+'"></div><div class="chip-add"><input id="add_'+g[0]+'" placeholder="أضف قيمة كما تظهر في نور"><button type="button" class="btn small" data-add="'+g[0]+'">إضافة</button></div></section>';});
  h+='<button type="button" class="btn primary" id="closeSettings">تم</button></div>';
  $('panel').innerHTML=h;groups.forEach(function(g){renderChips(g[0]);});
  Array.prototype.forEach.call(document.querySelectorAll('[data-add]'),function(b){b.onclick=function(){var k=b.getAttribute('data-add'),i=$('add_'+k),v=i.value.trim();if(!v)return;settings[k].push(v);i.value='';lsSet('tahdir_settings_v1',settings);renderChips(k);};});
  $('closeSettings').onclick=function(){showWelcome('حُفظت الإعدادات','اختر درسًا من القائمة.');};
}
function renderChips(k){
  var row=$('chips_'+k);row.innerHTML='';
  settings[k].forEach(function(v,i){var c=document.createElement('span');c.className='chip';c.innerHTML='<span>'+esc(v)+'</span>';var b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','حذف '+v);b.onclick=function(){settings[k].splice(i,1);lsSet('tahdir_settings_v1',settings);renderChips(k);};c.appendChild(b);row.appendChild(c);});
}
function init(){
  $('settingsBtn').onclick=openSettings;
  if(IN_APP){if($('appBar'))$('appBar').hidden=true;}
  else{
    if($('pcBtn'))$('pcBtn').onclick=function(){toolDialog('');};
    if($('iosBtn'))$('iosBtn').onclick=function(){dialog({title:'التطبيق على الآيفون',html:'<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>افتح الموقع من متصفح <b>Safari</b>.</li><li>اضغط زر <b>«مشاركة»</b> ⬆ أسفل الشاشة.</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم «إضافة».</li></ol><p class="m-msg">يظهر «التحضير الآلي» بأيقونة على شاشتك مثل أي تطبيق.</p>',okText:'تم',cancelText:false});};}
  var st=lsGet('tahdir_settings_v1');if(st)settings=Object.assign(settings,st);
  Promise.all([api('/api/me'),api('/api/lessons')]).then(function(r){
    me=r[0];lessons=r[1].lessons;
    initNav(me);
    if(location.hash==='#settings'){history.replaceState(null,'','/app');setTimeout(openSettings,50);}
    if(me.role!=='admin'){var ed=lsGet(editsKey())||{};lessons.forEach(function(l){var e=ed[l.id];if(e)Object.keys(e).forEach(function(k){l[k]=e[k];if(l.ai_filled)l.ai_filled=l.ai_filled.filter(function(x){return x!==k;});});});}
    $('statLessons').textContent=lessons.length;$('statFilled').textContent=lessons.filter(function(l){return !isEmpty(l);}).length;
    renderTree();showWelcome('أهلًا '+me.name,'اختر الصف ثم الوحدة ثم الدرس. كل درس مقسّم بنفس خانات نموذج «إضافة تحضير» في منصة نور.');
  },function(e){showWelcome('تعذّر تحميل الدروس',e.message);});
}
init();
})();
