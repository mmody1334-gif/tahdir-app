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
var TOOL_URL='/tool/tahdir-noor.user.js',TOOL_LATEST='__TOOLVER__',IN_APP=/TahdirApp/.test(navigator.userAgent),APK_URL='/download/tahdir.apk';
function verCmp(a,b){a=String(a||'').split('.');b=String(b||'').split('.');for(var i=0;i<3;i++){var d=(parseInt(a[i],10)||0)-(parseInt(b[i],10)||0);if(d)return d;}return 0;}
function toolVersion(){return document.documentElement.getAttribute('data-tahdir-tool')||'';}
// إضافة المتصفح الرسمية (Chrome / Edge): تتحدث من المتجر تلقائيًا ولا تحتاج أي إعداد
var EXT_STORE={chrome:'',edge:''};
function hasExt(){return !!document.documentElement.getAttribute('data-tahdir-ext');}
function browserKind(){var u=navigator.userAgent;return /Edg\//.test(u)?'edge':(/Firefox/.test(u)?'firefox':(/Chrome/.test(u)?'chrome':''));}
function extUrl(){return EXT_STORE[browserKind()]||'';}
function toolOk(min){var v=toolVersion();return !!v&&verCmp(v,min||TOOL_LATEST)>=0;}
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
   (/Chrome|Edg\//.test(navigator.userAgent)&&!/Firefox/.test(navigator.userAgent)?
   '<div class="m-msg" style="background:#fff8e6;border:1px solid #f2c66d;border-radius:10px;padding:8px 12px"><b>على '+(/Edg\//.test(navigator.userAgent)?'Edge':'Chrome')+': لو ثبّتّ الأداة ومازالت لا تعمل</b> فالمتصفح يمنع السكربتات حتى تسمح بها مرة واحدة:<br>'+
   (/Edg\//.test(navigator.userAgent)?'افتح <b class="ltr">edge://extensions</b> وفعّل <b>«وضع المطور» Developer mode</b> (أسفل يسار الصفحة)، ثم ادخل <b>تفاصيل</b> Tampermonkey وفعّل <b>«السماح بالبرامج النصية للمستخدم» Allow User Scripts</b> إن ظهر.':
   'افتح <b class="ltr">chrome://extensions</b> ← Tampermonkey ← <b>التفاصيل Details</b> ← فعّل <b>«السماح بالنصوص البرمجية للمستخدم» Allow User Scripts</b>. (في إصدارات Chrome الأقدم: فعّل <b>«وضع مطوّر البرامج» Developer mode</b> أعلى يمين الصفحة.)')+
   '<br>بعدها حدّث هذه الصفحة.</div>':'')+
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
      '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em"><li>اضغط أيقونة <b>Tampermonkey</b> بجانب شريط العنوان ← <b>«لوحة التحكم» / Dashboard</b>.</li><li>احذف <b>كل</b> سكربت اسمه «لصق التحضير والواجب - نور» أو فيه «التحضير الآلي» (أيقونة سلة المهملات).</li><li>ارجع هنا واضغط <b>«تثبيت الأداة من جديد»</b> ثم <b>Install / تثبيت</b>.</li><li>اضغط <b>«تم»</b> هنا.</li></ol>'+(/Chrome|Edg\//.test(navigator.userAgent)&&!/Firefox/.test(navigator.userAgent)?'<p class="m-msg">على Chrome/Edge تأكد كمان إن <b>Allow User Scripts</b> (أو Developer mode) مفعّل لإضافة Tampermonkey من صفحة الإضافات.</p>':''):
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
