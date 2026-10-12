function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var toastTimer=null;
function toast(msg){var t=$('toast');if(!t)return;t.textContent=msg||'تم';t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('on');},1800);}
function api(path,data,method){
  var o={method:method||(data?'POST':'GET'),credentials:'same-origin',headers:{}};
  if(data){o.headers['Content-Type']='application/json';o.body=JSON.stringify(data);}
  return fetch(path,o).then(function(r){
    if(r.status===401&&path!=='/api/login'){location.href='/';return Promise.reject(new Error('انتهت الجلسة'));}
    return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error(j.error||'حدث خطأ');return j;});
  });
}
function copyText(text){
  function fallback(){
    var ta=document.createElement('textarea');ta.value=text||'';ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    ta.remove();toast(ok?'تم النسخ':'تعذّر النسخ، حدّد النص وانسخه يدويًا');
  }
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text||'').then(function(){toast('تم النسخ');},fallback);}else fallback();}catch(e){fallback();}
}
function dialog(opts){
  return new Promise(function(resolve){
    var ov=$('modal'),box=$('modalBox');
    if(ov.classList.contains('locked')){resolve(null);return;}
    var h='<h3 id="mTitle">'+esc(opts.title)+'</h3>';
    if(opts.message)h+='<p class="m-msg">'+esc(opts.message)+'</p>';
    if(opts.html)h+=opts.html;
    if(opts.input)h+='<input id="mInput" class="m-input" value="'+esc(opts.value||'')+'" placeholder="'+esc(opts.placeholder||'')+'">';
    if(opts.textarea)h+='<textarea id="mText" class="m-text'+(opts.ltr?' ltr':'')+'"'+(opts.readonly?' readonly':'')+' placeholder="'+esc(opts.placeholder||'')+'">'+esc(opts.value||'')+'</textarea>';
    h+='<div class="m-actions">';
    if(opts.cancelText!==false)h+='<button type="button" class="btn" id="mCancel">'+esc(opts.cancelText||'إلغاء')+'</button>';
    h+='<button type="button" class="btn '+(opts.danger?'danger-solid':'primary')+'" id="mOk">'+esc(opts.okText||'موافق')+'</button></div>';
    box.innerHTML=h;ov.hidden=false;
    var inp=$('mInput')||$('mText');if(inp&&!opts.readonly)setTimeout(function(){inp.focus();},30);
    function close(v){ov.hidden=true;box.innerHTML='';document.removeEventListener('keydown',onKey);resolve(v);}
    function val(){if($('mInput'))return $('mInput').value;if($('mText'))return $('mText').value;return true;}
    function onKey(e){if(e.key==='Escape')close(null);if(e.key==='Enter'&&$('mInput')&&document.activeElement===$('mInput'))close(val());}
    document.addEventListener('keydown',onKey);
    if($('mCancel'))$('mCancel').onclick=function(){close(null);};
    $('mOk').onclick=function(){close(val());};
    ov.onclick=function(e){if(e.target===ov)close(null);};
  });
}
function guard(){
  document.addEventListener('contextmenu',function(e){var t=e.target;if(!(t&&(t.tagName==='TEXTAREA'||t.tagName==='INPUT')))e.preventDefault();});
  document.addEventListener('keydown',function(e){
    var k=(e.key||'').toLowerCase(),c=e.ctrlKey||e.metaKey;
    if(k==='f12'||(c&&k==='u')||(c&&k==='s')||(c&&e.shiftKey&&(k==='i'||k==='j'||k==='c'))){e.preventDefault();e.stopPropagation();}
  },true);
  document.addEventListener('dragstart',function(e){e.preventDefault();});
}
function logout(){api('/api/logout',{}).then(function(){location.href='/';},function(){location.href='/';});}
function fmtDate(t){if(!t)return '—';var d=new Date(t);return d.toLocaleDateString('ar-OM',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ar-OM',{hour:'2-digit',minute:'2-digit'});}
function ago(t){if(!t)return 'لم يدخل بعد';var s=(Date.now()-t)/1000;if(s<60)return 'الآن';if(s<3600)return 'منذ '+Math.floor(s/60)+' دقيقة';if(s<86400)return 'منذ '+Math.floor(s/3600)+' ساعة';var d=Math.floor(s/86400);return d===1?'أمس':'منذ '+d+' يوم';}
// ---------- أداة نور (مشتركة لكل الصفحات) ----------
var TOOL_URL='/tool/tahdir-noor.user.js',TOOL_LATEST='__TOOLVER__',TOOL_FORCE='__TOOLFORCE__',IN_APP=/TahdirApp/.test(navigator.userAgent),APK_URL='/download/tahdir.apk';
function verCmp(a,b){a=String(a||'').split('.');b=String(b||'').split('.');for(var i=0;i<3;i++){var d=(parseInt(a[i],10)||0)-(parseInt(b[i],10)||0);if(d)return d;}return 0;}
function toolVersion(){return document.documentElement.getAttribute('data-tahdir-tool')||'';}
// إضافة المتصفح الرسمية (Chrome / Edge): تتحدث من المتجر تلقائيًا ولا تحتاج أي إعداد
var EXT_STORE={chrome:'',edge:''};
function hasExt(){return !!document.documentElement.getAttribute('data-tahdir-ext');}
function browserKind(){var u=navigator.userAgent;return /Edg\//.test(u)?'edge':(/Firefox/.test(u)?'firefox':(/Chrome/.test(u)?'chrome':''));}
function extUrl(){return EXT_STORE[browserKind()]||'';}
function toolOk(min){var v=toolVersion();return !!v&&verCmp(v,min||TOOL_FORCE)>=0;}
function toolDialog(reason){
  if(IN_APP)return dialog({title:'أداة نور',message:'أنت تستخدم تطبيق «التحضير الآلي»، والأداة مدمجة فيه وتتحدث تلقائيًا. لا تحتاج تثبيت أي شيء.',okText:'تم',cancelText:false});
  var v=toolVersion(),ok=toolOk()||hasExt(),eu=extUrl();
  if(eu&&!hasExt()){
    var bn=browserKind()==='edge'?'Edge':'Chrome';
    return dialog({title:'أداة نور',html:(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+'<p class="m-msg"><b>خطوة واحدة فقط:</b> اضغط الزر الأخضر، وفي صفحة المتجر اضغط <b>«إضافة إلى '+bn+'» / Add to '+bn+'</b>. بعدها ارجع لهنا وحدّث الصفحة.</p><p class="m-msg muted small">الإضافة رسمية من متجر '+bn+' وتتحدث تلقائيًا، ولا تحتاج Tampermonkey ولا أي إعدادات.'+(v?' لو عندك Tampermonkey والأداة القديمة فيه، احذفها بعد تثبيت الإضافة.':'')+'</p>',okText:'تثبيت الإضافة من متجر '+bn,cancelText:'إغلاق'}).then(function(r){if(r)window.open(eu,'_blank');});
  }
  var st=v?(ok?'<p class="m-msg" style="color:var(--brand,#0e7c66)"><b>✓ الأداة مثبتة ومحدّثة (الإصدار '+esc(v)+').</b></p>':'<p class="m-msg" style="color:#b45309"><b>عندك إصدار قديم ('+esc(v)+') والأحدث '+esc(TOOL_LATEST)+'.</b> اضغط «تثبيت الأداة» ثم «تحديث» في صفحة Tampermonkey.</p>'):'';
  var h=(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+st+
   '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
   '<li><b>مرة واحدة فقط:</b> ثبّت إضافة Tampermonkey من متجر المتصفح:<br><a href="https://addons.mozilla.org/ar/firefox/addon/tampermonkey/" target="_blank" rel="noopener">Firefox</a> · <a href="https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener">Chrome</a> · <a href="https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd" target="_blank" rel="noopener">Edge</a></li>'+
   '<li>اضغط الزر الأخضر <b>«تثبيت الأداة»</b>، وفي الصفحة اللي تفتح اضغط <b>«تثبيت»</b> (أو «تحديث»).</li>'+
   '<li>ارجع لهنا وحدّث الصفحة.</li></ol>'+

   '<p class="m-msg" style="border-top:1px solid #dfe9e5;padding-top:10px"><b>على الموبايل:</b><br>أندرويد: <a href="'+APK_URL+'" target="_blank" rel="noopener">حمّل تطبيق «التحضير الآلي»</a> — الأداة مدمجة فيه، بدون Tampermonkey.<br>آيفون: افتح الموقع في Safari، ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية».</p>';
  return dialog({title:'أداة نور',html:h,okText:'تثبيت الأداة',cancelText:'إغلاق'}).then(function(r){if(r)window.open(TOOL_URL,'_blank');});
}
// تحديث إجباري: لو الأداة مثبتة بإصدار أقدم من المنشور على الموقع، لا يكمل المعلم حتى يحدّثها
var UPD_KEY='tahdir_tool_upd';
function updState(){try{var o=JSON.parse(localStorage.getItem(UPD_KEY)||'null');return o&&o.to===TOOL_LATEST?o:{to:TOOL_LATEST,n:0};}catch(e){return {to:TOOL_LATEST,n:0};}}
function updSave(o){try{localStorage.setItem(UPD_KEY,JSON.stringify(o));}catch(e){}}
function forceToolUpdate(){
  if(IN_APP||hasExt())return;
  var v=toolVersion(),ov=$('modal'),box=$('modalBox');if(!ov||!box)return;
  if(!v||toolOk()){ // محدّثة: نقفل النافذة لو كانت مفتوحة، وننبّه مرة لو فيه نسخة قديمة مكررة
    if(ov.classList.contains('locked')){ov.classList.remove('locked');ov.hidden=true;box.innerHTML='';toast('تم تحديث أداة نور ✓');}
    if(v)updSave({to:TOOL_LATEST,n:0,done:1});
    return;
  }
  var stt=updState(),tried=stt.n>0;
  if(extUrl()){ // على Chrome/Edge: الحل النهائي هو الإضافة الرسمية بدل Tampermonkey
    var bn=browserKind()==='edge'?'Edge':'Chrome';
    box.innerHTML='<h3 id="mTitle">⚠ ثبّت «أداة نور» الجديدة</h3><p class="m-msg">الأداة صارت إضافة رسمية في متجر '+bn+' تتحدث وحدها ولا تحتاج أي إعدادات. اضغط الزر، ثم <b>«إضافة إلى '+bn+'»</b>، وارجع لهنا.</p>'+
      '<div class="m-actions"><button type="button" class="btn" id="mReload">تم</button><button type="button" class="btn primary" id="mOk">تثبيت من متجر '+bn+'</button></div>';
    ov.hidden=false;ov.classList.add('locked');ov.onclick=null;
    $('mOk').onclick=function(){var o=updState();o.n=(o.n||0)+1;updSave(o);window.open(extUrl(),'_blank');$('mReload').classList.add('primary');};
    $('mReload').onclick=function(){location.reload();};
    return;
  }
  box.innerHTML='<h3 id="mTitle">'+(tried?'⚠ التحديث لم يكتمل بعد':'⚠ حدّث «أداة نور» قبل المتابعة')+'</h3>'+
    '<p class="m-msg">المتصفح ما زال يشغّل الإصدار <b>'+esc(v)+'</b>، والمطلوب <b>'+esc(TOOL_LATEST)+'</b>.</p>'+
    (tried?
      '<p class="m-msg">غالبًا عندك نسخة قديمة من الأداة مثبتة مرتين، أو لم يُضغط زر «تحديث» في صفحة Tampermonkey. الحل النهائي (دقيقة واحدة):</p>'+
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>اضغط أيقونة <b>Tampermonkey</b> بجانب شريط العنوان ← <b>«لوحة التحكم» / Dashboard</b>.</li><li>احذف <b>كل</b> سكربت اسمه «لصق التحضير والواجب - نور» أو فيه «التحضير الآلي» (أيقونة سلة المهملات).</li><li>ارجع هنا واضغط <b>«تثبيت الأداة من جديد»</b> ثم <b>Install / تثبيت</b>.</li><li>اضغط <b>«تم»</b> هنا.</li></ol>':
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>اضغط <b>«تحديث الأداة الآن»</b>.</li><li>في صفحة Tampermonkey اللي تفتح اضغط <b>«تحديث» / Update</b> (أو Install).</li><li>ارجع لهنا — النافذة تختفي وحدها بعد التحديث. لو ما اختفت اضغط «تم التحديث».</li></ol>')+
    '<div class="m-actions"><button type="button" class="btn" id="mReload">'+(tried?'تم':'تم التحديث')+'</button><button type="button" class="btn primary" id="mOk">'+(tried?'تثبيت الأداة من جديد':'تحديث الأداة الآن')+'</button></div>';
  ov.hidden=false;ov.classList.add('locked');ov.onclick=null;
  $('mOk').onclick=function(){var o=updState();o.n=(o.n||0)+1;updSave(o);window.open(TOOL_URL,'_blank');$('mReload').classList.add('primary');};
  $('mReload').onclick=function(){location.reload();};
}
function watchTool(){
  if(IN_APP)return;
  // الأداة قد تُحقن متأخرة (Firefox) أو تتحدث والصفحة مفتوحة: نعيد الفحص كلما تغيّر إصدارها أو رجع المعلم للصفحة
  var t=null;try{new MutationObserver(function(){clearTimeout(t);t=setTimeout(forceToolUpdate,400);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-tahdir-tool','data-tahdir-ext']});}catch(e){}
  document.addEventListener('visibilitychange',function(){if(document.hidden)return;var ov=$('modal');
    // رجع من صفحة Tampermonkey بعد ضغط التحديث: نعيد تحميل الصفحة لتعمل النسخة الجديدة
    if(ov&&ov.classList.contains('locked')&&updState().n>0){setTimeout(function(){location.reload();},700);return;}
    setTimeout(forceToolUpdate,600);});
  setTimeout(forceToolUpdate,2500);
}
// ---------- شريط التنقل: الأساسي ظاهر والباقي في قائمة ----------
function initNav(me){
  var mb=$('menuBtn'),ml=$('menuList');
  if(mb&&ml){
    var close=function(){ml.hidden=true;mb.setAttribute('aria-expanded','false');};
    var place=function(){if(window.innerWidth<=700){ml.style.top=ml.style.left='';return;}var r=mb.getBoundingClientRect();ml.style.top=(r.bottom+8)+'px';ml.style.left=Math.max(8,Math.min(r.left,window.innerWidth-ml.offsetWidth-8))+'px';};
    mb.onclick=function(e){e.stopPropagation();var o=ml.hidden;ml.hidden=!o;mb.setAttribute('aria-expanded',o?'true':'false');if(o)place();};
    window.addEventListener('resize',function(){if(!ml.hidden)place();});window.addEventListener('scroll',function(){if(!ml.hidden)close();},{passive:true});
    document.addEventListener('click',function(e){if(!ml.hidden&&!ml.contains(e.target))close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  if($('logoutBtn'))$('logoutBtn').onclick=logout;
  if($('toolBtn')){
    if(IN_APP)$('toolBtn').hidden=true;
    else{$('toolBtn').onclick=function(){toolDialog('');};setTimeout(function(){if(toolOk()||hasExt()){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},1500);}
  }
  if(me&&me.role==='admin')Array.prototype.forEach.call(document.querySelectorAll('.admin-only'),function(x){x.hidden=false;});
  if(me&&$('who'))$('who').textContent=me.name;
  watchTool();
}
// اختيار الصف: المادة أولًا (قائمة منبثقة) ثم صفوفها مرتّبة
var CP_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌'};
var CP_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات'];
var CP_GN={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
function cpLs(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}return null;}
function cpSubjects(cs){var s={};cs.forEach(function(c){s[c.subject]=1;});return Object.keys(s).sort(function(a,b){var x=CP_ORDER.indexOf(a),y=CP_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ar');});}
function cpGrades(cs,s){return cs.filter(function(c){return c.subject===s;}).sort(function(a,b){return (CP_GN[a.grade]||99)-(CP_GN[b.grade]||99);});}
function cpDefault(cs){var subs=cpSubjects(cs),s=cpLs('tahdir_subject');if(subs.indexOf(s)<0)s=subs[0];var g=cpGrades(cs,s),last=cpLs('tahdir_cp_'+s);return g.filter(function(c){return c.key===last;})[0]||g[0]||cs[0];}
function cpGradeOpts(gs,key,extra){return gs.map(function(c){return '<option value="'+esc(c.key)+'"'+(c.key===key?' selected':'')+'>الصف '+esc(c.grade)+(extra?extra(c):'')+'</option>';}).join('');}
function coursePick(cs,curKey,id,extra){
  var subs=cpSubjects(cs),cur=cs.filter(function(c){return c.key===curKey;})[0],s=cur?cur.subject:cpDefault(cs).subject;
  return '<div class="cpick"><label class="cp-l"'+(subs.length<2?' hidden':'')+'><span>المادة</span><select id="'+id+'Subj" class="qsel">'+subs.map(function(x){return '<option value="'+esc(x)+'"'+(x===s?' selected':'')+'>'+(CP_ICON[x]||'📘')+' '+esc(x)+'</option>';}).join('')+'</select></label>'+
    '<label class="cp-l"><span>الصف</span><select id="'+id+'" class="qsel">'+cpGradeOpts(cpGrades(cs,s),curKey,extra)+'</select></label></div>';
}
function bindCoursePick(cs,id,onPick,extra){
  var ss=$(id+'Subj'),gs=$(id);if(!ss||!gs)return;
  ss.onchange=function(){var s=this.value;cpLs('tahdir_subject',s);var list=cpGrades(cs,s),last=cpLs('tahdir_cp_'+s),k=list.some(function(c){return c.key===last;})?last:(list[0]&&list[0].key);gs.innerHTML=cpGradeOpts(list,k,extra);if(k)onPick(k);};
  gs.onchange=function(){var v=this.value,c=cs.filter(function(x){return x.key===v;})[0];if(c){cpLs('tahdir_cp_'+c.subject,v);cpLs('tahdir_subject',c.subject);}onPick(v);};
}

// الطباعة المباشرة باسم ملف واضح (اسم PDF = عنوان الصفحة)
function doPrint(name){var a=$('printArea'),t=document.title;document.title=String(name||t).replace(/[\\/:*?"<>|]+/g,'-').slice(0,100);supifyIn(a);a.innerHTML=PR_WRAP(a.innerHTML);document.body.classList.add('printing');setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing');a.innerHTML='';document.title=t;},800);},60);}
// هوامش الصفحة داخل جدول (thead/tfoot تتكرر في كل صفحة) حتى نلغي هوامش المتصفح التي يطبع فيها الرابط والتاريخ
function PR_WRAP(h){return '<table class="prw"><thead><tr><td><div class="prsp"></div></td></tr></thead><tfoot><tr><td><div class="prsp"></div></td></tr></tfoot><tbody><tr><td>'+h+'</td></tr></tbody></table>';}
// الأسس والأيونات: X^2 أو 10^-3 أو Mg^2+ أو ^{...} تُعرض أسًا مرفوعًا
var SUP_RE=/\^\{([^}]{1,14})\}|\^([+\-−]?(?:[0-9]{1,3}|[A-Za-z])[+\-−]?)/g;
function supify(s){return String(s).replace(SUP_RE,function(m,a,b){return '<sup>'+(a||b)+'</sup>';});}
function supifyIn(root){
  if(!root||!root.ownerDocument&&root!==document)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE)$/.test(p.nodeName)||p.isContentEditable&&p.closest&&p.closest('[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;return n.nodeValue.indexOf('^')>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}}),list=[],n;
  while((n=w.nextNode()))list.push(n);
  list.forEach(function(t){SUP_RE.lastIndex=0;if(!SUP_RE.test(t.nodeValue))return;var sp=document.createElement('span');sp.innerHTML=supify(esc(t.nodeValue));var f=document.createDocumentFragment();while(sp.firstChild)f.appendChild(sp.firstChild);t.parentNode.replaceChild(f,t);});
}
try{new MutationObserver(function(ms){ms.forEach(function(m){Array.prototype.forEach.call(m.addedNodes,function(x){if(x.nodeType===1)supifyIn(x);else if(x.nodeType===3&&x.parentNode)supifyIn(x.parentNode);});});}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
document.addEventListener('DOMContentLoaded',function(){supifyIn(document.body);});
// ملء الشاشة: إن لم يدعمه المتصفح/التطبيق نكبّر العنصر داخل النافذة
function toggleFull(el){
  if(el.classList.contains('pseudo-fs')){el.classList.remove('pseudo-fs');document.body.classList.remove('pseudo-fs-on');return;}
  try{if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return;}}catch(e){}
  var fn=el.requestFullscreen||el.webkitRequestFullscreen,done=false;
  if(fn&&!IN_APP){try{var r=fn.call(el);done=true;if(r&&r.catch)r.catch(function(){el.classList.add('pseudo-fs');document.body.classList.add('pseudo-fs-on');});}catch(e){done=false;}}
  if(!done){el.classList.add('pseudo-fs');document.body.classList.add('pseudo-fs-on');}
}
