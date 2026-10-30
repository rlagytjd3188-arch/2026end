'use strict';
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const story = $('#story');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const parts = ['2026 활동 기록', '총회 · 연구소', '현장 연대', '녹색교회 · 생태 실천', '기후정의 · 국제 연대', '기후정의 컨퍼런스 · 네팔', 'RECOVERY'];
  const choices = [
    {key:'터전',title:'생명의 터전을 지키는 회복',short:'생명의 터전을\n지키는 회복',description:'개발보다 생명의 자리를 지키는 선택',photo:'05-p23-6',color:'#cefa73'},
    {key:'정의',title:'정의가 흐르는 회복',short:'정의가\n흐르는 회복',description:'책임과 피해가 불평등하게 나뉘지 않는 세상',photo:'09-p01-0',color:'#b9dde3'},
    {key:'연결',title:'끊어진 관계를 잇는 회복',short:'끊어진 관계를\n잇는 회복',description:'사람과 사람, 인간과 창조세계를 다시 잇는 삶',photo:'07-p10-8',color:'#e4c987'},
    {key:'전환',title:'다른 세계를 만드는 회복',short:'다른 세계를\n만드는 회복',description:'익숙한 방향을 돌이켜 새로운 길을 만드는 전환',photo:'10-p03-6',color:'#c6b9ec'}
  ];
  let scenes = [], index = -1, chosen = null, frame = 0, toastTimer, cardBlob = null;
  const state = new Map();
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const path = id => `assets/photos/${id}.webp`;
  const label = s => s.part ? `PART ${String(s.part).padStart(2,'0')} / ${parts[s.part]}` : 'RECOVERY 44 / 2026';
  const photo = (s, n=0, cls='') => `<figure class="visual ${cls}"><img src="${path(s.photos[n])}" alt="${escape(s.labels?.[n] || s.title.replaceAll('\n',' '))}" decoding="async"><figcaption>${escape(s.labels?.[n] || '')}</figcaption></figure>`;
  const head = s => `<span class="eyebrow">${escape(s.eyebrow || label(s))}</span><h2 tabindex="-1">${s.id==='walking'?s.title.split('\n').map((line,i)=>`<span class="walking-title-${i}">${escape(line)}</span>`).join(''):escape(s.title)}</h2>${s.copy?`<p class="copy">${escape(s.copy)}</p>`:''}`;
  const detail = s => s.source ? `<div class="field-record"${s.details?' aria-live="polite" aria-atomic="true"':''}><span class="record-label">현장의 기록</span><p>${escape(s.details?.[0] || s.detail)}</p></div>` : '';
  const chips = labels => `<div class="switches">${labels.map((v,i)=>`<button class="chip" data-option="${i}" aria-pressed="${i===0}">${escape(v)}</button>`).join('')}</div>`;
  const button = (text,action,cls='primary') => `<button class="${cls}${cls==='primary'||['churches','river','photo-next'].includes(action)?' interactive-button':''}" data-action="${action}"${['churches','river'].includes(action)?' aria-pressed="false"':action==='nepal'?' aria-haspopup="dialog" aria-controls="carbon-dialog"':''}>${text}</button>`;
  function render(s) {
    let html;
    switch (s.kind) {
      case 'hero': html=`<img class="hero-image" src="${path(s.photos[0])}" alt="풍천리 숲에서 나무와 함께 선 사람들" fetchpriority="high"><span class="eyebrow">2026 &nbsp; / &nbsp; 44 YEARS TOGETHER</span><h1 tabindex="-1">RE<span class="word-outline">COVERY</span><span class="accent">.</span></h1><p class="hero-note">${s.copy}</p><div class="hero-bottom">${button('올해 돌아보기','next')}</div><p class="hero-side">From broken places,<br>we make a new way.</p>`;break;

      case 'film': html=`<div class="film-top"><div>${head(s)}</div><span class="film-hint">기록을 옆으로 밀어보세요 &nbsp; →</span></div><div class="filmstrip" tabindex="0" aria-label="걷기의 기록 사진 필름">${s.photos.map((id,i)=>`<figure><img loading="lazy" src="${path(id)}" alt="${escape(s.labels[i])}"></figure>`).join('')}</div>${detail(s)}`;break;
      case 'churches': html=`<div class="church-layout"><div>${head(s)}${detail(s)}<div class="switches">${button('전국 녹색교회는 몇곳일까요?','churches')}</div></div><div><div class="stat-large" data-counter="16">0</div><span class="stat-label" id="church-label">2026 올해의 녹색교회 · 새롭게 선정된 교회</span><div class="church-dots" aria-hidden="true">${'<i></i>'.repeat(162)}</div><img class="church-photo" src="${path(s.photos[0])}" alt="2026 올해의 녹색교회 시상식"></div></div>`;break;
      case 'calendar': html=`<div class="split"><div>${head(s)}${detail(s)}<a class="primary calendar-apply" href="https://forms.gle/eXWtNmhnSnByQJ318" target="_blank" rel="noopener noreferrer">생태달력 신청하기<span class="sr-only"> (새 창)</span></a></div><figure class="calendar-photo"><img src="${s.image || path(s.photos[0])}" alt="2027 생태달력 실물 사진"></figure></div>`;break;
      case 'photo-gallery': html=`<div class="split"><div>${head(s)}${button('다음 사진 보기','photo-next')}<p class="photo-position" aria-live="polite"></p>${detail(s)}</div>${photo(s)}</div>`;break;
      case 'nepal': html=`<div class="split"><div>${head(s)}${button('탄소배출량 비교 보기','nepal')}${detail(s)}</div>${photo(s)}</div>`;break;
      case 'river': html=`<img class="full-photo" src="${s.image || path(s.photos[0])}" alt="기후정의행진 사진"><div class="river-content">${head(s)}<svg class="river-lines" viewBox="0 0 900 120" role="img" aria-label="작은 물줄기가 하나의 강으로 연결되는 모습">${[5,25,45,65,85,105].map((y,i)=>`<path d="M0 ${y} C200 ${y} 200 60 430 60 S700 ${i%2?45:75} 900 60"/>`).join('')}</svg><div class="river-stats"><div><strong data-counter="20000">0</strong><small>명을 넘는 시민</small></div><div><strong data-counter="620">0</strong><small>개 시민사회단체</small></div></div>${button('행진 참여 규모 보기','river')}<p class="response" aria-live="polite"></p>${detail(s)}</div>`;break;
      case 'possibility': html=`<div class="split"><div>${head(s)}${button('다음 사진 보기','photo-next')}<p class="photo-position" aria-live="polite"></p>${detail(s)}</div>${photo(s)}</div>`;break;
      case 'memory': html=`<span class="eyebrow">PART 06 / 2026 활동 기록</span><h2 tabindex="-1">${escape(s.title)}</h2><div class="memory-word">RECOVERY<span class="accent">.</span></div><img class="memory-photo" src="${path(s.photos[0])}" alt="풍천리 주민 연대 현장">${chips(s.labels)}<p class="copy">${escape(s.copy)}</p>${detail(s)}`;break;
      case 'choices': html=`<div class="choices-layout"><div>${head(s)}<span class="eyebrow">YOUR NEXT STEP ↗</span><p class="copy">한 가지 마음을 골라\n나만의 회복 카드를 남겨보세요.</p></div><div class="choices-list">${choices.map((c,i)=>`<button class="choice" data-choice="${i}"><span class="choice-num">0${i+1}</span><span><b>${c.title}</b><small>${c.description}</small></span><span class="choice-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div>`;break;
      case 'result': html=`<div class="result-layout"><div>${head(s)}<div class="result-actions">${button('나의 회복 PNG 저장','download')}${button('카드 공유하기','share','secondary')}</div>${button('다른 회복 선택하기','choose','text-link')}${button('처음부터 다시 걷기','restart','text-link')}<p class="source">기독교환경운동연대 44주년 · RECOVERY 44<br>선택과 카드 이미지는 서버로 전송되지 않습니다.</p></div><div><canvas class="result-card" id="result-card" width="1080" height="1350" role="img" aria-label="선택한 회복의 결과 카드"></canvas><p class="result-caption">MY RECOVERY · 2026<br>당신의 마음이 다음 회복의 시작입니다.</p></div></div>`;break;
      default:html=`<div class="split"><div class="text-block">${head(s)}${['switch','values','gallery'].includes(s.kind)?chips(s.labels):''}${s.kind==='values'?`<p class="response" aria-live="polite">${escape(s.responses[0])}</p>`:''}${detail(s)}</div>${photo(s,0,s.id==='research'?'photo-stack':'')}</div>`;
    }
    return html;
  }
  function activeState() {if(!state.has(scenes[index].id)) state.set(scenes[index].id,{});return state.get(scenes[index].id);}
  const counterRuns=new WeakMap();
  function count(el, end, suffix='') {
    const run=(counterRuns.get(el)||0)+1;counterRuns.set(el,run);
    const currentFrame=frame,start=performance.now(),duration=reduced.matches?0:1000;
    function tick(t){if(currentFrame!==frame||!el.isConnected||counterRuns.get(el)!==run)return;const p=duration?Math.min(1,(t-start)/duration):1;el.textContent=Math.round(end*(1-(1-p)**3)).toLocaleString('en-US')+suffix;if(p<1)requestAnimationFrame(tick)}requestAnimationFrame(tick);
  }
  function setPhoto(n){const s=scenes[index],im=$('.visual img',story);im.src=path(s.photos[n]);im.alt=(s.labels?.[n]||s.title.replaceAll('\n',' '))+'';const caption=$('.visual figcaption',story);caption.textContent=s.labels?.[n]||'';}
  function selectOption(n){const s=scenes[index];activeState().option=n;story.querySelectorAll('[data-option]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.option===n)));if(['switch','gallery'].includes(s.kind))setPhoto(n);if(s.kind==='values'){$('.response',story).textContent=s.responses[n];if(s.photos.length===s.labels.length)setPhoto(n);}if(s.details)$('.field-record p',story).textContent=s.details[n];if(s.kind==='possibility')$('.response',story).textContent=['일하는 사람의 삶을 버리지 않는 전환.','터전과 공동체를 희생시키지 않는 전환.','국경과 종교의 경계를 넘어 함께 만드는 전환.'][n];if(s.kind==='memory'){$('.memory-photo',story).src=path(s.photos[n]);$('.memory-photo',story).alt=s.labels[n]+'의 기억';$('.memory-word',story).textContent=s.labels[n];}}
  function churches(expand=true){const st=activeState();if(expand)st.expanded=!st.expanded;const end=st.expanded?162:16;count($('[data-counter]',story),end);$('#church-label').textContent=st.expanded?'전국 녹색교회 · 하나로 이어진 생명의 숲':'2026 올해의 녹색교회 · 새롭게 선정된 교회';story.querySelectorAll('.church-dots i').forEach((dot,i)=>dot.classList.toggle('on',i<end));const b=$('[data-action="churches"]',story);b.textContent=st.expanded?'올해 선정된 교회는 몇곳일까요?':'전국 녹색교회는 몇곳일까요?';b.setAttribute('aria-pressed',String(!!st.expanded));}
  function nextPhoto(advance=true){const st=activeState(),s=scenes[index];st.photoIndex=((st.photoIndex||0)+(advance?1:0))%s.photos.length;setPhoto(st.photoIndex);$('.photo-position',story).textContent=`${st.photoIndex+1} / ${s.photos.length}`;}
  function nepal(){openDialog($('#carbon-dialog'),$('[data-action="nepal"]',story));}
  function river(toggle=true){const st=activeState();if(toggle)st.joined=!st.joined;$('.river-lines',story).classList.toggle('joined',!!st.joined);story.querySelectorAll('[data-counter]').forEach(el=>count(el,st.joined?+el.dataset.counter:0,st.joined&&+el.dataset.counter===20000?'+':''));$('.response',story).textContent=st.joined?'서로 다른 자리의 사람들이 기후정의를 위해 함께 행진했습니다.':'';const btn=$('[data-action="river"]',story);btn.textContent=st.joined?'참여 규모 표시 접기':'행진 참여 규모 보기';btn.setAttribute('aria-pressed',String(!!st.joined));}
  function restore(s){const st=activeState();if(s.kind==='churches')churches(false);if(['photo-gallery','possibility'].includes(s.kind))nextPhoto(false);if(s.kind==='river')river(false);if(st.option!==undefined)selectOption(st.option);if(s.kind==='result')drawCard();}
  const sceneNumber=id=>scenes.findIndex(s=>s.id===id);
  function show(n,{focus=false,hash=true}={}) {
    if(!scenes.length)return;n=Math.max(0,Math.min(scenes.length-1,n));if(scenes[n].kind==='result'&&!chosen)n=sceneNumber('your-recovery');
    const previous=index;index=n;frame++;
    const s=scenes[index];document.body.classList.toggle('light',s.part>=5);
    story.innerHTML=`<section class="scene ${s.kind} kind-${s.kind}" data-scene="${s.id}" data-part="${s.part}" data-transition="${n<previous?'back':'forward'}" aria-label="${escape(s.title.replaceAll('\n',' '))}">${render(s)}</section>`;
    $('#previous').disabled=index===0;$('#next').disabled=index>=sceneNumber('your-recovery');
    $('#part-label').textContent=label(s);$('#progress').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i+1<s.part?'past':i+1===s.part?'current':''}"></i>`).join('');$('#progress').setAttribute('aria-label',`${s.part ? `6개 파트 중 ${s.part}번째` : '이야기 시작'}`);
    if(hash)history.replaceState(null,'','#'+s.id);
    $('#announcement').textContent=`${label(s)}. ${s.title.replaceAll('\n',' ')}`;
    story.querySelectorAll('button').forEach(btn=>btn.classList.add('interactive-button'));
    restore(s);if(focus)$('h1,h2',story)?.focus({preventScroll:true});
    // Only adjacent scenes are prefetched; no full photo archive download at startup.
    if(scenes[index+1]?.photos[0]){const im=new Image();im.src=scenes[index+1].image || path(scenes[index+1].photos[0]);}
    const strip=$('.filmstrip',story);if(strip)enableDrag(strip);
  }
  function enableDrag(strip){let drag=null;strip.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;drag={x:e.clientX,left:strip.scrollLeft};strip.setPointerCapture(e.pointerId);});strip.addEventListener('pointermove',e=>{if(drag)strip.scrollLeft=drag.left-(e.clientX-drag.x);});const stop=()=>drag=null;strip.addEventListener('pointerup',stop);strip.addEventListener('pointercancel',stop);}
  function notify(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',4500);}
  async function drawCard(){const canvas=$('#result-card');if(!canvas||!chosen)return;cardBlob=null;const requestFrame=frame;const g=canvas.getContext('2d');const c=chosen;canvas.setAttribute('aria-label',`MY RECOVERY 2026. 나는 ${c.title}을 이어가겠습니다.`);g.fillStyle='#08140f';g.fillRect(0,0,1080,1350);
    let im;try{im=new Image();im.src=path(c.photo);await im.decode();}catch{notify('사진을 불러오지 못해 그래픽 카드로 만듭니다.');}
    await document.fonts.ready;if(requestFrame!==frame||!canvas.isConnected)return;
    if(im?.naturalWidth){const scale=Math.max(1080/im.width,900/im.height);const w=im.width*scale,h=im.height*scale;g.save();g.beginPath();g.rect(0,0,1080,900);g.clip();g.drawImage(im,(1080-w)/2,(900-h)/2,w,h);g.restore();}
    const grad=g.createLinearGradient(0,0,0,850);grad.addColorStop(0,'#08140f18');grad.addColorStop(.4,'#08140f44');grad.addColorStop(1,'#08140f');g.fillStyle=grad;g.fillRect(0,0,1080,900);
    g.strokeStyle=c.color;g.lineWidth=2;g.strokeRect(45,45,990,1260);g.fillStyle=c.color;g.font='700 24px Recovery, sans-serif';g.fillText('MY RECOVERY',80,105);g.textAlign='right';g.fillText('2026 / 44 YEARS',1000,105);g.textAlign='left';
    // Distinct, light geometric marks for each choice, without additional image requests.
    g.strokeStyle=c.color;g.lineWidth=3;for(let i=0;i<5;i++){g.beginPath();if(c.key==='터전'){g.moveTo(790+i*30,580);g.lineTo(790+i*30,450-i*15);g.lineTo(765+i*30,490-i*15);}else if(c.key==='정의'){g.moveTo(740,440+i*25);g.bezierCurveTo(850,400+i*30,900,540-i*10,990,460+i*20);}else if(c.key==='연결'){g.arc(840+i*20,500,45,0,Math.PI*2);}else {g.moveTo(760+i*35,570);g.lineTo(760+i*35,450-i*20);}g.stroke();}
    g.fillStyle='#f1eee4';g.font='400 30px Recovery, sans-serif';g.fillText('나는',80,790);g.fillStyle=c.color;g.font='700 67px Recovery, sans-serif';c.short.split('\n').forEach((line,i)=>g.fillText(line,80,890+i*90));g.fillStyle='#f1eee4';g.font='400 30px Recovery, sans-serif';g.fillText('을 이어가겠습니다.',80,1055);g.fillStyle='#f1eee4';g.font='900 100px Arial, sans-serif';g.fillText('RECOVERY 44',74,1210);g.font='400 23px Recovery, sans-serif';g.fillStyle='#c0c7b9';g.fillText('기독교환경운동연대 · 함께 걸어온 회복의 시간',80,1260);
    try{cardBlob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 생성 실패')),'image/png'));}catch{notify('카드를 만들지 못했습니다. 다시 선택한 뒤 시도해주세요.');}
  }
  async function getCard(){if(!cardBlob){await drawCard();}if(!cardBlob)throw new Error('카드를 아직 만들지 못했습니다. 잠시 후 다시 시도해주세요.');return cardBlob;}
  async function download(){try{const blob=await getCard();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`RECOVERY44_${chosen.key}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('PNG를 만들었습니다. 다운로드 파일을 확인해주세요.');}catch(e){notify(e.message);}}
  async function share(){try{const blob=await getCard();const file=new File([blob],`RECOVERY44_${chosen.key}.png`,{type:'image/png'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'MY RECOVERY · 2026'});}else {await download();notify('이 브라우저에서는 파일 공유 대신 PNG 저장을 제공합니다.');}}catch(e){if(e.name!=='AbortError')notify('공유하지 못했습니다. PNG 저장을 이용해주세요.');}}
  const actions={next:()=>show(index+1,{focus:true}),churches:()=>churches(),'photo-next':()=>nextPhoto(),nepal:()=>nepal(),river:()=>river(),download,share,choose:()=>show(sceneNumber('your-recovery'),{focus:true}),restart:()=>{chosen=null;cardBlob=null;state.clear();show(0,{focus:true});}};
  story.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.action)actions[target.dataset.action]?.();if(target.dataset.option!==undefined)selectOption(+target.dataset.option);if(target.dataset.choice!==undefined){chosen=choices[+target.dataset.choice];show(sceneNumber('my-recovery'),{focus:true});}});
  story.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.classList.add('photo-failed');e.target.alt='이미지를 불러올 수 없습니다. '+e.target.alt;}},true);
  $('#previous').onclick=()=>show(index-1,{focus:true});$('#next').onclick=()=>show(index+1,{focus:true});
  function openDialog(dialog,opener){dialog._opener=opener;dialog.showModal();}
  $('#menu').onclick=()=>openDialog($('#map-dialog'),$('#menu'));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>d._opener?.focus({preventScroll:true})));
  document.addEventListener('keydown',e=>{const d=document.querySelector('dialog[open]');if(!d||e.key!=='Tab')return;const items=[...d.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!d.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!d.contains(document.activeElement))){e.preventDefault();first.focus();}});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.target.closest('input,textarea,select,.filmstrip'))return;const interactive=e.target.closest('button,a');if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();if(e.key==='ArrowRight'&&index<sceneNumber('your-recovery'))show(index+1,{focus:true});else if(e.key==='ArrowLeft')show(index-1,{focus:true});}else if(e.code==='Space'&&!interactive&&index<sceneNumber('your-recovery')){e.preventDefault();show(index+1,{focus:true});}});
  let touch=null;
  story.addEventListener('touchstart',e=>{if(e.target.closest('button,a,.filmstrip')||e.touches.length!==1){touch=null;return;}const t=e.touches[0];touch={x:t.clientX,y:t.clientY};},{passive:true});
  story.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0&&index<sceneNumber('your-recovery'))show(index+1,{focus:true});if(dx>0)show(index-1,{focus:true});}},{passive:true});
  story.addEventListener('touchcancel',()=>touch=null,{passive:true});
  window.addEventListener('hashchange',()=>{const n=scenes.findIndex(s=>'#'+s.id===(location.hash==='#walking-again'?'#walking':location.hash==='#we-are-trees'?'#forest-voices':location.hash));if(n>=0&&n!==index)show(n,{hash:false});});
  async function boot(){try{const res=await fetch('data/scenes.json');if(!res.ok)throw new Error('기록 응답 오류');scenes=await res.json();$('#chapter-list').innerHTML=['opening','beginning','no-nukes','conversion','nepal','another-world','recovery','your-recovery'].map(sceneNumber).map(i=>`<a href="#${scenes[i].id}" data-chapter="${i}"><span>${i===0?'START':scenes[i].kind==='choices'?'YOU':`PART ${String(scenes[i].part).padStart(2,'0')}`}</span>${i===0?'올해 돌아보기':scenes[i].kind==='choices'?'나의 회복 남기기':parts[scenes[i].part]}</a>`).join('');$('#chapter-list').addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();$('#map-dialog').close();show(+a.dataset.chapter,{focus:true});}});const n=scenes.findIndex(s=>'#'+s.id===(location.hash==='#walking-again'?'#walking':location.hash==='#we-are-trees'?'#forest-voices':location.hash));show(n<0?0:n);}catch{story.innerHTML='<section class="error-panel"><h1>기록을 불러오지 못했습니다.</h1><p>인터넷 연결을 확인한 뒤 새로고침해주세요. 파일을 직접 여셨다면 README의 로컬 서버 실행 방법을 이용해주세요.</p><button class="primary" id="retry">다시 불러오기</button></section>';$('#retry').onclick=boot;$('#previous').disabled=true;$('#next').disabled=true;}}
  boot();
})();
