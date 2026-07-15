(function(){
  var root=document.getElementById('kulova-root');
  if(!root)return;
  var accent=root.dataset.accent||'#c8f25a';
  var name=root.dataset.name||'Kulova';
  root.innerHTML=''
    +'<div class="klv-panel" id="klv-panel">'
    +'<div class="klv-head" style="background:'+accent+'">'+name+'</div>'
    +'<div class="klv-msgs" id="klv-msgs"></div>'
    +'<div class="klv-input"><input id="klv-in" placeholder="Type a message..."/>'
    +'<button id="klv-send" style="background:'+accent+'">&#10148;</button></div>'
    +'</div>'
    +'<button class="klv-btn" id="klv-btn" style="background:'+accent+'" aria-label="Chat">'
    +'<svg viewBox="0 0 24 24" fill="#0a0a08"><path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.4 4.9 3.6 6.4L5 21l4.3-2.3c.85.2 1.75.3 2.7.3 5.5 0 10-3.8 10-8.5S17.5 2 12 2z"/></svg>'
    +'</button>';
  var panel=document.getElementById('klv-panel');
  var msgs=document.getElementById('klv-msgs');
  function add(t,who){var d=document.createElement('div');d.className='klv-msg '+who;d.textContent=t;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
  document.getElementById('klv-btn').onclick=function(){panel.classList.toggle('open');if(panel.classList.contains('open')&&!msgs.children.length){add('Hi! How can I help you today?','bot');}};
  function send(){var i=document.getElementById('klv-in');var v=i.value.trim();if(!v)return;add(v,'user');i.value='';setTimeout(function(){add('(demo) Thanks — AI replies are coming soon.','bot');},400);}
  document.getElementById('klv-send').onclick=send;
  document.getElementById('klv-in').addEventListener('keydown',function(e){if(e.key==='Enter')send();});
})();
