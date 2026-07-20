(function(){
  var root=document.getElementById('kulova-root');
  if(!root)return;
  var API='https://kulova-backend.vercel.app';
  var accent=root.dataset.accent||'#c8f25a';
  var name=root.dataset.name||'Kulova';
  var welcome=root.dataset.welcome||'Hi! How can I help you today?';
  var placeholder=root.dataset.placeholder||'Type a message...';
  var position=root.dataset.position==='left'?'left':'right';
  var shop=root.dataset.shop||'';

  function hexToRgb(hex){
    hex=(hex||'').replace('#','');
    if(hex.length===3){hex=hex.split('').map(function(c){return c+c;}).join('');}
    var num=parseInt(hex,16)||0;
    return {r:(num>>16)&255,g:(num>>8)&255,b:num&255};
  }
  function rgbToCss(c,a){return 'rgba('+c.r+','+c.g+','+c.b+','+a+')';}
  function darken(c,amt){
    return {
      r:Math.max(0,Math.round(c.r*(1-amt))),
      g:Math.max(0,Math.round(c.g*(1-amt))),
      b:Math.max(0,Math.round(c.b*(1-amt)))
    };
  }
  // WCAG relative luminance + contrast ratio, used to pick readable text/icon color
  function relLuminance(c){
    function chan(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
    return 0.2126*chan(c.r)+0.7152*chan(c.g)+0.0722*chan(c.b);
  }
  function contrast(l1,l2){var lo=Math.min(l1,l2),hi=Math.max(l1,l2);return (hi+0.05)/(lo+0.05);}

  var accentRgb=hexToRgb(accent);
  var accentDarkRgb=darken(accentRgb,0.2);
  var accentLum=relLuminance(accentRgb);
  var textOnAccent=contrast(1,accentLum)>=contrast(0,accentLum)?'#ffffff':'#0a0a08';

  root.style.setProperty('--klv-accent',accent);
  root.style.setProperty('--klv-accent-dark',rgbToCss(accentDarkRgb,1));
  root.style.setProperty('--klv-text-on-accent',textOnAccent);
  root.style.setProperty('--klv-accent-shadow',rgbToCss(accentRgb,0.35));
  root.style.setProperty('--klv-accent-shadow-strong',rgbToCss(accentRgb,0.5));
  root.style.setProperty('--klv-accent-glow',rgbToCss(accentRgb,0.22));
  root.setAttribute('data-position',position);

  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  var sessionId=null;
  try{
    sessionId=localStorage.getItem('kulova-session');
    if(!sessionId){
      sessionId='ks_'+Date.now().toString(36)+Math.random().toString(36).substring(2,10);
      localStorage.setItem('kulova-session',sessionId);
    }
  }catch(e){sessionId='ks_'+Math.random().toString(36).substring(2,15);}

  var CHAT_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var SEND_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  root.innerHTML=''
    +'<div class="klv-panel" id="klv-panel">'
    +'<div class="klv-head"><span class="klv-head-name">'+esc(name)+'</span><span class="klv-online" aria-hidden="true"></span></div>'
    +'<div class="klv-msgs" id="klv-msgs"></div>'
    +'<div class="klv-input"><input id="klv-in" placeholder="'+esc(placeholder)+'"/>'
    +'<button id="klv-send" aria-label="Send">'+SEND_ICON+'</button></div>'
    +'</div>'
    +'<button class="klv-btn" id="klv-btn" aria-label="Chat">'+CHAT_ICON+'</button>';

  var panel=document.getElementById('klv-panel');
  var msgs=document.getElementById('klv-msgs');

  function add(t,who,html){
    var d=document.createElement('div');
    d.className='klv-msg '+who;
    if(html){d.innerHTML=t;}else{d.textContent=t;}
    msgs.appendChild(d);
    msgs.scrollTop=msgs.scrollHeight;
    return d;
  }
  function addTyping(){
    var d=document.createElement('div');
    d.className='klv-msg bot klv-typing';
    d.innerHTML='<span></span><span></span><span></span>';
    msgs.appendChild(d);
    msgs.scrollTop=msgs.scrollHeight;
    return d;
  }

  document.getElementById('klv-btn').onclick=function(){
    panel.classList.toggle('open');
    if(panel.classList.contains('open')&&!msgs.children.length){
      add(welcome,'bot');
    }
  };

  function send(){
    var i=document.getElementById('klv-in');
    var v=i.value.trim();
    if(!v)return;
    add(v,'user');
    i.value='';
    var typing=addTyping();
    fetch(API+'/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:v,sessionId:sessionId,shopDomain:shop})
    })
    .then(function(r){return r.json();})
    .then(function(d){typing.remove();add(d.reply||'Sorry, please try again.','bot',true);})
    .catch(function(){typing.remove();add('Connection error — please try again.','bot');});
  }
  document.getElementById('klv-send').onclick=send;
  document.getElementById('klv-in').addEventListener('keydown',function(e){if(e.key==='Enter')send();});
})();
