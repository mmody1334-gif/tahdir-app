function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
var toastTimer=null;
function toast(msg){var t=$('toast');if(!t)return;t.textContent=msg||'تم';t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove('on');},1800);}
// رمز الجلسة الاحتياطي: بعض المتصفحات (متصفح واتساب/إنستقرام المدمج، أو إعداد
// «حجب كوكيز الطرف الأول») ترفض كوكي الجلسة، فيعود المعلم لصفحة الدخول بعد كل
// محاولة ويُسجَّل جهاز جديد كل مرة. فصار الخادم يرسل الرمز في جسم الاستجابة
// أيضًا، ويُحفظ هنا ويُرسَل في ترويسة — فتعمل الجلسة بلا كوكيز.
var SID_KEY='tahdir_sid_v1',DID_KEY='tahdir_did_v1';
function didGet(){try{return localStorage.getItem(DID_KEY)||'';}catch(e){return '';}}
function didSet(v){try{if(v)localStorage.setItem(DID_KEY,v);else localStorage.removeItem(DID_KEY);}catch(e){}}
function sidGet(){try{return localStorage.getItem(SID_KEY)||'';}catch(e){return '';}}
function sidSet(v){try{if(v)localStorage.setItem(SID_KEY,v);else localStorage.removeItem(SID_KEY);}catch(e){}}
function api(path,data,method){
  var o={method:method||(data?'POST':'GET'),credentials:'same-origin',headers:{}};
  if(data){o.headers['Content-Type']='application/json';o.body=JSON.stringify(data);}
  var sid=sidGet(),did=didGet();
  if(path!=='/api/login'){if(sid)o.headers['X-Tahdir-Sid']=sid;if(did)o.headers['X-Tahdir-Did']=did;}
  else if(did){o.headers['X-Tahdir-Did']=did;}
  return fetch(path,o).then(function(r){
    if(r.status===401&&path!=='/api/login'){
      // الرمز الاحتياطي لم يعد صالحًا: نمسحه ونعيد للدخول
      sidSet('');
      location.href='/';return Promise.reject(new Error('انتهت الجلسة'));
    }
    return r.json().catch(function(){return {};}).then(function(j){
      if(!r.ok)throw new Error(j.error||'حدث خطأ');
      if(j&&j.sid)sidSet(j.sid);
      if(j&&j.did)didSet(j.did);
      return j;
    });
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
var DIALOG=null; // النافذة المفتوحة حاليًا: نستطيع إغلاقها برمجيًا فيصل الوعد ولا يتسرّب مستمع لوحة المفاتيح
function closeDialog(v){
  if(!DIALOG)return false;
  var d=DIALOG;DIALOG=null;
  d.close(v);
  return true;
}
function dialog(opts){
  return new Promise(function(resolve){
    var ov=$('modal'),box=$('modalBox');
    if(ov.classList.contains('locked')){resolve(null);return;}
    if(DIALOG)closeDialog(null); // لا نترك نافذة سابقة معلّقة
    var h='<h3 id="mTitle">'+esc(opts.title)+'</h3>';
    if(opts.message)h+='<p class="m-msg">'+esc(opts.message)+'</p>';
    if(opts.html)h+=opts.html;
    if(opts.input)h+='<input id="mInput" class="m-input" value="'+esc(opts.value||'')+'" placeholder="'+esc(opts.placeholder||'')+'">';
    if(opts.textarea)h+='<textarea id="mText" class="m-text'+(opts.ltr?' ltr':'')+'"'+(opts.readonly?' readonly':'')+' placeholder="'+esc(opts.placeholder||'')+'">'+esc(opts.value||'')+'</textarea>';
    h+='<div class="m-actions">';
    if(opts.cancelText!==false)h+='<button type="button" class="btn" id="mCancel">'+esc(opts.cancelText||'إلغاء')+'</button>';
    h+='<button type="button" class="btn '+(opts.danger?'danger-solid':'primary')+'" id="mOk">'+esc(opts.okText||'موافق')+'</button></div>';
    box.innerHTML=h;ov.hidden=false;
    if(opts.wide)box.classList.add('wide');else box.classList.remove('wide');
    var inp=$('mInput')||$('mText');if(inp&&!opts.readonly)setTimeout(function(){inp.focus();},30);
    var settled=false;
    function close(v){
      if(settled)return;settled=true;
      // opts.extra نُقرأ قبل مسح النافذة، ويستبدل القيمة المرجعة (مفيد لعناصر تُبنى داخل html)
      if(opts.extra){var ex=opts.extra(box);if(ex!==undefined)v=ex;}
      ov.hidden=true;box.innerHTML='';document.removeEventListener('keydown',onKey);ov.onclick=null;
      if(DIALOG&&DIALOG.close===close)DIALOG=null;
      resolve(v);
    }
    // opts.group: نجمع قيم العناصر المختارة بهذا الاسم (اختيار متعدد أو راديو) ونُرجعها مصفوفة
    // opts.extra: دالة تُقرأ قبل إغلاق النافذة، ويُدمج ناتجها (كائن) مع قيمة الحقل
    function val(){if($('mInput'))return $('mInput').value;if($('mText'))return $('mText').value;if(opts.group)return Array.prototype.map.call(box.querySelectorAll('[name="'+opts.group+'"]:checked'),function(x){return x.value;});return true;}
    function onKey(e){if(e.key==='Escape')close(null);if(e.key==='Enter'&&$('mInput')&&document.activeElement===$('mInput'))close(val());}
    DIALOG={close:close,settle:function(){settled=true;}};
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
function logout(){api('/api/logout',{}).then(function(){sidSet('');didSet('');location.href='/';},function(){sidSet('');didSet('');location.href='/';});}
function fmtDate(t){if(!t)return '—';var d=new Date(t);return d.toLocaleDateString('ar-OM',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('ar-OM',{hour:'2-digit',minute:'2-digit'});}
function ago(t){if(!t)return 'لم يدخل بعد';var s=(Date.now()-t)/1000;if(s<60)return 'الآن';if(s<3600)return 'منذ '+Math.floor(s/60)+' دقيقة';if(s<86400)return 'منذ '+Math.floor(s/3600)+' ساعة';var d=Math.floor(s/86400);return d===1?'أمس':'منذ '+d+' يوم';}
// ---------- أداة نور (مشتركة لكل الصفحات) ----------
var TOOL_URL='/tool/tahdir-noor.user.js',TOOL_LATEST='__TOOLVER__',TOOL_FORCE='__TOOLFORCE__',IN_APP=/TahdirApp/.test(navigator.userAgent),APK_URL='/download/tahdir.apk';
function verCmp(a,b){a=String(a||'').split('.');b=String(b||'').split('.');for(var i=0;i<3;i++){var d=(parseInt(a[i],10)||0)-(parseInt(b[i],10)||0);if(d)return d;}return 0;}
function toolVersion(){return document.documentElement.getAttribute('data-tahdir-tool')||'';}
// إضافة المتصفح الرسمية: مسار تجريبي غير مفعّل. عند تعبئة الروابط يعمل تلقائيًا،
// وبدونها المسار الوحيد هو Tampermonkey (أبسط للمعلم: إضافة + سكربت وخلاص).
var EXT_STORE={chrome:'',edge:''};
function hasExt(){return !!document.documentElement.getAttribute('data-tahdir-ext');}
function browserKind(){var u=navigator.userAgent;
     if(/Edg\//.test(u))return 'edge';
     if(/Firefox|FxiOS/.test(u))return 'firefox';
     if(/Chrome|CriOS/.test(u))return 'chrome';
     // سافاري: لا يحتوي Chrome/Edg/Firefox — نتحقق من Safari أو جهاز ماك
     if(/Safari/.test(u)||/Macintosh/.test(u))return 'safari';
     return '';}
function extUrl(){return EXT_STORE[browserKind()]||'';}
function toolOk(min){var v=toolVersion();return !!v&&verCmp(v,min||TOOL_FORCE)>=0;}
// مسار واحد بسيط: Tampermonkey فقط. الإضافة الرسمية تُذكر فقط لو فُعّلت روابطها.
var BROWSER_NAME={chrome:'Chrome',edge:'Edge',firefox:'Firefox',safari:'Safari'};
function tmStoreUrl(){var b=browserKind();
  if(b==='firefox')return 'https://addons.mozilla.org/ar/firefox/addon/tampermonkey/';
  if(b==='edge')return 'https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd';
  // سافاري: Tampermonkey من Mac App Store (مدفوعة رمزية) — نسخة «Legacy» لا تعمل على سافاري الحديث
  if(b==='safari')return 'https://apps.apple.com/app/tampermonkey/id1482490089';
  return 'https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo';}
function tmStoreName(){return (BROWSER_NAME[browserKind()]||'متصفحك');}
// روابط متجر كل متصفح (للتبويبات)
function tmStoreFor(b){
  if(b==='firefox')return 'https://addons.mozilla.org/ar/firefox/addon/tampermonkey/';
  if(b==='edge')return 'https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd';
  if(b==='safari')return 'https://apps.apple.com/app/tampermonkey/id1482490089';
  return 'https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo';}
function toolDialog(reason){
  if(IN_APP)return dialog({title:'أداة نور',message:'أنت تستخدم تطبيق «الكبسولة»، والأداة مدمجة فيه وتتحدث تلقائيًا. لا تحتاج تثبيت أي شيء.',okText:'تم',cancelText:false});
  var v=toolVersion(),ok=!!v,eu=extUrl();
  // مسار الإضافة الرسمية (لو فُعّلت لاحقًا): خطوة واحدة
  if(eu&&!hasExt()){
    var bn=tmStoreName();
    return dialog({title:'أداة نور',html:(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+'<p class="m-msg"><b>خطوة واحدة:</b> اضغط الزر، وفي صفحة المتجر اضغط <b>«إضافة إلى '+bn+'»</b>. بعدها ارجع وحدّث الصفحة.</p>',okText:'تثبيت الإضافة',cancelText:'إغلاق'}).then(function(r){if(r)window.open(eu,'_blank');});
  }
  if(ok)return dialog({title:'أداة نور ✓',message:'الأداة مثبتة وتعمل (الإصدار '+v+'). تقدر ترسل التحضير والواجب إلى نور بضغطة.',okText:'تم',cancelText:false});
  // التثبيت لأول مرة: تبويبات بحسب المتصفح (كروم · فايرفوكس · إيدج · ماك/سافاري)
  var cur=browserKind()||'chrome';
  var TABS=[['chrome','Chrome','🌐'],['firefox','Firefox','🦊'],['edge','Edge','🌊'],['safari','ماك / Safari','🧭'],['ios','iPhone','📱']];
  function stepsFor(b){
    if(b==='ios'){
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت <b>Userscripts</b> — <b>مجاني ومفتوح المصدر</b>: <a href="https://apps.apple.com/app/userscripts/id1463298887" target="_blank" rel="noopener">افتح App Store</a>. (يحتاج iOS 15.1 فأحدث)</li>'+
        '<li><b>الإعدادات ← سافاري ← الإضافات</b> ← فعّل <b>Userscripts</b>، ثم اسمح له بالوصول إلى <b>lms.moe.gov.om</b> و <b>هذا الموقع</b>.</li>'+
        '<li>افتح رابط الأداة في سافاري (<b>/tool/tahdir-noor.user.js</b>) ← اضغط أيقونة الإضافة في شريط العنوان ← <b>Install</b>.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>⚠️ لو ظهرت لك الأداة كـ«كود نصّي» أو نزلت في تطبيق «الملفات» بلا زر Install</b> — فهذا معناه أن <b>Userscripts غير مثبّت أو غير مفعّل في سافاري</b>، وليس عيبًا في الأداة. أكمل الخطوتين 1 و2 ثم أعد فتح الرابط.<br><span class="muted small">وإن كان الملف نزل بالفعل في «الملفات»: افتح تطبيق Userscripts ← «Set Directory» ← ضع مجلد التنزيلات، ثم انقل الملف <code>tahdir-noor.user.js</code> إليه — سيُحمَّل تلقائيًّا.</span></p>'+
        '<p class="m-msg" style="background:var(--main-l,#e3f1eb);border-radius:10px;padding:8px 11px"><b>لماذا يعمل مجانًا؟</b> أضفنا في الأداة طبقة توافق تُكمل واجهات التخزين عبر <code>localStorage</code> — فتعمل مع <b>Userscripts</b> المجاني كما تعمل مع Tampermonkey. <b>لا حاجة للدفع.</b> (من يفضّل Tampermonkey: ~$1.99 مرة واحدة، اختياري).</p>';
    }
    if(b==='safari'){
      return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
        '<li>ثبّت <b>Userscripts</b> — <b>مجاني</b>: <a href="https://apps.apple.com/app/userscripts/id1463298887" target="_blank" rel="noopener">افتح App Store</a> (macOS 12+ · سافاري 14.1+).<br><span class="muted small">أو <b>Tampermonkey</b> من Mac App Store (~$1.99) — <a href="'+tmStoreFor('safari')+'" target="_blank" rel="noopener">صفحة التطبيق</a>.</span></li>'+
        '<li><b>سافاري ← الإعدادات (⌘,) ← الإضافات</b> ← فعّل الإضافة.</li>'+
        '<li><b>الإعدادات ← المواقع الإلكترونية</b> ← اسمح بالوصول إلى <b>lms.moe.gov.om</b> و <b>هذا الموقع</b>.</li>'+
        '<li>ارجع واضغط <b>«تثبيت الأداة»</b>، وفي الصفحة التي تُفتح اضغط <b>«تثبيت»</b> ثم <b>Allow</b> إن سألك سافاري.</li></ol>'+
        '<p class="m-msg" style="background:#fff6e0;border-radius:10px;padding:8px 11px"><b>⚠️ تنبيه:</b> لا تستخدم <b>«Tampermonkey Legacy»</b> — فهي لسافاري 6–11 فقط ولن تُثبَّت على سافاري الحديث.</p>';
    }
    var nm=b==='firefox'?'Firefox':(b==='edge'?'Edge':'Chrome');
    return '<ol class="m-msg" style="line-height:2;padding-inline-start:1.2em">'+
      '<li>ثبّت <b>Tampermonkey</b> من متجر '+nm+': <a href="'+tmStoreFor(b)+'" target="_blank" rel="noopener">افتح صفحة الإضافة</a> ثم اضغط «إضافة إلى '+nm+'».</li>'+
      '<li>ارجع هنا، اضغط الزر الأخضر <b>«تثبيت الأداة»</b>، وفي الصفحة التي تُفتح اضغط <b>«تثبيت»</b>.</li></ol>';
  }
  var tabbar='<div class="tt-tabs">'+TABS.map(function(t){
    return '<button type="button" class="tt-tab'+(t[0]===cur?' on':'')+'" data-tab="'+t[0]+'">'+t[2]+' '+esc(t[1])+'</button>';
  }).join('')+'</div>';
  var panes=TABS.map(function(t){
    return '<div class="tt-pane'+(t[0]===cur?' on':'')+'" data-pane="'+t[0]+'">'+stepsFor(t[0])+'</div>';
  }).join('');
  // على أندرويد: متصفحات الجوال لا تدعم إضافات السكربتات (Chrome · Samsung Internet)،
  // فملف .user.js يُحمَّل كنص ولا يظهر زر «تثبيت». الحل الأسهل هو التطبيق (الأداة مدمجة).
  var isAndroid=/Android/i.test(navigator.userAgent);
  var andNote=isAndroid
    ? '<div class="m-msg" style="background:var(--main-l,#e3f1eb);border:1px solid var(--main,#1f8a70);border-radius:12px;padding:11px 13px">'+
      '<b>📱 أنت على أندرويد — لا تحتاج تثبيت سكربت.</b><br>'+
      'تطبيق «الكبسولة» فيه الأداة <b>مدمجة</b> ويعمل مباشرة: <a class="btn primary small" href="'+APK_URL+'" target="_blank" rel="noopener" style="margin-top:6px;display:inline-block">⬇ تحميل التطبيق</a>'+
      '<div class="muted small" style="margin-top:7px">متصفحات أندرويد (Chrome · Samsung Internet) <b>لا تدعم إضافات السكربتات</b>، ولهذا عند فتح رابط الأداة تظهر لك <b>كنص فقط</b> ولا يظهر «تثبيت». ولو أردت السكربت على الجوال: استخدم <b>Firefox للأندرويد</b> + Tampermonkey.</div></div>'
    : '';
  var h=(reason?'<p class="m-msg">'+esc(reason)+'</p>':'')+
   andNote+
   '<p class="m-msg">اختر متصفحك ثم اتبع الخطوتين:</p>'+
   tabbar+panes+
   '<p class="m-msg muted small">هذا كل شيء — مرة واحدة للأبد. بعدها تتحدث الأداة تلقائيًا من الموقع.</p>'+
   '<p class="m-msg" style="border-top:1px solid #dfe9e5;padding-top:10px"><b>على الموبايل:</b><br>أندرويد: <a href="'+APK_URL+'" target="_blank" rel="noopener">حمّل تطبيق «الكبسولة»</a> — الأداة مدمجة فيه.<br>آيفون: ثبّت <b>Userscripts</b> (مجاني) ثم افتح رابط الأداة واضغط Install.</p>';
  var pr=dialog({title:'تثبيت أداة نور',html:h,okText:'تثبيت الأداة',cancelText:'إغلاق'});
  // ربط التبويبات داخل النافذة (بعد إدراجها في DOM)
  Array.prototype.forEach.call(document.querySelectorAll('.tt-tab'),function(b){
    b.onclick=function(){
      var k=b.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tt-tab'),function(x){x.classList.toggle('on',x===b);});
      Array.prototype.forEach.call(document.querySelectorAll('.tt-pane'),function(x){x.classList.toggle('on',x.getAttribute('data-pane')===k);});
    };
  });
  return pr.then(function(r){if(r)window.open(TOOL_URL,'_blank');});
}
// تنبيه غير حاجب: نُخبر المعلم أن هناك إصدارًا أحدث، ولا نمنعه من العمل.
// (الحجب كان يسبب تعطّلًا كاملًا لو تعذّر قراءة الإصدار لأي سبب.)
var UPD_KEY='tahdir_tool_upd';
function updState(){try{var o=JSON.parse(localStorage.getItem(UPD_KEY)||'null');return o&&o.to===TOOL_LATEST?o:{to:TOOL_LATEST,n:0};}catch(e){return {to:TOOL_LATEST,n:0};}}
function updSave(o){try{localStorage.setItem(UPD_KEY,JSON.stringify(o));}catch(e){}}
function toolUpdateNote(){
  if(IN_APP||hasExt())return;
  var v=toolVersion(),ov=$('modal');
  if(!v){ updSave({to:TOOL_LATEST,n:0}); return; }         // غير مثبتة: لا نُزعج في كل صفحة
  if(verCmp(v,TOOL_LATEST)>=0){ updSave({to:TOOL_LATEST,n:0,done:1}); return; }
  var st=updState();
  if(st.n>0)return;                                        // نبّهنا مرة واحدة لهذا الإصدار
  updSave({to:TOOL_LATEST,n:1});
  if(ov&&!ov.hidden)return;
  dialog({title:'تحديث أداة نور',message:'عندك الإصدار '+v+' والأحدث '+TOOL_LATEST+'. التحديث مستحسن لكنه غير إلزامي — تقدر تكمل عادي.',okText:'تحديث الآن',cancelText:'لاحقًا'})
    .then(function(r){if(r)window.open(TOOL_URL,'_blank');});
}
// نُبقي مراقبة الإصدار لتحديث زر «أداة نور» في الشريط، والإعلان يتولّى التنبيه للمعلم.
function watchTool(){
  if(IN_APP)return;
  var t=null;try{new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){var v=toolVersion();if((v||hasExt())&&$('toolBtn')){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},400);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-tahdir-tool','data-tahdir-ext']});}catch(e){}
  setTimeout(function(){var v=toolVersion();if((v||hasExt())&&$('toolBtn')){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},2500);
}
// ---------- إعلان من السيرفر ----------
// يظهر مرة واحدة لكل معلم (لكل معرّف إعلان)، ويعمل حتى لو كانت الأداة معطّلة تمامًا
// فلا تضبط سمة الإصدار. يُدار من site/data/announcements.json.
var ANNOUNCE=__ANNOUNCE__||{};
var ANN_KEY='tahdir_ann_seen';
function annSeen(){try{return JSON.parse(localStorage.getItem(ANN_KEY)||'[]')||[];}catch(e){return [];}}
function annMark(id){try{var a=annSeen();if(a.indexOf(id)<0){a.push(id);localStorage.setItem(ANN_KEY,JSON.stringify(a.slice(-20)));}}catch(e){}}
function showAnnouncement(){
  var a=ANNOUNCE.toolUpdate;
  if(!a||!a.id||!a.body)return;
  if(navigator.webdriver)return;
  var ov=$('modal');if(!ov)return;                       // صفحات الدخول بلا نافذة: لا إعلان
  if(ov.classList.contains('locked')||!ov.hidden)return;  // لا نقاطع نافذة مفتوحة
  if(annSeen().indexOf(a.id)>=0)return;
  // لو الأداة محدّثة فعلًا فلا داعي للإعلان
  var v=toolVersion();
  if(v&&verCmp(v,TOOL_LATEST)>=0){annMark(a.id);return;}
  // لا نُسجّله كمقروء الآن: لو كانت هناك نافذة مفتوحة نؤجّل ونعرضه في زيارة تالية،
  // وإلا ضاع الإعلان بلا أن يراه المعلم.
  setTimeout(function(){
    if(ov.classList.contains('locked')||!ov.hidden)return;
    annMark(a.id);
    dialog({title:a.title||'إعلان',message:a.body,okText:a.okText||'حسنًا',cancelText:a.cancelText||'لاحقًا'})
      .then(function(r){if(r)window.open(a.url||TOOL_URL,'_blank');});
  },900);
}
// ---------- شريط التنقل: الأساسي ظاهر والباقي في قائمة ----------
function initNav(me){
  // «أول دخول» يأتي من الخادم (عدد أحداث الدخول لهذا الحساب ≤ 1)، لا من تخزين
  // المتصفح — فمن له زيارات سابقة لا يظهر له دليل الاستخدام تلقائيًّا ولو مسح
  // تخزينه، ومن يدخل أول مرة يراه مرة واحدة.
  window.IS_FIRST=!!(me&&me.first);
  var mb=$('menuBtn'),ml=$('menuList');
  if(mb&&ml){
    var close=function(){ml.hidden=true;mb.setAttribute('aria-expanded','false');};
    var place=function(){if(window.innerWidth<=700){ml.style.top=ml.style.left='';return;}var r=mb.getBoundingClientRect();ml.style.top=(r.bottom+8)+'px';ml.style.left=Math.max(8,Math.min(r.left,window.innerWidth-ml.offsetWidth-8))+'px';};
    mb.onclick=function(e){e.stopPropagation();var o=ml.hidden;ml.hidden=!o;mb.setAttribute('aria-expanded',o?'true':'false');if(o)place();};
    window.addEventListener('resize',function(){if(!ml.hidden)place();});window.addEventListener('scroll',function(){if(!ml.hidden)close();},{passive:true});
    document.addEventListener('click',function(e){if(!ml.hidden&&(!ml.contains(e.target)||(e.target.closest&&e.target.closest('button,a'))))close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  if($('logoutBtn'))$('logoutBtn').onclick=logout;
  if($('tourBtn'))$('tourBtn').onclick=function(){var o=$('tourOv');if(o)return;tourStart();};
  if($('toolBtn')){
    if(IN_APP)$('toolBtn').hidden=true;
    else{$('toolBtn').onclick=function(){toolDialog('');};setTimeout(function(){if(toolVersion()||hasExt()){$('toolBtn').classList.remove('pulse');$('toolBtn').textContent='أداة نور ✓';}},1500);}
  }
  if(me&&me.role==='admin')Array.prototype.forEach.call(document.querySelectorAll('.admin-only'),function(x){x.hidden=false;});
  if(me&&$('who'))$('who').textContent=me.name;
  watchTool();
  showAnnouncement();
}
// اختيار الصف: المادة أولًا (قائمة منبثقة) ثم صفوفها مرتّبة
var CP_ICON={'العلوم':'🔬','الأحياء':'🧬','الكيمياء':'⚗️','الفيزياء':'🧲','العلوم البيئية':'🌍','اللغة الإنجليزية':'🔤','اللغة العربية':'📖','الرياضيات':'➗','الدراسات الاجتماعية':'🗺️','تقنية المعلومات':'💻','التربية الإسلامية':'🕌'};
var CP_ORDER=['العلوم','الأحياء','الكيمياء','الفيزياء','العلوم البيئية','الرياضيات','اللغة العربية','اللغة الإنجليزية','الدراسات الاجتماعية','التربية الإسلامية','تقنية المعلومات'];
var CP_GN={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6,'السابع':7,'الثامن':8,'التاسع':9,'العاشر':10,'الحادي عشر':11,'الثاني عشر':12};
// بعض الملفات تكتب الصف «الصف التاسع» وبعضها «التاسع»؛ كل العناوين تضيف «الصف » بنفسها
function gLabel(g){return String(g==null?'':g).replace(/^الصف\s+/,'').trim();}
function cpLs(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}return null;}
function cpSubjects(cs){var s={};cs.forEach(function(c){s[c.subject]=1;});return Object.keys(s).sort(function(a,b){var x=CP_ORDER.indexOf(a),y=CP_ORDER.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b,'ar');});}
function cpGrades(cs,s){return cs.filter(function(c){return c.subject===s;}).sort(function(a,b){return (CP_GN[a.grade]||99)-(CP_GN[b.grade]||99);});}
function cpDefault(cs){var subs=cpSubjects(cs),s=cpLs('tahdir_subject');if(subs.indexOf(s)<0)s=subs[0];var g=cpGrades(cs,s),last=cpLs('tahdir_cp_'+s);return g.filter(function(c){return c.key===last;})[0]||g[0]||cs[0];}
function cpGradeOpts(gs,key,extra){return gs.map(function(c){return '<option value="'+esc(c.key)+'"'+(c.key===key?' selected':'')+'>الصف '+esc(gLabel(c.grade))+(extra?extra(c):'')+'</option>';}).join('');}
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
// ---------- دليل الاستخدام: جولة مصوّرة بأسهم لأول دخول ----------
// تُخزَّن مرة واحدة في localStorage، وتُعاد من زر «دليل الاستخدام» في الشريط.
// كل خطوة تُظلّل عنصرًا (spotlight) وتُظهر فقاعة بجانبه مع سهم يشير إليه.
var TOUR_KEY='tahdir_tour_v1',tourEls=null,tourI=0,tourList=[],tourObs=null;
function tourPage(){var p=location.pathname;return p==='/app'?'app':p==='/quiz'?'quiz':p==='/finals'?'finals':p==='/games'?'games':p==='/remedial'?'remedial':p==='/summaries'?'summaries':'other';}
function tourSteps(){
  var pg=tourPage();
  if(pg==='app')return [
    {sel:null,title:'أهلًا بك في «الكبسولة» 💊',text:'خطوتان تفصلانك عن تحضير جاهز يُرسل إلى نور بضغطة: ثبّت أداة نور (مرة واحدة)، ثم اختر صفّك. تقدر تعيد هذا الدليل في أي وقت من زر «دليل الاستخدام» أعلى الصفحة.'},
    {sel:'#toolBtn',step:'tool',title:'١) ثبّت «أداة نور» — مرة واحدة فقط',text:'هذه هي الخطوة الأولى والأهم: هي التي تُرسل التحضير والواجب إلى نور وتصحّح الواجبات تلقائيًا. اضغط الزر ثم «إضافة إلى Chrome». (في تطبيق الكبسولة الأداة مدمجة — لا تحتاج تثبيت شيء.)',cta:'كيف أثبّتها؟'},
    {sel:'#subjSel',title:'٢) اختر المادة',text:'بعد تثبيت الأداة: القائمة الأولى للمواد المتاحة لك، والثانية للصفوف. تظهر لك المواد التي سمح بها المدير فقط.'},
    {sel:'.g-btn',title:'٣) اختر الصف',text:'اضغط الصف ليفتح، ثم اختر الوحدة، ثم الدرس. كل درس مقسّم بنفس خانات نموذج «إضافة تحضير» في نور.'},
    {sel:'#sendPrepBtn',title:'٤) أرسل التحضير إلى نور',text:'اضغط «إرسال التحضير إلى نور» ونور مفتوحة: تُفتح «إضافة تحضير» للصف ويُختار الدرس وتُملأ الأركان. يبقى لك التاريخ وزر «إضافة».'},
    {sel:null,title:'كل شيء جاهز ✓',text:'تقدر تعيد هذا الدليل من زر «دليل الاستخدام»، وتجده أيضًا في صفحة «أداة نور».'}
  ];
  if(pg==='quiz')return [
    {sel:null,title:'التقويم والاختبارات',text:'تُبنى الورقة آليًّا من بنك أسئلة الوزارة وفق وثيقة التقويم لصفّك.'},
    {sel:'#courseSel',title:'١) اختر الصف',text:'ثم علّم الدروس المطلوبة من الشجرة.'},
    {sel:'#makeBtn',title:'٢) كوّن الورقة',text:'اضغط «كوّن الاختبار» فتظهر الورقة بالدرجات والتوزيع.'},
    {sel:null,title:'جاهز ✓',text:'تقدر تطبعها أو تنزّلها Word من الأزرار أعلى الورقة.'}
  ];
  if(pg==='finals')return [
    {sel:null,title:'الاختبارات النهائية',text:'أسئلة الوزارة للأعوام السابقة، مقصوصة كما وردت مع الإجابات.'},
    {sel:'#courseSel',title:'١) اختر المقرر',text:'ثم اختر الوحدة من الشريط الجانبي.'},
    {sel:null,title:'جاهز ✓',text:'فعّل «إظهار الإجابات» للمراجعة، أو اطبع المختار من الشريط.'}
  ];
  return [{sel:null,title:'دليل الاستخدام',text:'تنقّل بين الصفحات من القائمة أعلى الشاشة: التحضير · التقويم · الألعاب · النهائيات.'}];
}
function tourRender(){
  var s=tourList[tourI];if(!s)return tourClose();
  var ov=$('tourOv'),spot=$('tourSpot'),tip=$('tourTip');if(!ov)return;
  var t=null;if(s.sel){try{var all=document.querySelectorAll(s.sel);for(var i=0;i<all.length;i++){var r=all[i].getBoundingClientRect();if(r.width>4&&r.height>4&&r.bottom>0&&r.top<innerHeight){t=all[i];break;}}}catch(e){}}
  if(!t&&s.sel){ // العنصر غير موجود في هذه الصفحة → نتخطّاه
    if(tourI<tourList.length-1){tourI++;return tourRender();}
    return tourClose();
  }
  if(t){
    var b=t.getBoundingClientRect(),pad=6;
    spot.hidden=false;
    spot.style.left=(b.left-pad)+'px';spot.style.top=(b.top-pad)+'px';
    spot.style.width=(b.width+pad*2)+'px';spot.style.height=(b.height+pad*2)+'px';
    t.scrollIntoView({block:'center',behavior:'smooth'});
  }else spot.hidden=true;
  tip.className='tour-tip'+(t?'':' center');
  // خطوة الأداة تتغيّر إن كانت مثبتة أصلًا (أو كنا داخل التطبيق حيث الأداة مدمجة)
  var tt=s.title,tb=s.text,cta=s.cta;
  if(s.step==='tool'){
    var inst=IN_APP||!!toolVersion()||hasExt();
    if(inst){
      tt='١) أداة نور جاهزة ✓';
      tb=IN_APP?'أنت داخل تطبيق «الكبسولة»، والأداة مدمجة فيه وتتحدّث تلقائيًا — لا تحتاج تثبيت أي شيء. تابع للخطوة التالية.'
        :'الأداة مثبتة وتعمل على متصفحك ✓ — تقدر ترسل التحضير والواجب إلى نور وتصحّح الواجبات بضغطة. تابع للخطوة التالية.';
      cta='';
    }
  }
  var h='<div class="tour-h">'+esc(tt)+'</div><div class="tour-b">'+esc(tb)+'</div><div class="tour-f">'+
    '<span class="tour-n">'+(tourI+1)+' / '+tourList.length+'</span>'+
    (cta?'<button type="button" class="btn small" id="tourCta">'+esc(cta)+'</button>':'')+
    '<button type="button" class="btn small" id="tourSkip">تخطّي</button>'+
    (tourI>0?'<button type="button" class="btn small" id="tourPrev">السابق</button>':'')+
    '<button type="button" class="btn primary small" id="tourNext">'+(tourI===tourList.length-1?'تم':'التالي')+'</button></div>';
  tip.innerHTML=h;
  if(t){
    var r=t.getBoundingClientRect(),tw=Math.min(330,innerWidth-24),th=tip.offsetHeight||150;
    var left=Math.max(12,Math.min(innerWidth-tw-12,r.left+r.width/2-tw/2));
    var below=r.bottom+14,above=r.top-th-14;
    var top=(below+th<innerHeight-12)?below:Math.max(12,above);
    tip.style.left=left+'px';tip.style.top=top+'px';
    tip.className='tour-tip'+(top<r.top?' up':' down');
    // السهم يصوّب على **مركز العنصر** المُظلَّل، لا على حافة الفقاعة
    var cx=r.left+r.width/2-left;
    cx=Math.max(22,Math.min(tw-22,cx));
    tip.style.setProperty('--ax',cx+'px');
  }else{
    tip.style.left='50%';tip.style.top='50%';
    tip.style.transform='translate(-50%,-50%)';
  }
  if(t)tip.style.transform='';
  if($('tourNext'))$('tourNext').onclick=function(){if(tourI>=tourList.length-1)return tourClose();tourI++;tourRender();};
  if($('tourPrev'))$('tourPrev').onclick=function(){if(tourI>0)tourI--;tourRender();};
  if($('tourSkip'))$('tourSkip').onclick=tourClose;
  if($('tourCta'))$('tourCta').onclick=function(){if(typeof toolDialog==='function')toolDialog('');};
}
function tourStart(){
  tourList=tourSteps();tourI=0;
  if(!tourList.length)return;
  var ov=document.createElement('div');ov.id='tourOv';ov.className='tour-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML='<div class="tour-spot" id="tourSpot" hidden></div><div class="tour-tip" id="tourTip"></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)tourClose();});
  tourRender();
  window.addEventListener('resize',tourRender);
  window.addEventListener('scroll',tourRender,{passive:true});
  document.addEventListener('keydown',tourKey,true);
  // أي نافذة تُفتح أثناء الجولة (إعلان تحديث · تنبيه) تُقدَّم عليها الجولة:
  // نُخفيها **بلا** وسمها كمُنجَزة كي تعود في زيارة تالية، وإلا حجبت الأزرار.
  var md=$('modal');
  if(md&&window.MutationObserver){
    tourObs=new MutationObserver(function(){
      if(md&&!md.hidden){tourPause();}
    });
    tourObs.observe(md,{attributes:true,attributeFilter:['hidden']});
  }
}
// إخفاء مؤقّت: لا يوسم الجولة كمُنجَزة
function tourPause(){
  var ov=$('tourOv');if(ov)ov.remove();
  tourDetach();
}
function tourDetach(){
  window.removeEventListener('resize',tourRender);
  window.removeEventListener('scroll',tourRender);
  document.removeEventListener('keydown',tourKey,true);
  if(tourObs){try{tourObs.disconnect();}catch(e){}tourObs=null;}
}
function tourKey(e){if(e.key==='Escape'){e.stopPropagation();tourClose();}}
function tourClose(){
  var ov=$('tourOv');if(ov)ov.remove();
  tourDetach();
  try{localStorage.setItem(TOUR_KEY,'1');}catch(e){}
}
function tourMaybe(){
  try{if(localStorage.getItem(TOUR_KEY))return;}catch(e){return;}
  var force=false,testTour=false;
  try{
    force=localStorage.getItem('tahdir_force_tour')==='1';      // تجاوز كل الشروط (لقطات)
    testTour=localStorage.getItem('tahdir_test_tour')==='1';    // تجاوز webdriver فقط
  }catch(e){}
  if(navigator.webdriver&&!force&&!testTour)return;
  // **أول دخول فقط**: العلم من الخادم (IS_FIRST) لا من المتصفح، فمن سبقت له
  // زيارات لا يظهر له الدليل تلقائيًّا ولو مسح تخزين المتصفح.
  // مهم: الفحص **داخل** حلقة الانتظار أدناه — لأن IS_FIRST لا يكون مضبوطًا إلا
  // بعد وصول /api/me، والفحص هنا مبكرًا كان يُلغي الجولة للجميع.
  var tries=0;
  (function wait(){
    if(!document.querySelector('header.top'))return;
    // ننتظر وصول بيانات المستخدم من الخادم (IS_FIRST يُضبط داخل initNav)
    if(typeof window.IS_FIRST!=='boolean'){if(++tries<30)return setTimeout(wait,300);return;}
    if(!force&&!window.IS_FIRST)return;
    var ov=$('modal');
    if(ov&&!ov.hidden){if(++tries<60)return setTimeout(wait,500);return;}
    tourStart();
  })();
}
// السكربت يُحقن في نهاية <body>، وقد يكون DOMContentLoaded وقع بالفعل — فنفحص
// حالة الاستعداد بدل الاعتماد على الحدث وحده (وإلا لم تُشغَّل الجولة أبدًا).
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tourMaybe);
else setTimeout(tourMaybe,0);

(function(){
  var K='kbs_welcome_v1';
  if(navigator.webdriver)return;
  try{if(localStorage.getItem(K))return;}catch(e){return;}
  setTimeout(function(){
    if(!document.querySelector('header.top'))return;
    var ov=$('modal');if(!ov||!ov.hidden)return;
    try{localStorage.setItem(K,'1');}catch(e){}
    var h='<p class="m-msg">يسعدنا أن نقدّم لكم <b>«الكبسولة»</b>، الاسم والشكل الجديدان للمنصة. حساباتكم والتحضير والقيم الثابتة كما هي دون أي تغيير.</p>'+
      '<p class="m-msg"><b>لمستخدمي تطبيق الموبايل:</b> احذفوا التطبيق القديم «التحضير الآلي»، ثم حمّلوا تطبيق «الكبسولة» الجديد.</p>';
    dialog({title:'مرحبًا بكم في «الكبسولة» 💊',html:h,okText:'⬇ تحميل التطبيق الجديد (أندرويد)',cancelText:'حسنًا'}).then(function(r){if(r)location.href=APK_URL;});
  },900);
})();
