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
// «زر أداة نور» في شريط الإشارات: يعمل في أي متصفح بدون تثبيت أي إضافة أو إعدادات
var BM_KEY='tahdir_bm_ok';
function bmOk(){try{return localStorage.getItem(BM_KEY)==='1';}catch(e){return false;}}
function bmSet(v){try{if(v)localStorage.setItem(BM_KEY,'1');else localStorage.removeItem(BM_KEY);}catch(e){}}
function bmHtml(){
  var mac=/Mac/.test(navigator.platform||navigator.userAgent);
  return '<div class="bm-box"><h4>✅ الطريقة الأسهل: زر «أداة نور» (بدون تثبيت أي شيء)</h4>'+
    '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em;margin:4px 0">'+
    '<li>لو شريط الإشارات (المفضلة) مش ظاهر تحت شريط العنوان، اضغط <b class="ltr">'+(mac?'⌘ + Shift + B':'Ctrl + Shift + B')+'</b>.</li>'+
    '<li><b>اسحب</b> الزر الأخضر ده بالماوس و<b>أفلته</b> في شريط الإشارات:<div style="text-align:center;margin:8px 0"><a id="bmLink" class="bm-link" href="#" draggable="true">📌 أداة نور</a></div></li>'+
    '<li>اضغط <b>«تم، أضفت الزر»</b> تحت.</li></ol>'+
    '<p class="m-msg small muted" style="margin:0"><b>طريقة الاستخدام:</b> «إرسال التحضير إلى نور» يفتح نور ← اضغط <b>📌 أداة نور</b> في شريط الإشارات ← تفتح صفحة الإضافة للصف ← اضغطه <b>مرة ثانية</b> فتمتلئ الخانات. الزر لا يضغط «حفظ» أبدًا.</p></div>';
}
function bmBind(){
  var a=$('bmLink');if(!a)return;
  a.onclick=function(e){e.preventDefault();toast('اسحب الزر لشريط الإشارات (لا تضغطه هنا)');};
  fetch('/tool/bookmarklet.txt',{cache:'no-cache'}).then(function(r){return r.text();}).then(function(t){if(t.indexOf('javascript:')===0)a.setAttribute('href',t);}).catch(function(){});
}
function toolDialog(reason){
  if(IN_APP)return dialog({title:'أداة نور',message:'أنت تستخدم تطبيق «التحضير الآلي»، والأداة مدمجة فيه وتتحدث تلقائيًا. لا تحتاج تثبيت أي شيء.',okText:'تم',cancelText:false});
  var v=toolVersion(),ok=toolOk()||hasExt();
  var st=ok?'<p class="m-msg" style="color:var(--brand,#0e7c66)"><b>✓ الأداة التلقائية شغالة عندك (الإصدار '+esc(v)+') — الإرسال يملأ نور تلقائيًا.</b></p>':(bmOk()?'<p class="m-msg" style="color:var(--brand,#0e7c66)"><b>✓ أنت تستخدم زر «أداة نور».</b> لو مسحته من شريط الإشارات أضفه من جديد بالخطوات دي.</p>':'');
  var h=(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+st+bmHtml()+
   '<details class="m-msg tm-adv"><summary>الطريقة التلقائية بالكامل (Tampermonkey) — للمتقدمين</summary>'+
   '<ol style="line-height:2;padding-inline-start:1.2em"><li>ثبّت Tampermonkey: <a href="https://addons.mozilla.org/ar/firefox/addon/tampermonkey/" target="_blank" rel="noopener">Firefox</a> · <a href="https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener">Chrome</a> · <a href="https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd" target="_blank" rel="noopener">Edge</a></li>'+
   '<li><a href="'+TOOL_URL+'" target="_blank" rel="noopener">ثبّت الأداة</a> واضغط «تثبيت».</li>'+
   '<li>على Chrome/Edge لازم كمان تفعيل <b>Allow User Scripts</b> (أو Developer mode) لـ Tampermonkey من صفحة الإضافات.</li></ol></details>'+
   '<p class="m-msg small" style="border-top:1px solid #dfe9e5;padding-top:8px"><b>على الموبايل:</b> أندرويد: <a href="'+APK_URL+'" target="_blank" rel="noopener">حمّل تطبيق «التحضير الآلي»</a> — الأداة مدمجة فيه.</p>';
  var pr=dialog({title:'أداة نور',html:h,okText:'تم، أضفت الزر',cancelText:'إغلاق'}).then(function(r){if(r){bmSet(1);toast('تمام ✓ من الآن «إرسال التحضير» يفتح نور، واضغط فيه زر «أداة نور»');var ov=$('modal');if(ov)ov.classList.remove('locked');}});
  bmBind();return pr;
}
// إرسال بزر الإشارات: البيانات تُحمل في رابط نور نفسه (#tahdir=…) ولا تمر على أي خادم
function bmSend(kind,json){
  var o={kind:kind==='hw'?'hw':'prep',data:JSON.parse(json)};
  var b=btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  window.open('https://lms.moe.gov.om/teacher#tahdir='+b,'_blank');
  dialog({title:'افتحت لك نور ✓',html:'<p class="m-msg">في تبويب نور: اضغط زر <b>📌 أداة نور</b> من شريط الإشارات.<br>عندما تفتح صفحة '+(kind==='hw'?'«إضافة مهمة»':'«إضافة تحضير»')+' اضغطه <b>مرة ثانية</b> فتمتلئ الخانات، راجعها ثم احفظ بنفسك.</p><p class="m-msg small muted">لو نور طلب تسجيل الدخول: سجّل دخولك ثم ارجع واضغط «إرسال» مرة أخرى.</p>',okText:'فهمت',cancelText:false});
  return true;
}
// تحديث إجباري: لو الأداة مثبتة بإصدار أقدم من المنشور على الموقع، لا يكمل المعلم حتى يحدّثها
var UPD_KEY='tahdir_tool_upd';
function updState(){try{var o=JSON.parse(localStorage.getItem(UPD_KEY)||'null');return o&&o.to===TOOL_LATEST?o:{to:TOOL_LATEST,n:0};}catch(e){return {to:TOOL_LATEST,n:0};}}
function updSave(o){try{localStorage.setItem(UPD_KEY,JSON.stringify(o));}catch(e){}}
function forceToolUpdate(){
  if(IN_APP||hasExt()||bmOk())return;
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
    '<p class="m-msg" style="border-top:1px solid #dfe9e5;padding-top:8px">أو بدون أي تثبيت: <button type="button" class="link-btn" id="mBm"><b>استخدم زر «أداة نور» في شريط الإشارات</b></button></p>'+
    '<div class="m-actions"><button type="button" class="btn" id="mReload">'+(tried?'تم':'تم التحديث')+'</button><button type="button" class="btn primary" id="mOk">'+(tried?'تثبيت الأداة من جديد':'تحديث الأداة الآن')+'</button></div>';
  ov.hidden=false;ov.classList.add('locked');ov.onclick=null;
  $('mOk').onclick=function(){var o=updState();o.n=(o.n||0)+1;updSave(o);window.open(TOOL_URL,'_blank');$('mReload').classList.add('primary');};
  $('mReload').onclick=function(){location.reload();};
  if($('mBm'))$('mBm').onclick=function(){ov.classList.remove('locked');ov.hidden=true;box.innerHTML='';toolDialog('');};
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
