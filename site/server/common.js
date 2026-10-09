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
