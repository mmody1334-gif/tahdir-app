(function(){
'use strict';
guard();
function fingerprint(){
  var n=navigator,s=screen,parts=[n.userAgent,n.platform||'',n.language||'',(n.languages||[]).join(','),s.width+'x'+s.height+'x'+(window.devicePixelRatio||1),s.colorDepth,
    (Intl.DateTimeFormat().resolvedOptions().timeZone||''),n.hardwareConcurrency||'',n.deviceMemory||'',n.maxTouchPoints||0];
  var str=parts.join('|');
  if(window.crypto&&crypto.subtle){
    return crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2);}).join('').slice(0,40);});
  }
  return Promise.resolve('');
}
var form=$('loginForm');
if(form){
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=$('loginBtn'),err=$('loginErr');err.hidden=true;btn.disabled=true;btn.textContent='جارٍ الدخول…';
    fingerprint().then(function(fp){
      return api('/api/login',{username:$('username').value,password:$('password').value,fp:fp,screen:screen.width+'×'+screen.height});
    }).then(function(r){
      btn.textContent='أهلًا '+(r.name||'');document.body.classList.add('leaving');
      setTimeout(function(){location.href=r.role==='admin'?'/admin':'/app';},420);
    },function(ex){
      err.textContent=ex.message;err.hidden=false;btn.disabled=false;btn.textContent='دخول';
      form.classList.remove('shake');void form.offsetWidth;form.classList.add('shake');
    });
  });
  var eye=$('togglePass');
  if(eye)eye.onclick=function(){var p=$('password');p.type=p.type==='password'?'text':'password';eye.setAttribute('aria-pressed',String(p.type==='text'));eye.textContent=p.type==='password'?'إظهار':'إخفاء';};
}
var setup=$('setupForm');
if(setup){
  setup.addEventListener('submit',function(e){
    e.preventDefault();var err=$('loginErr');err.hidden=true;
    if($('password').value!==$('password2').value){err.textContent='كلمتا المرور غير متطابقتين.';err.hidden=false;return;}
    api('/api/setup',{name:$('name').value,username:$('username').value,password:$('password').value}).then(function(){
      location.href='/';
    },function(ex){err.textContent=ex.message;err.hidden=false;});
  });
}
if(/TahdirApp/.test(navigator.userAgent)){var ga=document.getElementById('getApp');if(ga)ga.hidden=true;}
})();
