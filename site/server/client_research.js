// «البحوث الإجرائية»: بحوث جاهزة لكل مادة (العلوم، اللغة العربية، الرياضيات)،
// تُقرأ في الصفحة وتُطبع أو تُحمَّل ملف Word. المصدر: site/data/research/*.md ← window.RESEARCH.
(function(){
'use strict';
guard();
var RS=window.RESEARCH||[];
var SUBJECTS=[['العلوم','🔬'],['اللغة العربية','📖'],['الرياضيات','➗']];
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
var subj=lsGet('rs_subject')||'العلوم',openId=null;
if(!SUBJECTS.some(function(s){return s[0]===subj;}))subj='العلوم';

function docHtml(r){
  return '<h1>'+esc(r.title)+'</h1><p class="rs-by">'+esc(r.authors||'')+'</p>'+r.html;
}
function renderList(){
  var list=RS.filter(function(r){return r.subject===subj;});
  var h='<div class="rs-tabs" role="tablist">'+SUBJECTS.map(function(s){
    var n=RS.filter(function(r){return r.subject===s[0];}).length;
    return '<button type="button" role="tab" data-s="'+esc(s[0])+'" class="'+(s[0]===subj?'on':'')+'" aria-selected="'+(s[0]===subj)+'">'+s[1]+' '+esc(s[0])+(n?' ('+n+')':'')+'</button>';
  }).join('')+'</div>';
  if(!list.length){
    h+='<div class="rs-empty">لا توجد بحوث إجرائية في «'+esc(subj)+'» بعد. ستُضاف البحوث هنا عند إعدادها.</div>';
  }else{
    list.forEach(function(r){
      h+='<button type="button" class="rs-card" data-id="'+esc(r.id)+'"><h3>'+esc(r.title)+'</h3>'+
        '<p>'+esc(r.authors||'')+'</p>'+
        '<p>المادة: '+esc(r.material||r.subject)+' · الصف '+esc(r.grade||'')+' · '+esc(r.year||'')+'</p>'+
        (r.target?'<p>الفئة المستهدفة: '+esc(r.target)+'</p>':'')+'</button>';
    });
  }
  $('rsMain').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-s]'),function(b){b.onclick=function(){subj=b.getAttribute('data-s');lsSet('rs_subject',subj);renderList();};});
  Array.prototype.forEach.call(document.querySelectorAll('.rs-card'),function(b){b.onclick=function(){openDoc(b.getAttribute('data-id'));};});
}
function openDoc(id){
  var r=RS.filter(function(x){return x.id===id;})[0];if(!r)return renderList();
  openId=id;
  $('rsMain').innerHTML='<div class="rs-bar"><button type="button" class="btn" id="rsBack">→ رجوع إلى قائمة البحوث</button>'+
    '<button type="button" class="btn primary" id="rsPrint">🖨 طباعة / PDF</button><button type="button" class="btn" id="rsWord">⬇ تحميل Word</button></div>'+
    '<article class="rs-doc">'+docHtml(r)+'</article>';
  window.scrollTo(0,0);
  $('rsBack').onclick=function(){openId=null;renderList();};
  $('rsPrint').onclick=function(){$('printArea').innerHTML='<div class="rs-doc">'+docHtml(r)+'</div>';doPrint(r.title);};
  $('rsWord').onclick=function(){
    toast('جارٍ تجهيز ملف Word…');
    var html='<div dir="rtl" style="font-family:Arial;font-size:14pt;line-height:1.7">'+docHtml(r).replace(/<table class="rs-t">/g,'<table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%">')+'</div>';
    api('/api/export',{format:'doc',name:r.title.slice(0,90),html:html}).then(function(x){
      var a=document.createElement('a');a.href=x.url;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
    },function(e){toast(e.message);});
  };
}
api('/api/me').then(function(m){initNav(m);});
renderList();
})();
