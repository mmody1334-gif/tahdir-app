// «تحليل نتائج الاختبارات»: المعلم يدخل درجات طلابه في كل مفردة، فتُحسب إحصاءات المفردات
// (المتوسط، الانحراف المعياري، المنوال، التباين، نسبة الإجابات الصحيحة، معامل التمييز، مستوى المفردة)
// ونسب مستويات التعلم (AO)، والمفردات الصعبة، ومستوى كل طالب، ويُكتب تقرير جاهز للطباعة بالترويسة الرسمية.
// المصدر: اختبار محفوظ في «اختباراتي» (المفردات والدروس جاهزة) أو اختبار من خارج المنصة (يُعرّف المعلم مفرداته).
// الحفظ: في حساب المعلم على السيرفر (نوع analysis في نفس مخزن «اختباراتي») فيجده من أي جهاز.
(function(){
'use strict';
guard();
var me=null,list=[],A=null,dirty=false,saving=null,bankCache={};
var AOS=['AO1','AO2','معرفة','تطبيق','استدلال','تذكر وفهم'];
var AO_NAME={AO1:'AO1 · المعرفة والفهم',AO2:'AO2 · التطبيق والتحليل',معرفة:'معرفة',تطبيق:'تطبيق',استدلال:'استدلال','تذكر وفهم':'تذكر وفهم'};
var LOWER_AO={AO1:1,معرفة:1,'تذكر وفهم':1};
function clone(o){return JSON.parse(JSON.stringify(o));}
function r2(x){return isFinite(x)?Math.round(x*100)/100:0;}
function f2(x){return r2(x).toFixed(2);}
function pct(x){return (Math.round(x*1000)/10).toFixed(1)+'%';}
function num(v){if(v===''||v==null)return null;var n=parseFloat(String(v).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);}).replace('٫','.').replace(',','.'));return isFinite(n)?n:null;}
function track(type,detail,title){try{fetch('/api/event',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,detail:detail||'',title:title||''})});}catch(e){}}
function today(){var d=new Date();return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate();}

// ---------- الإحصاء ----------
function rating(p){p*=100;return p>=90?'ممتاز':p>=80?'جيد جدًا':p>=70?'جيد':p>=60?'مقبول':'يحتاج إلى تحسين';}
function letter(p){p*=100;return p>=90?'أ':p>=80?'ب':p>=65?'ج':p>=50?'د':'هـ';}
function level(r){return r>=0.8?'سهلة':r>=0.5?'متوسطة':'صعبة';}
function stats(a){
  var items=a.items,N=0,rows=[];
  a.students.forEach(function(s,si){
    var sc=items.map(function(it,i){var v=num(s.s[i]);return v==null?null:Math.max(0,Math.min(+it.max||0,v));});
    if(sc.every(function(v){return v==null;}))return; // صف فارغ
    sc=sc.map(function(v){return v==null?0:v;});
    var tot=sc.reduce(function(x,y){return x+y;},0),mx=items.reduce(function(x,it){return x+(+it.max||0);},0);
    rows.push({i:si,name:s.name||('طالب '+(si+1)),sc:sc,tot:tot,p:mx?tot/mx:0});N++;
  });
  var maxTot=items.reduce(function(x,it){return x+(+it.max||0);},0);
  // مجموعتا التمييز: العليا والدنيا (27% للأعداد الكبيرة، والنصف للأعداد الصغيرة)
  var sorted=rows.slice().sort(function(x,y){return y.tot-x.tot;}),g=N>=20?Math.round(N*0.27):Math.floor(N/2);
  var up=sorted.slice(0,g),lo=sorted.slice(N-g);
  var it=items.map(function(item,i){
    var mx=+item.max||0,vals=rows.map(function(r){return r.sc[i];});
    var mean=N?vals.reduce(function(x,y){return x+y;},0)/N:0;
    var vr=N?vals.reduce(function(x,y){return x+(y-mean)*(y-mean);},0)/N:0;
    var fr={};vals.forEach(function(v){fr[v]=(fr[v]||0)+1;});var top=0;Object.keys(fr).forEach(function(k){if(fr[k]>top)top=fr[k];});
    var modes=Object.keys(fr).filter(function(k){return fr[k]===top;}).map(Number).sort(function(x,y){return x-y;});
    var full=mx?vals.filter(function(v){return v>=mx;}).length:0;
    var ratio=mx?mean/mx:0;
    var D=g&&mx?(up.reduce(function(x,r){return x+r.sc[i]/mx;},0)-lo.reduce(function(x,r){return x+r.sc[i]/mx;},0))/g:0;
    return {n:i+1,max:mx,ao:item.ao||'',lesson:item.lesson||'',lid:item.lid||null,mean:mean,sd:Math.sqrt(vr),vr:vr,modes:modes,pc:N?full/N:0,ratio:ratio,D:D,lvl:level(ratio)};
  });
  var aos={};it.forEach(function(x){var k=x.ao||'—';if(!aos[k])aos[k]={got:0,max:0,items:[]};aos[k].got+=x.mean*N;aos[k].max+=x.max*N;aos[k].items.push(x.n);});
  var aoList=Object.keys(aos).map(function(k){return {ao:k,p:aos[k].max?aos[k].got/aos[k].max:0,items:aos[k].items};});
  var les={};it.forEach(function(x){if(!x.lesson)return;if(!les[x.lesson])les[x.lesson]={got:0,max:0,lid:x.lid};les[x.lesson].got+=x.mean*N;les[x.lesson].max+=x.max*N;});
  var lesList=Object.keys(les).map(function(k){return {lesson:k,lid:les[k].lid,p:les[k].max?les[k].got/les[k].max:0};});
  var classP=N&&maxTot?rows.reduce(function(x,r){return x+r.tot;},0)/(N*maxTot):0;
  var thr=(+a.threshold||50)/100;
  rows.forEach(function(r){
    var wl={};it.forEach(function(x,i){if(x.lesson&&x.max&&r.sc[i]/x.max<0.5)wl[x.lesson]=1;});r.weakLessons=Object.keys(wl);
    var wa={};it.forEach(function(x,i){if(x.ao&&x.max&&r.sc[i]/x.max<0.5)wa[x.ao]=(wa[x.ao]||0)+1;});r.weakAO=Object.keys(wa);
  });
  return {N:N,rows:rows,items:it,aos:aoList,lessons:lesList,maxTot:maxTot,classP:classP,thr:thr,weak:rows.filter(function(r){return r.p<thr;}),g:g};
}
function indicators(S){
  var it=S.items.filter(function(x){return x.max;});if(!it.length||!S.N)return [];
  function best(f,cmp){return it.reduce(function(b,x){return cmp(f(x),f(b))?x:b;});}
  var hm=best(function(x){return x.mean;},function(a,b){return a>b;}),hv=best(function(x){return x.vr;},function(a,b){return a>b;}),
      lv=best(function(x){return x.vr;},function(a,b){return a<b;}),hp=best(function(x){return x.pc;},function(a,b){return a>b;}),lp=best(function(x){return x.pc;},function(a,b){return a<b;});
  return [['أعلى متوسط حسابي','المفردة '+hm.n+' ('+f2(hm.mean)+')'],['أعلى تباين','المفردة '+hv.n+' ('+f2(hv.vr)+')'],['أقل تباين','المفردة '+lv.n+' ('+f2(lv.vr)+')'],
    ['أعلى نسبة إجابات صحيحة','المفردة '+hp.n+' ('+pct(hp.pc)+')'],['أقل نسبة إجابات صحيحة','المفردة '+lp.n+' ('+pct(lp.pc)+')'],['عدد الطلبة','  '+S.N]];
}
function procFor(x){return LOWER_AO[x.ao]?'مراجعة المفردة مع الطلبة وتوضيح المفهوم':'تدريبات تطبيقية إضافية على نمط المفردة';}
function autoNotes(S){
  if(!S.N)return {a:'',b:'',c:''};
  var aos=S.aos.filter(function(x){return x.ao!=='—';}).sort(function(x,y){return y.p-x.p;});
  var hard=S.items.filter(function(x){return x.max&&x.lvl==='صعبة';}),easy=S.items.filter(function(x){return x.max&&x.lvl==='سهلة';});
  var a='بلغ متوسط أداء الطلبة في الاختبار '+pct(S.classP)+' بتقدير «'+rating(S.classP)+'»، وعدد الطلبة '+S.N+'.';
  if(aos.length)a+=' وجاءت نسب الإتقان في مستويات التعلم: '+aos.map(function(x){return (AO_NAME[x.ao]||x.ao)+' '+pct(x.p);}).join('، ')+'.';
  if(aos.length>1)a+=' وكان الأداء الأعلى في '+(AO_NAME[aos[0].ao]||aos[0].ao)+'، والأدنى في '+(AO_NAME[aos[aos.length-1].ao]||aos[aos.length-1].ao)+'.';
  a+=' وصُنّفت '+easy.length+' مفردة سهلة و'+(S.items.length-easy.length-hard.length)+' متوسطة و'+hard.length+' صعبة'+(hard.length?' (المفردات: '+hard.map(function(x){return x.n;}).join('، ')+')':'')+'.';
  a+=' وحصل '+S.weak.length+' من الطلبة على أقل من '+Math.round(S.thr*100)+'% من الدرجة الكلية.';
  var b='';
  if(aos.length>1&&LOWER_AO[aos[0].ao]&&!LOWER_AO[aos[aos.length-1].ao])b='يتركّز أداء الطلبة في المستويات المعرفية الدنيا (التذكر والفهم)، مع تدنٍّ نسبي في المستويات العليا (التطبيق والتحليل والاستدلال)، مما يدل على الحاجة إلى تدريب الطلبة على توظيف المعرفة في مواقف جديدة.';
  else if(aos.length>1)b='أداء الطلبة في المستويات العليا مقارب لأدائهم في المستويات الدنيا أو أعلى منه، مما يدل على قدرة جيدة على توظيف المعرفة، مع الحاجة إلى تثبيت بعض المفاهيم الأساسية.';
  else b='يعكس الأداء العام مستوى «'+rating(S.classP)+'»، ويحتاج إلى متابعة المفردات الصعبة ومعالجة أسباب الخطأ فيها.';
  var neg=S.items.filter(function(x){return x.max&&x.D<=0&&x.pc<1;});
  if(neg.length)b+=' كما أن معامل تمييز المفردات ('+neg.map(function(x){return x.n;}).join('، ')+') منخفض أو سالب، فيُستحسن مراجعة صياغتها أو مفتاح تصحيحها.';
  var low=S.lessons.filter(function(x){return x.p<0.5;});
  if(low.length)b+=' والدروس التي ظهر فيها ضعف: '+low.map(function(x){return '«'+x.lesson+'»';}).join('، ')+'.';
  var c=['تفعيل استراتيجيات التعلم النشط في أثناء الحصة.',
    'تدريب الطلبة على أسئلة '+(aos.length?(AO_NAME[aos[aos.length-1].ao]||aos[aos.length-1].ao):'المستويات العليا')+' من خلال الأنشطة الصفية والواجبات.',
    hard.length?'مراجعة المفردات الصعبة ('+hard.map(function(x){return x.n;}).join('، ')+') مع الطلبة وتحليل أخطائهم لمعرفة طبيعة الصعوبة.':'تثبيت المفاهيم بأسئلة متنوعة المستويات.',
    S.weak.length?'تنفيذ خطة علاجية للطلبة دون المستوى ('+S.weak.length+') ومتابعتهم بأوراق عمل علاجية.':'تقديم أنشطة إثرائية للطلبة المتفوقين.',
    'التأكد من بناء الاختبارات وفق المواصفات الواردة في وثيقة تقويم تعلم الطلبة.'];
  return {a:a,b:b,c:c.map(function(x,i){return (i+1)+'. '+x;}).join('\n')};
}

// ---------- الرسوم (SVG للشاشة والطباعة) ----------
function barSvg(data,opt){ // data: [{label,v(0..1),color}]
  opt=opt||{};var W=opt.w||680,H=opt.h||220,pad=34,bw=Math.max(8,Math.min(46,(W-pad*2)/Math.max(1,data.length)*0.62)),step=(W-pad*2)/Math.max(1,data.length);
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:'+W+'px;display:block;margin:0 auto;direction:ltr" font-family="Tahoma,Arial" font-size="11">';
  [0,25,50,75,100].forEach(function(t){var y=H-pad-(H-pad*2)*t/100;s+='<line x1="'+pad+'" x2="'+(W-6)+'" y1="'+y+'" y2="'+y+'" stroke="'+(t===50?'#c0392b':'#e3e3e3')+'"'+(t===50?' stroke-dasharray="4 3"':'')+'/><text x="'+(pad-4)+'" y="'+(y+4)+'" text-anchor="end" fill="#666">'+t+'%</text>';});
  // المحور يبدأ من اليمين (عربي): المفردة 1 على اليمين
  data.forEach(function(d,i){var x=W-pad-step*(i+0.5)-bw/2,h=(H-pad*2)*Math.max(0,Math.min(1,d.v)),y=H-pad-h;
    s+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="3" fill="'+(d.color||'#1f8a70')+'"/>';
    if(data.length<=30)s+='<text x="'+(x+bw/2)+'" y="'+(y-3)+'" text-anchor="middle" fill="#333" font-size="'+(data.length>16?9:10)+'">'+Math.round(d.v*100)+'</text>';
    s+='<text x="'+(x+bw/2)+'" y="'+(H-pad+14)+'" text-anchor="middle" fill="#333" font-size="'+(data.length>16?9:11)+'">'+esc(d.label)+'</text>';});
  return s+'</svg>';
}
var LVL_COLOR={'سهلة':'#2e9e5b','متوسطة':'#e39b1b','صعبة':'#d64545'};

// ---------- التخزين ----------
function newA(o){return Object.assign({id:null,title:'',source:'manual',quizId:null,course:'',subject:'',grade:'',date:today(),teacher:me&&me.name||'',threshold:50,
  items:[1,2,3,4,5].map(function(){return {max:1,ao:'',lesson:'',lid:null};}),students:[],notes:null,sugg:{},sig:{senior:'',principal:''}},o||{});}
function save(silent){
  if(!A)return Promise.resolve();
  var t=(A.title||'').trim()||('تحليل '+(A.subject||'')+' '+(A.grade||'')).trim();A.title=t;
  saving=api('/api/quizzes',{id:A.id,title:t,grade:A.grade,subject:A.subject,kind:'analysis',data:A}).then(function(r){A.id=r.id;dirty=false;if(!silent)toast('حُفظ في حسابك');setStatus();},function(e){toast(e.message);});
  return saving;
}
var saveT=null;function touch(){dirty=true;setStatus();clearTimeout(saveT);saveT=setTimeout(function(){save(true);},2500);}
function setStatus(){var el=$('anStatus');if(el)el.textContent=dirty?'جارٍ الحفظ…':(A&&A.id?'محفوظ في حسابك ✓':'');}

// ---------- القائمة ----------
function renderList(){
  var h='<div class="an-head"><div><h2>📊 تحليل نتائج الاختبارات</h2><p class="muted">أدخل درجات طلابك في كل مفردة، فيُحسب تحليل المفردات ومستويات التعلم ومستوى كل طالب، ويُكتب تقرير جاهز للطباعة والاعتماد. التحليلات محفوظة في حسابك وتفتحها من أي جهاز.</p></div></div>'+
    '<div class="an-new"><button type="button" class="btn primary" id="anFromQuiz">من اختبار محفوظ في «اختباراتي»</button><button type="button" class="btn" id="anManual">اختبار من خارج المنصة</button></div>';
  h+='<h3 class="an-sub">تحليلاتي</h3>';
  h+=list.length?'<ul class="an-list">'+list.map(function(q){return '<li><button type="button" class="link-btn" data-open="'+q.id+'"><b>'+esc(q.title)+'</b></button><span class="muted small">'+esc((q.subject||'')+' '+(q.grade||''))+' · '+esc(fmtDate(q.updated_at))+'</span><button type="button" class="x" data-del="'+q.id+'" aria-label="حذف">×</button></li>';}).join('')+'</ul>':'<p class="muted">لا توجد تحليلات بعد.</p>';
  $('anMain').innerHTML=h;
  $('anManual').onclick=function(){A=newA({source:'manual'});dirty=true;renderEditor();};
  $('anFromQuiz').onclick=pickQuiz;
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openA(+b.getAttribute('data-open'));};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'),function(b){b.onclick=function(){dialog({title:'حذف التحليل؟',message:'سيُحذف التحليل ودرجات الطلاب فيه نهائيًا.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/quizzes/'+b.getAttribute('data-del'),null,'DELETE').then(loadList);});};});
}
function loadList(){return api('/api/quizzes?kind=analysis').then(function(r){list=r.quizzes||[];renderList();},function(e){$('anMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});}
function openA(id){api('/api/quizzes/'+id).then(function(r){A=r.quiz.data;A.id=r.quiz.id;dirty=false;renderEditor();},function(e){toast(e.message);});}
function lessonsFor(course){
  if(!course)return Promise.resolve({});
  if(bankCache[course])return Promise.resolve(bankCache[course]);
  return api('/api/quiz/bank?key='+encodeURIComponent(course)).then(function(b){var m={};(b.lessons||[]).forEach(function(l){m[l.id]=l.title;});bankCache[course]=m;return m;},function(){return {};});
}
function fromQuiz(id){
  return api('/api/quizzes/'+id).then(function(r){
    var d=r.quiz.data;
    return lessonsFor(d.course).then(function(L){
      A=newA({source:'quiz',quizId:id,course:d.course||'',subject:d.subject||'',grade:d.grade||'',title:'تحليل '+(r.quiz.title||''),
        items:(d.items||[]).map(function(it){return {max:+it.marks||1,ao:it.ao||'',lesson:L[it.lesson_id]||'',lid:it.lesson_id||null,qid:it.qid||null};})});
      dirty=true;renderEditor();track('analysis_new','quiz',A.title);
    });
  },function(e){toast(e.message);});
}
function pickQuiz(){
  api('/api/quizzes?kind=quiz,review').then(function(r){
    var l=r.quizzes||[];
    if(!l.length){dialog({title:'لا توجد اختبارات محفوظة',message:'كوّن اختبارًا من صفحة «التقويم والاختبارات» واحفظه، أو اختر «اختبار من خارج المنصة».',okText:'حسنًا',cancelText:false});return;}
    dialog({title:'اختر الاختبار',html:'<div class="an-pick">'+l.map(function(q){return '<label><input type="radio" name="anq" value="'+q.id+'"> <b>'+esc(q.title)+'</b> <span class="muted small">'+esc((q.subject||'')+' '+(q.grade||''))+'</span></label>';}).join('')+'</div>',okText:'تحليل',cancelText:'إلغاء'})
      .then(function(ok){if(!ok)return;var c=document.querySelector('input[name=anq]:checked');if(c)fromQuiz(+c.value);});
  },function(e){toast(e.message);});
}

// ---------- المحرّر ----------
function aoSel(v,i){return '<select data-iao="'+i+'" class="an-in sm"><option value="">—</option>'+AOS.map(function(k){return '<option'+(k===v?' selected':'')+'>'+esc(k)+'</option>';}).join('')+'</select>';}
function itemsTable(){
  var it=A.items,manual=A.source!=='quiz';
  return '<div class="an-scroll"><table class="an-t an-items"><thead><tr><th>المفردة</th>'+it.map(function(x,i){return '<th>'+(i+1)+'</th>';}).join('')+(manual?'<th></th>':'')+'</tr></thead><tbody>'+
    '<tr><th>الدرجة العظمى</th>'+it.map(function(x,i){return '<td><input class="an-in num" data-imax="'+i+'" value="'+esc(x.max)+'" inputmode="decimal"></td>';}).join('')+(manual?'<td></td>':'')+'</tr>'+
    '<tr><th>مستوى التعلم</th>'+it.map(function(x,i){return '<td>'+aoSel(x.ao,i)+'</td>';}).join('')+(manual?'<td></td>':'')+'</tr>'+
    '<tr><th>الدرس</th>'+it.map(function(x,i){return '<td><input class="an-in" data-iles="'+i+'" value="'+esc(x.lesson||'')+'" placeholder="اختياري"></td>';}).join('')+(manual?'<td></td>':'')+'</tr>'+
    '</tbody></table></div>'+(manual?'<div class="an-row"><button type="button" class="btn small" id="anAddItem">+ مفردة</button><button type="button" class="btn small" id="anDelItem">− آخر مفردة</button></div>':'');
}
function gridTable(){
  var it=A.items;
  if(!A.students.length)A.students=[1,2,3,4,5].map(function(){return {name:'',s:[]};});
  var h='<div class="an-scroll"><table class="an-t an-grid"><thead><tr><th>#</th><th class="nm">اسم الطالب</th>'+it.map(function(x,i){return '<th>'+(i+1)+'<small>من '+esc(x.max)+'</small></th>';}).join('')+'<th>المجموع<small>من '+it.reduce(function(s,x){return s+(+x.max||0);},0)+'</small></th><th>%</th><th></th></tr></thead><tbody>';
  A.students.forEach(function(s,si){
    h+='<tr><td class="muted">'+(si+1)+'</td><td class="nm"><input class="an-in" data-name="'+si+'" value="'+esc(s.name||'')+'" placeholder="الاسم (اختياري)"></td>'+
      it.map(function(x,i){var v=s.s[i];return '<td><input class="an-in num" data-r="'+si+'" data-c="'+i+'" value="'+(v==null?'':esc(v))+'" inputmode="decimal"></td>';}).join('')+
      '<td class="tot" data-tot="'+si+'"></td><td class="tot" data-pc="'+si+'"></td><td><button type="button" class="x" data-rm="'+si+'" aria-label="حذف الطالب">×</button></td></tr>';
  });
  return h+'</tbody></table></div><div class="an-row"><button type="button" class="btn small" id="anAddSt">+ طالب</button><button type="button" class="btn small" id="anAdd10">+ 10 طلاب</button><span class="muted small">💡 تقدر تنسخ الأسماء والدرجات من Excel وتلصقها في أي خانة (Ctrl+V) فتتوزع على الجدول تلقائيًا.</span></div>';
}
function renderEditor(){
  var h='<div class="an-bar no-print"><button type="button" class="btn small" id="anBack">→ تحليلاتي</button>'+
    '<input class="title-in sm" id="anTitle" value="'+esc(A.title||'')+'" placeholder="اسم التحليل (مثال: تحليل الاختبار القصير الأول — الأحياء التاسع)">'+
    '<span class="muted small" id="anStatus"></span>'+
    '<span class="an-acts"><button type="button" class="btn primary" id="anPrint">🖨 طباعة التقرير / PDF</button><button type="button" class="btn" id="anWord">⬇ Word</button></span></div>'+
    '<section class="qcard"><h3>١. بيانات الاختبار</h3><div class="an-meta">'+
      '<label>المادة<input class="an-in" id="anSubj" value="'+esc(A.subject||'')+'"></label><label>الصف<input class="an-in" id="anGrade" value="'+esc(A.grade||'')+'"></label>'+
      '<label>الشعبة<input class="an-in" id="anSec" value="'+esc(A.section||'')+'"></label><label>التاريخ<input class="an-in" id="anDate" value="'+esc(A.date||'')+'"></label>'+
      '<label>حدّ الضعف %<input class="an-in num" id="anThr" value="'+esc(A.threshold||50)+'" inputmode="decimal"></label></div>'+
      (A.source==='quiz'?'<p class="muted small">المفردات ودرجاتها ومستوياتها مأخوذة من الاختبار المحفوظ. تقدر تعدّلها لو غيّرت شيئًا في الورقة.</p>':'<p class="muted small">عرّف مفردات الاختبار: الدرجة العظمى لكل مفردة ومستوى التعلم الذي تقيسه (AO1/AO2 أو معرفة/تطبيق/استدلال).</p>')+
      itemsTable()+'</section>'+
    '<section class="qcard"><h3>٢. درجات الطلاب</h3>'+gridTable()+'</section>'+
    '<section class="qcard" id="anRes"></section>';
  $('anMain').innerHTML=h;setStatus();bindEditor();renderResults();window.scrollTo(0,0);
}
function bindEditor(){
  $('anBack').onclick=function(){var go=function(){A=null;loadList();};if(dirty)save(true).then(go);else go();};
  $('anPrint').onclick=printReport;$('anWord').onclick=wordReport;
  $('anTitle').oninput=function(){A.title=this.value;touch();};
  [['anSubj','subject'],['anGrade','grade'],['anSec','section'],['anDate','date'],['anThr','threshold']].forEach(function(p){var el=$(p[0]);el.oninput=function(){A[p[1]]=el.value;touch();liveRes();};});
  var q=function(s){return document.querySelectorAll(s);};
  Array.prototype.forEach.call(q('[data-imax]'),function(el){el.oninput=function(){A.items[+el.getAttribute('data-imax')].max=num(el.value)||0;touch();liveRes();};el.onchange=function(){renderEditor();};});
  Array.prototype.forEach.call(q('[data-iao]'),function(el){el.onchange=function(){A.items[+el.getAttribute('data-iao')].ao=el.value;touch();liveRes();};});
  Array.prototype.forEach.call(q('[data-iles]'),function(el){el.oninput=function(){var i=+el.getAttribute('data-iles');A.items[i].lesson=el.value;A.items[i].lid=null;touch();liveRes();};});
  if($('anAddItem'))$('anAddItem').onclick=function(){A.items.push({max:1,ao:'',lesson:'',lid:null});touch();renderEditor();};
  if($('anDelItem'))$('anDelItem').onclick=function(){if(A.items.length>1){A.items.pop();A.students.forEach(function(s){s.s.length=Math.min(s.s.length,A.items.length);});touch();renderEditor();}};
  Array.prototype.forEach.call(q('[data-name]'),function(el){el.oninput=function(){A.students[+el.getAttribute('data-name')].name=el.value;touch();liveRes();};el.onpaste=pasteAt;});
  Array.prototype.forEach.call(q('[data-r]'),function(el){
    el.oninput=function(){var r=+el.getAttribute('data-r'),c=+el.getAttribute('data-c');A.students[r].s[c]=el.value.trim();mark(el,c);touch();liveRes();};
    el.onpaste=pasteAt;mark(el,+el.getAttribute('data-c'));
    el.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();var n=document.querySelector('[data-r="'+(+el.getAttribute('data-r')+1)+'"][data-c="'+el.getAttribute('data-c')+'"]');if(n){n.focus();n.select();}}};
  });
  Array.prototype.forEach.call(q('[data-rm]'),function(b){b.onclick=function(){A.students.splice(+b.getAttribute('data-rm'),1);touch();renderEditor();};});
  $('anAddSt').onclick=function(){A.students.push({name:'',s:[]});touch();renderEditor();};
  $('anAdd10').onclick=function(){for(var i=0;i<10;i++)A.students.push({name:'',s:[]});touch();renderEditor();};
}
function mark(el,c){var v=num(el.value),mx=+A.items[c].max||0;el.classList.toggle('bad',el.value.trim()!==''&&(v==null||v<0||v>mx));}
// لصق جدول من Excel: الأسطر = الطلاب، والأعمدة = (الاسم إن بدأ اللصق من خانة الاسم) ثم المفردات
function pasteAt(e){
  var t=(e.clipboardData||window.clipboardData).getData('text');if(!t||(t.indexOf('\t')<0&&t.indexOf('\n')<0))return;
  e.preventDefault();
  var el=e.target,isName=el.hasAttribute('data-name'),r0=+(el.getAttribute('data-r')||el.getAttribute('data-name')),c0=isName?-1:+el.getAttribute('data-c');
  var lines=t.replace(/\r/g,'').split('\n').filter(function(l,i,a){return l.length||i<a.length-1;});
  lines.forEach(function(line,k){
    var cells=line.split('\t'),r=r0+k;while(A.students.length<=r)A.students.push({name:'',s:[]});
    cells.forEach(function(v,j){var c=c0+j;v=v.trim();if(c<0)A.students[r].name=v;else if(c<A.items.length)A.students[r].s[c]=v;});
  });
  touch();renderEditor();toast('تم لصق '+lines.length+' صف');
}
var liveT=null;function liveRes(){clearTimeout(liveT);liveT=setTimeout(renderResults,200);}

// ---------- النتائج ----------
function notesOf(S){var a=autoNotes(S),n=A.notes||{};return {a:n.a!=null?n.a:a.a,b:n.b!=null?n.b:a.b,c:n.c!=null?n.c:a.c};}
function itemTableHtml(S,pr){
  return '<table class="an-t an-stat'+(pr?' pr':'')+'"><thead><tr><th>المفردة</th><th>الدرجة العظمى</th><th>المستوى</th><th>المتوسط</th><th>الانحراف المعياري</th><th>المنوال</th><th>التباين</th><th>نسبة الإجابات الصحيحة</th><th>معامل التمييز</th><th>مستوى المفردة</th></tr></thead><tbody>'+
    S.items.map(function(x){return '<tr><td>'+x.n+'</td><td>'+x.max+'</td><td>'+esc(x.ao||'—')+'</td><td>'+f2(x.mean)+'</td><td>'+f2(x.sd)+'</td><td>'+x.modes.map(function(m){return r2(m);}).join('، ')+'</td><td>'+f2(x.vr)+'</td><td>'+pct(x.pc)+'</td><td>'+f2(x.D)+'</td><td style="font-weight:bold;color:'+LVL_COLOR[x.lvl]+'">'+x.lvl+'</td></tr>';}).join('')+'</tbody></table>';
}
function renderResults(){
  var el=$('anRes');if(!el)return;
  var S=stats(A);
  A.students.forEach(function(s,si){var r=S.rows.filter(function(x){return x.i===si;})[0],t=document.querySelector('[data-tot="'+si+'"]'),p=document.querySelector('[data-pc="'+si+'"]');if(t)t.textContent=r?r2(r.tot):'';if(p){p.textContent=r?Math.round(r.p*100)+'%':'';p.style.color=r&&r.p<S.thr?'#c0392b':'';}});
  if(!S.N){el.innerHTML='<h3>٣. النتائج والتحليل</h3><p class="muted">أدخل درجات طالب واحد على الأقل لتظهر النتائج.</p>';return;}
  var N=notesOf(S),hard=S.items.filter(function(x){return x.max&&x.lvl==='صعبة';});
  var dist={};S.rows.forEach(function(r){var l=letter(r.p);dist[l]=(dist[l]||0)+1;});
  var h='<h3>٣. النتائج والتحليل</h3>'+
    '<div class="an-cards"><div><b>'+pct(S.classP)+'</b><span>أداء الطلبة · '+rating(S.classP)+'</span></div><div><b>'+S.N+'</b><span>عدد الطلبة</span></div><div><b>'+S.items.length+'</b><span>عدد المفردات · '+S.maxTot+' درجة</span></div><div class="'+(S.weak.length?'warn':'')+'"><b>'+S.weak.length+'</b><span>دون '+Math.round(S.thr*100)+'%</span></div></div>'+
    '<h4>مستويات التعلم</h4><div class="an-two"><table class="an-t"><thead><tr><th>المستوى</th><th>المفردات</th><th>نسبة الإجابات الصحيحة</th></tr></thead><tbody>'+S.aos.map(function(x){return '<tr><td>'+esc(AO_NAME[x.ao]||x.ao)+'</td><td>'+x.items.join('، ')+'</td><td><b>'+pct(x.p)+'</b></td></tr>';}).join('')+'</tbody></table>'+
      '<div>'+barSvg(S.aos.map(function(x){return {label:x.ao,v:x.p,color:x.p<0.5?'#d64545':x.p<0.8?'#e39b1b':'#2e9e5b'};}),{w:360,h:200})+'</div></div>'+
    (S.lessons.length?'<h4>الأداء حسب الدرس</h4><table class="an-t"><thead><tr><th>الدرس</th><th>نسبة الإتقان</th></tr></thead><tbody>'+S.lessons.map(function(x){return '<tr><td>'+esc(x.lesson)+'</td><td style="color:'+(x.p<0.5?'#c0392b':'inherit')+'"><b>'+pct(x.p)+'</b></td></tr>';}).join('')+'</tbody></table>':'')+
    '<h4>تحليل المفردات</h4><div class="an-scroll">'+itemTableHtml(S)+'</div>'+
    '<h4>نسبة الإجابات الصحيحة لكل مفردة</h4>'+barSvg(S.items.map(function(x){return {label:String(x.n),v:x.pc,color:LVL_COLOR[x.lvl]};}))+
    '<div class="an-two"><div><h4>المؤشرات</h4><table class="an-t"><tbody>'+indicators(S).map(function(r){return '<tr><th>'+r[0]+'</th><td>'+r[1]+'</td></tr>';}).join('')+'</tbody></table></div>'+
      '<div><h4>توزيع الطلبة على المستويات</h4><table class="an-t"><thead><tr>'+['أ','ب','ج','د','هـ'].map(function(l){return '<th>'+l+'</th>';}).join('')+'</tr></thead><tbody><tr>'+['أ','ب','ج','د','هـ'].map(function(l){return '<td>'+(dist[l]||0)+'</td>';}).join('')+'</tr></tbody></table><p class="muted small">أ 90–100 · ب 80–89 · ج 65–79 · د 50–64 · هـ أقل من 50</p></div></div>'+
    '<h4>المفردات الصعبة</h4>'+(hard.length?'<table class="an-t"><thead><tr><th>المفردة</th><th>الدرجة العظمى</th><th>المستوى</th><th>الإجراء</th><th>المقترحات</th></tr></thead><tbody>'+hard.map(function(x){return '<tr><td>'+x.n+'</td><td>'+x.max+'</td><td>'+esc(x.ao||'—')+'</td><td>'+procFor(x)+'</td><td><input class="an-in" data-sug="'+x.n+'" value="'+esc((A.sugg||{})[x.n]||'')+'" placeholder="اكتب مقترحك"></td></tr>';}).join('')+'</tbody></table>':'<p class="muted">لا توجد مفردات صعبة 👏</p>')+
    '<h4>الطلبة دون المستوى ('+S.weak.length+')</h4>'+(S.weak.length?'<table class="an-t"><thead><tr><th>الطالب</th><th>الدرجة</th><th>%</th><th>جوانب الضعف</th></tr></thead><tbody>'+S.weak.map(function(r){return '<tr><td>'+esc(r.name)+'</td><td>'+r2(r.tot)+' من '+S.maxTot+'</td><td>'+Math.round(r.p*100)+'%</td><td>'+esc((r.weakLessons.length?r.weakLessons:r.weakAO).join('، ')||'—')+'</td></tr>';}).join('')+'</tbody></table>':'<p class="muted">لا يوجد طلبة دون المستوى.</p>')+
    '<div class="an-row no-print">'+(A.course&&S.lessons.some(function(x){return x.lid;})?'<button type="button" class="btn" id="anRem">🩹 خطة علاجية للدروس الضعيفة</button><button type="button" class="btn" id="anWs">📝 ورقة عمل علاجية من بنك الأسئلة</button>':'<span class="muted small">الخطة العلاجية وورقة العمل تُولَّد تلقائيًا عند التحليل من اختبار محفوظ في «اختباراتي».</span>')+'</div>'+
    '<h4>الملاحظات <button type="button" class="btn small" id="anRegen" title="إعادة كتابة الملاحظات من النتائج الحالية">↻ إعادة التوليد</button></h4>'+
    '<label class="an-note">أولًا: تحليل الأداء<textarea class="an-in" data-note="a" rows="4">'+esc(N.a)+'</textarea></label>'+
    '<label class="an-note">ثانيًا: الدلالات التربوية<textarea class="an-in" data-note="b" rows="3">'+esc(N.b)+'</textarea></label>'+
    '<label class="an-note">ثالثًا: المقترحات التطويرية<textarea class="an-in" data-note="c" rows="5">'+esc(N.c)+'</textarea></label>'+
    '<h4>الاعتماد</h4><div class="an-meta"><label>معلم المادة<input class="an-in" id="anT" value="'+esc(A.teacher||'')+'"></label><label>المعلم الأول<input class="an-in" id="anS" value="'+esc(A.sig.senior||'')+'"></label><label>مدير المدرسة<input class="an-in" id="anP" value="'+esc(A.sig.principal||'')+'"></label></div>';
  el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll('[data-sug]'),function(i){i.oninput=function(){A.sugg=A.sugg||{};A.sugg[i.getAttribute('data-sug')]=i.value;touch();};});
  Array.prototype.forEach.call(el.querySelectorAll('[data-note]'),function(t){t.oninput=function(){A.notes=A.notes||{};A.notes[t.getAttribute('data-note')]=t.value;touch();};});
  $('anRegen').onclick=function(){A.notes=null;touch();renderResults();};
  $('anT').oninput=function(){A.teacher=this.value;touch();};$('anS').oninput=function(){A.sig.senior=this.value;remember();touch();};$('anP').oninput=function(){A.sig.principal=this.value;remember();touch();};
  if($('anRem'))$('anRem').onclick=function(){handoff('remedial',S);};
  if($('anWs'))$('anWs').onclick=function(){handoff('quiz',S);};
}
function remember(){try{localStorage.setItem('tahdir_an_sig',JSON.stringify(A.sig));}catch(e){}}
// تمرير الدروس الضعيفة إلى صفحة الخطط العلاجية أو التقويم (ورقة عمل علاجية)
function handoff(to,S){
  var weakL=S.lessons.filter(function(x){return x.lid&&x.p<0.65;}).sort(function(a,b){return a.p-b.p;});
  if(!weakL.length)weakL=S.lessons.filter(function(x){return x.lid;}).sort(function(a,b){return a.p-b.p;}).slice(0,2);
  var weakAO=S.aos.slice().sort(function(a,b){return a.p-b.p;}).map(function(x){return x.ao;});
  var o={to:to,course:A.course,lessons:weakL.slice(0,6).map(function(x){return x.lid;}),ao:weakAO,exclude:A.items.map(function(x){return x.qid;}).filter(Boolean),title:A.title,at:Date.now()};
  try{localStorage.setItem('tahdir_handoff',JSON.stringify(o));}catch(e){}
  var go=function(){location.href=tqUrl(to==='remedial'?'/remedial':'/quiz');};
  if(dirty)save(true).then(go);else go();
}

// ---------- التقرير (طباعة وWord) ----------
function reportHtml(word){
  var S=stats(A),N=notesOf(S),H=schoolHdr(),hard=S.items.filter(function(x){return x.max&&x.lvl==='صعبة';});
  var G='background:#93d695;',T='width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:'+(word?'10pt':'.8em'),C='border:1px solid #7fb8d8;padding:3px 5px;text-align:center',CH=C+';'+G+'font-weight:bold';
  var sec=function(t){return '<div style="'+G+'-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #7fb8d8;text-align:center;font-weight:bold;padding:4px;margin:12px 0 0">'+t+'</div>';};
  var tb=function(head,rows){return '<table style="'+T+'"><thead><tr>'+head.map(function(x){return '<th style="'+CH+'">'+x+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(r){return '<tr>'+r.map(function(x){return '<td style="'+C+'">'+x+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>';};
  var h=OFFICIAL_HEAD({dir:H.dir,school:H.school,title:'تحليل نتائج: '+(A.title||'الاختبار').replace(/^تحليل\s*/,''),line2:'الفصل الدراسي: '+H.term+' - العام الدراسي: '+H.year+'م',word:word});
  h+=sec('البيانات الأساسية')+tb(['المدرسة','معلم المادة','المادة','الصف','عدد الطلبة','التاريخ'],[[esc(H.school),esc(A.teacher||''),esc(A.subject||''),esc((A.grade||'')+(A.section?' / '+A.section:'')),S.N,esc(A.date||'')]]);
  // كشف الدرجات مجمّعًا حسب مستوى التعلم (مثل نموذج التحليل الورقي)
  var order=S.items.map(function(x,i){return i;}),groups=[];
  order.forEach(function(i){var k=S.items[i].ao||'—',g=groups.filter(function(x){return x.k===k;})[0];if(!g){g={k:k,c:[]};groups.push(g);}g.c.push(i);});
  var cols=[];groups.forEach(function(g){cols=cols.concat(g.c);});
  var fs=cols.length>18?(word?'7.5pt':'.62em'):(word?'9pt':'.72em');
  var GT='width:100%;border-collapse:collapse;margin:4px 0 8px;font-size:'+fs;
  var gh='<table style="'+GT+'"><thead><tr><th style="'+CH+'" rowspan="2">م</th><th style="'+CH+'" rowspan="2">اسم الطالب</th>'+groups.map(function(g){return '<th style="'+CH+'" colspan="'+g.c.length+'">'+esc(g.k)+'</th>';}).join('')+'<th style="'+CH+'" rowspan="2">المجموع<br>('+S.maxTot+')</th><th style="'+CH+'" rowspan="2">%</th><th style="'+CH+'" rowspan="2">المستوى</th></tr>'+
    '<tr>'+cols.map(function(i){return '<th style="'+CH+'">س'+(i+1)+'<br>('+S.items[i].max+')</th>';}).join('')+'</tr></thead><tbody>'+
    S.rows.map(function(r,k){return '<tr><td style="'+C+'">'+(k+1)+'</td><td style="'+C+';text-align:right;white-space:nowrap">'+esc(r.name)+'</td>'+cols.map(function(i){return '<td style="'+C+'">'+r2(r.sc[i])+'</td>';}).join('')+'<td style="'+C+';font-weight:bold">'+r2(r.tot)+'</td><td style="'+C+(r.p<S.thr?';color:#c0392b;font-weight:bold':'')+'">'+Math.round(r.p*100)+'</td><td style="'+C+'">'+letter(r.p)+'</td></tr>';}).join('')+
    '<tr><td style="'+CH+'" colspan="2">نسبة الإجابات الصحيحة</td>'+cols.map(function(i){return '<td style="'+C+';font-weight:bold">'+Math.round(S.items[i].pc*100)+'%</td>';}).join('')+'<td style="'+CH+'" colspan="3">'+pct(S.classP)+'</td></tr></tbody></table>';
  h+=sec('كشف درجات الطلبة')+gh;
  h+='<table style="width:100%;border-collapse:collapse"><tr><td style="width:48%;vertical-align:top;padding:0 0 0 8px">'+sec('مستويات التعلم')+tb(['المستوى','المفردات','النسبة'],S.aos.map(function(x){return [esc(AO_NAME[x.ao]||x.ao),x.items.join('، '),'<b>'+pct(x.p)+'</b>'];}))+'</td>'+
    '<td style="vertical-align:top">'+(word?'':barSvg(S.aos.map(function(x){return {label:x.ao,v:x.p,color:x.p<0.5?'#d64545':x.p<0.8?'#e39b1b':'#2e9e5b'};}),{w:340,h:170}))+'</td></tr></table>';
  h+=sec('تحليل المفردات')+itemTableHtml(S,true).replace('<table class="an-t an-stat pr">','<table style="'+T+'">').replace(/<th>/g,'<th style="'+CH+'">').replace(/<td>/g,'<td style="'+C+'">').replace(/<td style="font-weight/g,'<td style="'+C+';font-weight');
  if(!word)h+='<div style="page-break-inside:avoid">'+sec('نسبة الإجابات الصحيحة لكل مفردة')+barSvg(S.items.map(function(x){return {label:String(x.n),v:x.pc,color:LVL_COLOR[x.lvl]};}),{w:700,h:200})+'</div>';
  h+='<div style="page-break-inside:avoid">'+sec('المؤشرات')+tb(['المؤشر','الوصف'],indicators(S))+'</div>';
  h+='<div style="page-break-inside:avoid">'+sec('المفردات الصعبة')+(hard.length?tb(['رقم المفردة','الدرجة العظمى','مستوى المفردة','الإجراءات','المقترحات'],hard.map(function(x){return [x.n,x.max,esc(x.ao||'—'),procFor(x),esc((A.sugg||{})[x.n]||'')];})):'<p style="text-align:center">لا توجد مفردات صعبة</p>')+'</div>';
  h+='<div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#d3e9e0;border:1px solid #9cc;border-radius:8px;text-align:center;padding:6px;margin:10px 0;font-weight:bold">أداء الطلبة في الاختبار: '+pct(S.classP)+' — '+rating(S.classP)+'</div>';
  if(S.weak.length)h+=sec('الطلبة دون المستوى ('+S.weak.length+')')+tb(['الطالب','الدرجة','النسبة','جوانب الضعف'],S.weak.map(function(r){return [esc(r.name),r2(r.tot)+' من '+S.maxTot,Math.round(r.p*100)+'%',esc((r.weakLessons.length?r.weakLessons:r.weakAO).join('، ')||'—')];}));
  var para=function(t){return esc(t).replace(/\n/g,'<br>');};
  h+='<div style="page-break-inside:avoid">'+sec('الملاحظات')+'<div style="border:1px solid #7fb8d8;padding:8px 12px;font-size:'+(word?'11pt':'.88em')+';line-height:1.8"><b>أولًا: تحليل الأداء</b><br>'+para(N.a)+'<br><b>ثانيًا: الدلالات التربوية</b><br>'+para(N.b)+'<br><b>ثالثًا: المقترحات التطويرية</b><br>'+para(N.c)+'</div></div>';
  h+='<table style="width:100%;border-collapse:collapse;margin-top:18px;page-break-inside:avoid;font-size:'+(word?'11pt':'.9em')+'"><tr>'+[['معلم المادة',A.teacher],['المعلم الأول',A.sig.senior],['مدير المدرسة',A.sig.principal]].map(function(s){return '<td style="width:33%;text-align:center;vertical-align:top;padding:4px"><b>'+s[0]+'</b><br>'+esc(s[1]||'')+'<br><span style="color:#777">التوقيع: ...................</span></td>';}).join('')+'</tr></table>';
  return '<div dir="rtl">'+h+'</div>';
}
function fname(){return String(A.title||'تحليل النتائج').replace(/[\\/:*?"<>|]+/g,'-').slice(0,90);}
var MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function printReport(){
  if(!stats(A).N){toast('أدخل درجات الطلاب أولًا');return;}
  track('analysis_print','',A.title);
  if(!IN_APP&&!MOBILE){$('printArea').innerHTML='<div class="ppage">'+reportHtml(false)+'</div>';doPrint(fname());return;}
  var w=null;if(!IN_APP){try{w=window.open('','_blank');}catch(e){w=null;}}
  api('/api/export',{format:'print',name:fname(),html:'<div class="pg">'+reportHtml(false)+'</div>'}).then(function(r){if(w){try{w.location.href=r.url;return;}catch(e){}}location.href=r.url;},function(e){if(w)try{w.close();}catch(x){}toast(e.message);});
}
function wordReport(){
  if(!stats(A).N){toast('أدخل درجات الطلاب أولًا');return;}
  track('analysis_word','',A.title);toast('جارٍ التجهيز…');
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>'+esc(fname())+'</title>'+
    '<style>@page WordSection1{size:595.3pt 841.9pt;margin:30pt 30pt 30pt 30pt}div.WordSection1{page:WordSection1}body{font-family:"Simplified Arabic",Arial;font-size:12pt;direction:rtl}table{direction:rtl}</style></head>'+
    '<body dir="rtl" lang="AR-OM"><div class="WordSection1" dir="rtl">'+reportHtml(true)+'</div></body></html>';
  api('/api/export',{format:'doc',name:fname(),html:html}).then(function(r){var a=document.createElement('a');a.href=r.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);},function(e){toast(e.message);});
}

// ---------- البداية ----------
window.addEventListener('beforeunload',function(e){if(dirty&&A){save(true);e.preventDefault();e.returnValue='';}});
api('/api/me').then(function(m){
  me=m;initNav(m);
  var qs=new URLSearchParams(location.search),qid=+qs.get('quiz');
  var sig=null;try{sig=JSON.parse(localStorage.getItem('tahdir_an_sig')||'null');}catch(e){}
  var _new=newA;newA=function(o){var a=_new(o);if(sig)a.sig=Object.assign(a.sig,sig);return a;};
  if(qid){history.replaceState(null,'',location.pathname);fromQuiz(qid);}else loadList();
},function(e){$('anMain').innerHTML='<div class="welcome"><h2>تعذّر التحميل</h2><p>'+esc(e.message)+'</p></div>';});
})();
