// «المبادرات» — تقني حذيفة فقط: كل معلم يرفع مبادراته (العنوان، النبذة، الأهداف، الإثباتات بالصور/PDF)
// وتُحفظ على الخادم في حسابه. المدير يرى مبادرات كل المعلمين مع اسم صاحبها، ويفتح الإثباتات.
(function(){
'use strict';
guard();
var D={items:[],admin:false},Q='',T='',URLS={};
function fmtSize(n){return n>=1048576?(n/1048576).toFixed(1)+' م.ب':Math.max(1,Math.round(n/1024))+' ك.ب';}
function hdrs(){var h={},s=sidGet(),d=didGet();if(s)h['X-Tahdir-Sid']=s;if(d)h['X-Tahdir-Did']=d;return h;}
// الصور تُجلب بترويسة الجلسة ثم تُعرض كـ blob (تعمل حتى مع حجب الكوكيز)
function fileUrl(id){
  if(URLS[id])return Promise.resolve(URLS[id]);
  return fetch('/api/init/file/'+id,{credentials:'same-origin',headers:hdrs()}).then(function(r){if(!r.ok)throw new Error('تعذّر فتح الملف');return r.blob();}).then(function(b){return (URLS[id]=URL.createObjectURL(b));});
}
function nl(s){return esc(s).replace(/\n/g,'<br>');}
function isImg(f){return /^image\//.test(f.mime);}
function list(){
  var L=D.items.filter(function(it){
    if(T&&String(it.user_id)!==T)return false;
    if(!Q)return true;var q=Q.toLowerCase();
    return [it.title,it.summary,it.goals,it.teacher].join(' ').toLowerCase().indexOf(q)>=0;
  });
  return L;
}
function render(){
  var h='<div class="an-head"><h2>💡 '+(D.admin?'مبادرات المعلمين':'مبادراتي')+'</h2><p class="muted">'+(D.admin
    ?'كل المبادرات التي رفعها المعلمون بإثباتاتها. اضغط على أي صورة لعرضها كاملة.'
    :'ارفع مبادرتك بعنوانها ونبذة عنها وأهدافها وإثباتاتها (صور أو PDF). تُحفظ في حسابك، ويطّلع عليها مدير المنصة.')+'</p></div>';
  h+='<div class="an-new in-bar"><button type="button" class="btn primary" id="inNew">+ مبادرة جديدة</button>';
  if(D.admin){
    var t={};D.items.forEach(function(it){t[it.user_id]=it.teacher||('#'+it.user_id);});
    h+='<select id="inT" aria-label="المعلم"><option value="">كل المعلمين ('+D.items.length+')</option>'+Object.keys(t).sort(function(a,b){return String(t[a]).localeCompare(String(t[b]),'ar');}).map(function(k){
      var n=D.items.filter(function(x){return String(x.user_id)===k;}).length;
      return '<option value="'+k+'"'+(T===k?' selected':'')+'>'+esc(t[k])+' ('+n+')</option>';}).join('')+'</select>';
  }
  if(D.items.length>3||D.admin)h+='<input type="search" id="inQ" placeholder="بحث في المبادرات…" value="'+esc(Q)+'">';
  h+='</div>';
  var L=list();
  if(!L.length)h+='<div class="in-empty">'+(D.items.length?'لا توجد نتائج.':(D.admin?'لم يرفع أي معلم مبادرة بعد.':'لم ترفع أي مبادرة بعد. ابدأ بـ «+ مبادرة جديدة».'))+'</div>';
  else h+='<div class="in-list">'+L.map(card).join('')+'</div>';
  $('inMain').innerHTML=h;
  $('inNew').onclick=function(){edit(null);};
  if($('inT'))$('inT').onchange=function(){T=this.value;render();};
  if($('inQ'))$('inQ').oninput=function(){Q=this.value.trim();var p=this.selectionStart;render();var e=$('inQ');e.focus();try{e.setSelectionRange(p,p);}catch(x){}};
  bindCards($('inMain'));
}
function card(it){
  var imgs=it.files.filter(isImg),docs=it.files.filter(function(f){return !isImg(f);});
  var h='<article class="in-card" data-id="'+it.id+'"><header class="in-h"><div><h3>'+esc(it.title)+'</h3><small class="muted">'+
    (D.admin?'<b class="in-who">'+esc(it.teacher||'—')+'</b> · ':'')+fmtDate(it.created_at)+(it.updated_at-it.created_at>60000?' · عُدّلت '+fmtDate(it.updated_at):'')+' · '+it.files.length+' إثبات</small></div>'+
    '<div class="in-act">'+(it.mine?'<button type="button" class="btn small" data-ed="'+it.id+'">✎ تعديل</button>':'')+
    '<button type="button" class="btn small" data-pr="'+it.id+'">🖨 طباعة</button>'+
    '<button type="button" class="x" data-del="'+it.id+'" title="حذف">×</button></div></header>';
  if(it.summary)h+='<section><h4>نبذة عن المبادرة</h4><p>'+nl(it.summary)+'</p></section>';
  if(it.goals)h+='<section><h4>ماذا تهدف المبادرة؟</h4><p>'+nl(it.goals)+'</p></section>';
  if(it.files.length){
    h+='<section><h4>الإثباتات</h4>';
    if(imgs.length)h+='<div class="in-ph">'+imgs.map(function(f){return '<button type="button" class="in-th" data-img="'+f.id+'" title="'+esc(f.name)+'"><img alt="'+esc(f.name)+'" data-src="'+f.id+'"></button>';}).join('')+'</div>';
    if(docs.length)h+='<div class="in-docs">'+docs.map(function(f){return '<button type="button" class="btn small" data-doc="'+f.id+'">📄 '+esc(f.name)+' <small>('+fmtSize(f.size)+')</small></button>';}).join('')+'</div>';
    h+='</section>';
  }
  return h+'</article>';
}
function byId(id){return D.items.filter(function(x){return x.id===+id;})[0];}
function bindCards(root){
  Array.prototype.forEach.call(root.querySelectorAll('img[data-src]'),function(im){fileUrl(im.getAttribute('data-src')).then(function(u){im.src=u;},function(){im.alt='تعذّر التحميل';});});
  Array.prototype.forEach.call(root.querySelectorAll('[data-img]'),function(b){b.onclick=function(){
    var it=byId(b.closest('.in-card').getAttribute('data-id'));viewer(it.files.filter(isImg),+b.getAttribute('data-img'));};});
  Array.prototype.forEach.call(root.querySelectorAll('[data-doc]'),function(b){b.onclick=function(){
    var w=window.open('','_blank');fileUrl(b.getAttribute('data-doc')).then(function(u){if(w)w.location.href=u;else location.href=u;},function(e){if(w)w.close();toast(e.message);});};});
  Array.prototype.forEach.call(root.querySelectorAll('[data-ed]'),function(b){b.onclick=function(){edit(byId(b.getAttribute('data-ed')));};});
  Array.prototype.forEach.call(root.querySelectorAll('[data-pr]'),function(b){b.onclick=function(){printIt(byId(b.getAttribute('data-pr')));};});
  Array.prototype.forEach.call(root.querySelectorAll('[data-del]'),function(b){b.onclick=function(){
    var it=byId(b.getAttribute('data-del'));
    dialog({title:'حذف المبادرة؟',message:'ستُحذف «'+it.title+'» وكل إثباتاتها نهائيًا.',okText:'حذف',danger:true}).then(function(ok){
      if(ok)api('/api/init/'+it.id,null,'DELETE').then(function(){toast('حُذفت المبادرة');load();},function(e){toast(e.message);});});};});
}
// عارض الصور: ملء الشاشة مع التنقل بالأسهم
function viewer(imgs,id){
  var i=Math.max(0,imgs.map(function(f){return f.id;}).indexOf(id));
  var o=document.createElement('div');o.className='in-view';o.setAttribute('role','dialog');o.setAttribute('aria-label','عرض الإثبات');
  o.innerHTML='<button type="button" class="in-vx" aria-label="إغلاق">×</button>'+(imgs.length>1?'<button type="button" class="in-vn in-vp" aria-label="السابق">›</button><button type="button" class="in-vn in-vnx" aria-label="التالي">‹</button>':'')+'<figure><img alt=""><figcaption></figcaption></figure>';
  document.body.appendChild(o);
  var im=o.querySelector('img'),cap=o.querySelector('figcaption');
  function show(){var f=imgs[i];cap.textContent=f.name+(imgs.length>1?'  ·  '+(i+1)+' / '+imgs.length:'');im.removeAttribute('src');fileUrl(f.id).then(function(u){if(imgs[i]===f)im.src=u;});}
  function close(){document.removeEventListener('keydown',key);o.remove();}
  function key(e){if(e.key==='Escape')close();else if(e.key==='ArrowLeft'){i=(i+1)%imgs.length;show();}else if(e.key==='ArrowRight'){i=(i-1+imgs.length)%imgs.length;show();}}
  o.onclick=function(e){if(e.target===o||e.target.classList.contains('in-vx'))close();};
  if(imgs.length>1){o.querySelector('.in-vp').onclick=function(){i=(i-1+imgs.length)%imgs.length;show();};o.querySelector('.in-vnx').onclick=function(){i=(i+1)%imgs.length;show();};}
  document.addEventListener('keydown',key);show();
}
// تصغير الصور قبل الرفع (أطول ضلع 1800px، JPEG) لتوفير المساحة وتسريع الرفع
function shrink(file){
  return new Promise(function(res){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<350000)return res(file);
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      var M=1800,w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,M/Math.max(w,h));
      var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
      var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
      c.toBlob(function(b){if(!b||b.size>=file.size)return res(file);b.name=file.name.replace(/\.[a-z0-9]+$/i,'')+'.jpg';res(b);},'image/jpeg',.85);
    };
    im.onerror=function(){URL.revokeObjectURL(u);res(file);};im.src=u;
  });
}
function upload(iid,file){
  return shrink(file).then(function(b){
    var h=hdrs();h['Content-Type']=b.type||file.type;h['X-File-Name']=encodeURIComponent(b.name||file.name||'ملف');
    return fetch('/api/init/'+iid+'/file',{method:'POST',credentials:'same-origin',headers:h,body:b}).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error(j.error||'تعذّر رفع الملف');return j;});});
  });
}
var OK_TYPE=/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;
function edit(it){
  var pend=[],gone=[],cur=it?it.files.slice():[];
  var h='<form class="in-form" id="inForm" novalidate><h2>'+(it?'تعديل المبادرة':'مبادرة جديدة')+'</h2>'+
    '<label class="in-f"><span>عنوان المبادرة <i>*</i></span><input id="inTitle" maxlength="200" required value="'+esc(it?it.title:'')+'" placeholder="مثال: مبادرة «قارئ الأحياء الصغير»"></label>'+
    '<label class="in-f"><span>نبذة عن المبادرة</span><textarea id="inSum" rows="5" maxlength="6000" placeholder="فكرة المبادرة، والفئة المستهدفة، وكيف نُفّذت ومتى…">'+esc(it?it.summary||'':'')+'</textarea></label>'+
    '<label class="in-f"><span>ماذا تهدف المبادرة؟</span><textarea id="inGoals" rows="5" maxlength="6000" placeholder="اكتب كل هدف في سطر…">'+esc(it?it.goals||'':'')+'</textarea></label>'+
    '<div class="in-f"><span>الإثباتات (صور أو PDF)</span>'+
    '<label class="in-drop" id="inDrop"><input type="file" id="inFile" accept="image/*,application/pdf" multiple hidden><b>📎 اختر الصور أو الملفات</b><small>أو اسحبها وأفلتها هنا · حتى 20 ملفًا للمبادرة · PDF حتى 6 م.ب، والصور تُصغَّر تلقائيًا</small></label>'+
    '<div class="in-pend" id="inPend"></div></div>'+
    '<div class="err" id="inErr" role="alert" hidden></div>'+
    '<div class="in-btns"><button type="submit" class="btn primary" id="inSave">حفظ المبادرة</button><button type="button" class="btn" id="inCancel">إلغاء</button></div></form>';
  $('inMain').innerHTML=h;window.scrollTo(0,0);
  function draw(){
    var x=cur.map(function(f){return '<span class="in-pi">'+(isImg(f)?'<img data-src="'+f.id+'" alt="">':'<em>📄</em>')+'<small>'+esc(f.name)+'</small><button type="button" class="x" data-rm-old="'+f.id+'" title="حذف">×</button></span>';}).join('')+
      pend.map(function(f,k){return '<span class="in-pi new">'+(/^image\//.test(f.type)?'<img src="'+f._u+'" alt="">':'<em>📄</em>')+'<small>'+esc(f.name)+'</small><button type="button" class="x" data-rm-new="'+k+'" title="إزالة">×</button></span>';}).join('');
    $('inPend').innerHTML=x;
    Array.prototype.forEach.call($('inPend').querySelectorAll('img[data-src]'),function(im){fileUrl(im.getAttribute('data-src')).then(function(u){im.src=u;});});
    Array.prototype.forEach.call($('inPend').querySelectorAll('[data-rm-old]'),function(b){b.onclick=function(){var id=+b.getAttribute('data-rm-old');gone.push(id);cur=cur.filter(function(f){return f.id!==id;});draw();};});
    Array.prototype.forEach.call($('inPend').querySelectorAll('[data-rm-new]'),function(b){b.onclick=function(){var f=pend.splice(+b.getAttribute('data-rm-new'),1)[0];if(f&&f._u)URL.revokeObjectURL(f._u);draw();};});
  }
  function add(files){
    var bad=0;Array.prototype.forEach.call(files||[],function(f){
      if(!OK_TYPE.test(f.type)){bad++;return;}
      if(f.type==='application/pdf'&&f.size>6*1048576){toast('«'+f.name+'» أكبر من 6 م.ب');return;}
      if(cur.length+pend.length>=20){bad++;return;}
      if(/^image\//.test(f.type))f._u=URL.createObjectURL(f);pend.push(f);});
    if(bad)toast('تُقبل الصور وملفات PDF فقط، وبحد 20 ملفًا');draw();
  }
  $('inFile').onchange=function(){add(this.files);this.value='';};
  var dr=$('inDrop');
  dr.ondragover=function(e){e.preventDefault();dr.classList.add('on');};dr.ondragleave=function(){dr.classList.remove('on');};
  dr.ondrop=function(e){e.preventDefault();dr.classList.remove('on');add(e.dataTransfer.files);};
  $('inCancel').onclick=function(){pend.forEach(function(f){if(f._u)URL.revokeObjectURL(f._u);});render();};
  $('inForm').onsubmit=function(e){
    e.preventDefault();var er=$('inErr');er.hidden=true;
    var t=$('inTitle').value.trim();if(!t){er.textContent='اكتب عنوان المبادرة.';er.hidden=false;$('inTitle').focus();return;}
    var btn=$('inSave');btn.disabled=true;btn.textContent='جارٍ الحفظ…';
    api('/api/init',{id:it?it.id:0,title:t,summary:$('inSum').value,goals:$('inGoals').value}).then(function(r){
      var iid=r.id,fail=[];
      var chain=gone.reduce(function(p,id){return p.then(function(){return api('/api/init/file/'+id,null,'DELETE').catch(function(){});});},Promise.resolve());
      pend.forEach(function(f,k){chain=chain.then(function(){btn.textContent='رفع الإثباتات '+(k+1)+' / '+pend.length+'…';return upload(iid,f).catch(function(e){fail.push(f.name+': '+e.message);});});});
      return chain.then(function(){
        pend.forEach(function(f){if(f._u)URL.revokeObjectURL(f._u);});
        if(fail.length)dialog({title:'لم تُرفع بعض الملفات',message:fail.join('\n'),okText:'حسنًا'});
        else toast(it?'حُفظت التعديلات':'أُضيفت المبادرة ✓');
        return load();
      });
    }).catch(function(e){er.textContent=e.message;er.hidden=false;btn.disabled=false;btn.textContent='حفظ المبادرة';});
  };
  draw();$('inTitle').focus();
}
// طباعة المبادرة بالترويسة الرسمية، والصور مضمّنة
function printIt(it){
  var imgs=it.files.filter(isImg);
  Promise.all(imgs.map(function(f){return fileUrl(f.id).catch(function(){return '';});})).then(function(us){
    var sh=schoolHdr(),head=OFFICIAL_HEAD({dir:sh.dir,school:sh.school,title:'مبادرة: '+it.title,line2:'العام الدراسي '+sh.year});
    var h='<div class="in-print">'+head+
      '<table class="in-pt"><tr><th>عنوان المبادرة</th><td>'+esc(it.title)+'</td></tr><tr><th>صاحب المبادرة</th><td>'+esc(it.teacher||'')+'</td></tr><tr><th>تاريخ الرفع</th><td>'+fmtDate(it.created_at)+'</td></tr></table>'+
      (it.summary?'<h3>نبذة عن المبادرة</h3><p>'+nl(it.summary)+'</p>':'')+
      (it.goals?'<h3>ماذا تهدف المبادرة؟</h3><p>'+nl(it.goals)+'</p>':'')+
      (us.filter(Boolean).length?'<h3>الإثباتات</h3><div class="in-pph">'+us.filter(Boolean).map(function(u){return '<img src="'+u+'" alt="">';}).join('')+'</div>':'')+
      '</div>';
    $('printArea').innerHTML=h;
    setTimeout(function(){doPrint('مبادرة - '+it.title);},400);
  });
}
function load(){
  return api('/api/init').then(function(r){D=r;D.items=r.items||[];render();},function(e){$('inMain').innerHTML='<div class="in-empty">'+esc(e.message)+'</div>';});
}
api('/api/me').then(function(me){initNav(me);load();},function(e){$('inMain').innerHTML='<div class="in-empty">'+esc(e.message)+'</div>';});
})();
