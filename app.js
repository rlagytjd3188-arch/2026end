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
  let customPhoto = null, photoRequest = 0, photoLoading = false, cardRender = 0, cardTask = null;
  const UPLOAD_URL='https://recovery44-upload.kh3188.workers.dev/';
  const MAX_PHOTO_BYTES=15*1024*1024;
  let heicDecoderTask=null,uploadBusy=false,uploadConsent=false,uploadError='',uploadStage='',uploadReceipt=null;
  let uploadAttempt=null,uploadRun=0,uploadRetrying=false,consentRequest=null;
  const photoPointers=new Map();
  let photoGesture=null,photoPreviewFrame=0,photoGestureChanged=false;
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
      case 'river': html=`<img class="full-photo" src="${s.image || path(s.photos[0])}" alt="기후정의행진 사진"><div class="river-content"><div class="river-heading">${head(s)}</div><div class="river-action">${button('행진 참여 규모 보기','river')}<svg class="river-lines" viewBox="0 0 900 120" role="img" aria-label="작은 물줄기가 하나의 강으로 연결되는 모습">${[5,25,45,65,85,105].map((y,i)=>`<path d="M0 ${y} C200 ${y} 200 60 430 60 S700 ${i%2?45:75} 900 60"/>`).join('')}</svg><div class="river-stats"><div><strong data-counter="20000">0</strong><small>명을 넘는 시민</small></div><div><strong data-counter="620">0</strong><small>개 시민사회단체</small></div></div><p class="response" aria-live="polite"></p></div>${detail(s)}</div>`;break;
      case 'possibility': html=`<div class="split"><div>${head(s)}${button('다음 사진 보기','photo-next')}<p class="photo-position" aria-live="polite"></p>${detail(s)}</div>${photo(s)}</div>`;break;
      case 'memory': html=`<span class="eyebrow">PART 06 / 2026 활동 기록</span><h2 tabindex="-1">${escape(s.title)}</h2><div class="memory-word">RECOVERY<span class="accent">.</span></div><img class="memory-photo" src="${path(s.photos[0])}" alt="풍천리 주민 연대 현장">${chips(s.labels)}<p class="copy">${escape(s.copy)}</p>${detail(s)}`;break;
      case 'choices': html=`<div class="choices-layout"><div>${head(s)}<span class="eyebrow">YOUR NEXT STEP ↗</span><p class="copy">한 가지 마음을 골라\n나만의 회복 카드를 남겨보세요.</p></div><div class="choices-list">${choices.map((c,i)=>`<button class="choice" data-choice="${i}"><span class="choice-num">0${i+1}</span><span><b>${c.title}</b><small>${c.description}</small></span><span class="choice-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div>`;break;
      case 'result': html=`<div class="result-layout"><div>${head(s)}<fieldset class="photo-tools"><legend>내 사진으로 회복 카드 만들기</legend><div class="photo-buttons">${button('사진 찍기','camera')}${button('사진 선택하기','pick-photo')}${button('기본 사진으로 돌아가기','reset-photo','text-link')}</div><input type="file" id="camera-photo" accept="image/*" capture="environment" hidden><input type="file" id="choose-photo" accept="image/*" hidden><p id="photo-error" class="photo-error" role="alert" hidden></p><div class="photo-position-controls photo-edit-controls" hidden><p id="photo-edit-help">카드의 사진을 끌어 위치를 맞추세요. 휴대폰은 두 손가락으로, PC는 마우스 휠이나 아래 버튼으로 확대·축소할 수 있습니다.</p><div class="photo-zoom-buttons"><button type="button" class="secondary" data-action="zoom-out" aria-label="사진 축소">−</button><output id="photo-zoom-level" aria-label="사진 확대 비율">100%</output><button type="button" class="secondary" data-action="zoom-in" aria-label="사진 확대">+</button>${button('원래대로','reset-view','text-link')}</div></div><p id="photo-status" role="status">기본 사진을 사용하고 있습니다.</p></fieldset><div class="result-actions">${button('나의 회복 카드 저장 및 보내기','download')}${button('카드 공유하기','share','secondary')}</div><section class="card-upload" aria-label="회복 카드 전송 상태" hidden><p id="upload-status" role="status" aria-live="polite"></p><p id="upload-error-detail" role="alert" hidden></p>${button('다시 시도','retry-upload')}<figure id="uploaded-card" hidden><img alt="Dropbox에 전송한 회복 카드"><figcaption>전송을 완료한 카드</figcaption></figure></section>${button('다른 회복 선택하기','choose','text-link')}${button('처음부터 다시 걷기','restart','text-link')}<p class="source">기독교환경운동연대 44주년 · RECOVERY 44</p></div><div><canvas class="result-card" id="result-card" width="1080" height="1350" role="img" aria-label="선택한 회복의 결과 카드"></canvas><p class="result-caption">MY RECOVERY · 2026<br>당신의 마음이 다음 회복의 시작입니다.</p></div></div>`;break;
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
    cancelPhotoEditing();const previous=index;index=n;frame++;
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
  function enableDrag(strip){let drag=null;strip.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;drag={x:matchMedia('(orientation: portrait) and (max-width: 767px) and (any-pointer: coarse)').matches?e.clientY:e.clientX,left:strip.scrollLeft};strip.setPointerCapture(e.pointerId);});strip.addEventListener('pointermove',e=>{if(drag)strip.scrollLeft=drag.left-((matchMedia('(orientation: portrait) and (max-width: 767px) and (any-pointer: coarse)').matches?e.clientY:e.clientX)-drag.x);});const stop=()=>drag=null;strip.addEventListener('pointerup',stop);strip.addEventListener('pointercancel',stop);}
  function notify(message){$('#toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',4500);}
  function updatePhotoControls(){
    const controls=$('.photo-position-controls'),status=$('#photo-status');
    if(!status)return;
    controls.hidden=!customPhoto;
    const canvas=$('#result-card');
    canvas?.classList.toggle('photo-editable',!!customPhoto);
    if(canvas){canvas.tabIndex=customPhoto?0:-1;canvas.setAttribute('aria-disabled',String(uploadBusy||photoLoading));if(customPhoto)canvas.setAttribute('aria-describedby','photo-edit-help');else canvas.removeAttribute('aria-describedby');}
    if(customPhoto)$('#photo-zoom-level').textContent=`${Math.round(customPhoto.zoom*100)}%`;
    $('[data-action="zoom-in"]').disabled=uploadBusy||photoLoading||!customPhoto||customPhoto.zoom>=4;
    $('[data-action="zoom-out"]').disabled=uploadBusy||photoLoading||!customPhoto||customPhoto.zoom<=minimumPhotoZoom()+.000001;
    $('[data-action="reset-view"]').disabled=uploadBusy||photoLoading;
    $('[data-action="reset-photo"]').hidden=!customPhoto&&!photoLoading;
    status.textContent=photoLoading?'사진을 불러오고 있습니다.':customPhoto?'내 사진을 적용했습니다. 카드에서 사진을 직접 움직여 구도를 맞춰주세요.':'기본 사진을 사용하고 있습니다.';
    story.querySelectorAll('[data-action="download"],[data-action="share"]').forEach(b=>b.disabled=photoLoading||!!cardTask||uploadBusy||photoPointers.size>0||!!photoPreviewFrame);
    $('#result-card')?.setAttribute('aria-busy',String(photoLoading||!!cardTask));
    story.querySelectorAll('[data-action="camera"],[data-action="pick-photo"],[data-action="reset-photo"],[data-action="choose"],[data-action="restart"],.photo-position-controls input').forEach(el=>el.disabled=uploadBusy);
    updateUploadControls();
  }
  function clearPhoto(){
    cancelPhotoEditing();resetUploadState();photoRequest++;photoLoading=false;
    if(customPhoto)URL.revokeObjectURL(customPhoto.url);
    customPhoto=null;cardBlob=null;
  }
  function photoError(message){const el=$('#photo-error');if(el){el.hidden=!message;el.textContent=message;}if(message)notify(message);}
  function loadHeicDecoder(){
    if(window.HeicTo)return Promise.resolve(window.HeicTo);
    if(!heicDecoderTask)heicDecoderTask=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='assets/vendor/heic-to-1.6.7.js';
      script.onload=()=>window.HeicTo?resolve(window.HeicTo):reject(new Error('HEIC 변환기를 불러오지 못했습니다.'));
      script.onerror=()=>{script.remove();heicDecoderTask=null;reject(new Error('HEIC 변환기를 불러오지 못했습니다. 잠시 후 다시 선택해주세요.'));};
      document.head.append(script);
    });
    return heicDecoderTask;
  }
  async function usePhoto(file){
    if(!file||uploadBusy)return;
    cancelPhotoEditing();resetUploadState();
    if(file.size>MAX_PHOTO_BYTES){photoError('사진은 최대 15MB까지 선택할 수 있습니다.');return;}
    const allowed=/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)||/^image\/(jpeg|png|webp|hei[cf](?:-sequence)?)$/i.test(file.type);
    if(!allowed){photoError('JPG/JPEG, PNG, WEBP, HEIC/HEIF 사진 1장을 선택해주세요.');return;}
    photoError('');
    const request=++photoRequest,image=new Image();let url=URL.createObjectURL(file);
    photoLoading=true;updatePhotoControls();
    try{
      image.src=url;
      try{await image.decode();}catch(error){
        if(!/\.(heic|heif)$/i.test(file.name)&&!/^image\/hei[cf]/i.test(file.type))throw error;
        const convert=await loadHeicDecoder();
        const converted=await convert({blob:file,type:'image/jpeg',quality:.94});
        if(request!==photoRequest){URL.revokeObjectURL(url);return;}
        URL.revokeObjectURL(url);url=URL.createObjectURL(converted);image.src=url;await image.decode();
      }
      if(request!==photoRequest){URL.revokeObjectURL(url);return;}
      if(customPhoto)URL.revokeObjectURL(customPhoto.url);
      customPhoto={image,url,panX:0,panY:0,zoom:1};photoLoading=false;cardBlob=null;
      if($('#result-card'))await drawCard();
    }catch(error){
      URL.revokeObjectURL(url);
      if(request===photoRequest){photoLoading=false;photoError(error.message?.startsWith('HEIC 변환기')?error.message:'사진을 열 수 없습니다. JPG/JPEG, PNG, WEBP 또는 다른 HEIC/HEIF 사진을 선택해주세요.');}
    }finally{if(request===photoRequest)updatePhotoControls();}
  }
  function drawCard(encode=true){
    resetUploadState();const run=++cardRender;cardBlob=null;
    const task=renderCard(run,encode).finally(()=>{if(cardTask===task){cardTask=null;updatePhotoControls();}});
    cardTask=task;updatePhotoControls();return task;
  }
  async function renderCard(run,encode=true){const canvas=$('#result-card');if(!canvas||!chosen)return;const requestFrame=frame,personal=customPhoto;const g=canvas.getContext('2d');const c=chosen;canvas.setAttribute('aria-label',`MY RECOVERY 2026. 나는 ${c.title}을 이어가겠습니다.`);g.fillStyle='#08140f';g.fillRect(0,0,1080,1350);
    let im=personal?.image;try{if(!im){im=new Image();im.src=path(c.photo);await im.decode();}}catch{notify('사진을 불러오지 못해 그래픽 카드로 만듭니다.');}
    await document.fonts.ready;if(run!==cardRender||requestFrame!==frame||!canvas.isConnected)return;
    if(im?.naturalWidth){const view=photoGeometry(personal,im);g.save();g.beginPath();g.rect(0,0,1080,900);g.clip();g.drawImage(im,view.x,view.y,view.w,view.h);g.restore();}
    const grad=g.createLinearGradient(0,0,0,850);grad.addColorStop(0,'#08140f18');grad.addColorStop(.4,'#08140f44');grad.addColorStop(1,'#08140f');g.fillStyle=grad;g.fillRect(0,0,1080,900);
    g.strokeStyle=c.color;g.lineWidth=2;g.strokeRect(45,45,990,1260);g.fillStyle=c.color;g.font='700 24px Recovery, sans-serif';g.fillText('MY RECOVERY',80,105);g.textAlign='right';g.fillText('2026 / 44 YEARS',1000,105);g.textAlign='left';
    // Align each mark’s vertical center to the justice mark; keep every x coordinate and shape unchanged.
    const markOffsetY={터전:1,정의:0,연결:-14,전환:16}[c.key];
    g.save();g.translate(0,markOffsetY);
    g.strokeStyle=c.color;g.lineWidth=3;for(let i=0;i<5;i++){g.beginPath();if(c.key==='터전'){g.moveTo(790+i*30,580);g.lineTo(790+i*30,450-i*15);g.lineTo(765+i*30,490-i*15);}else if(c.key==='정의'){g.moveTo(740,440+i*25);g.bezierCurveTo(850,400+i*30,900,540-i*10,990,460+i*20);}else if(c.key==='연결'){g.arc(840+i*20,500,45,0,Math.PI*2);}else {g.moveTo(760+i*35,570);g.lineTo(760+i*35,450-i*20);}g.stroke();}
    g.restore();
    g.fillStyle='#f1eee4';g.font='400 30px Recovery, sans-serif';g.fillText('나는',80,790);g.fillStyle=c.color;g.font='700 67px Recovery, sans-serif';c.short.split('\n').forEach((line,i)=>g.fillText(line,80,890+i*90));g.fillStyle='#f1eee4';g.font='400 30px Recovery, sans-serif';g.fillText('을 이어가겠습니다.',80,1055);g.fillStyle='#f1eee4';g.font='900 100px Arial, sans-serif';g.fillText('RECOVERY 44',74,1210);g.font='400 23px Recovery, sans-serif';g.fillStyle='#c0c7b9';g.fillText('기독교환경운동연대 · 함께 걸어온 회복의 시간',80,1260);
    if(!encode)return;
    try{const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 생성 실패')),'image/png'));if(run===cardRender&&requestFrame===frame&&canvas.isConnected)cardBlob=blob;}catch{if(run===cardRender)notify('카드를 만들지 못했습니다. 다시 선택한 뒤 시도해주세요.');}
  }
  async function getCard(){if(photoLoading)throw new Error('사진을 불러오는 중입니다. 잠시 후 저장해주세요.');if(!cardBlob){await (cardTask||drawCard());}if(!cardBlob)throw new Error('카드를 아직 만들지 못했습니다. 잠시 후 다시 시도해주세요.');return cardBlob;}
  function resetUploadState(){
    uploadRun++;uploadAttempt=null;uploadBusy=false;uploadRetrying=false;uploadConsent=false;uploadError='';uploadStage='';
    if(uploadReceipt)URL.revokeObjectURL(uploadReceipt.url);uploadReceipt=null;
    updateUploadControls();
  }
  function downloadBlob(blob,key){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`RECOVERY44_${key}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function askConsent(action){
    if(uploadBusy||photoLoading||cardTask||photoPointers.size||photoPreviewFrame)return;
    const snapshot=action==='retry'?uploadAttempt:{blob:cardBlob,key:chosen?.key,version:cardRender};
    if(!snapshot?.blob||snapshot.version!==cardRender){notify('카드를 아직 만들지 못했습니다. 잠시 후 다시 시도해주세요.');return;}
    if(snapshot.blob.size>MAX_PHOTO_BYTES){notify('완성 카드는 최대 15MB까지 저장·전송할 수 있습니다.');return;}
    consentRequest={action,snapshot};const dialog=$('#consent-dialog');dialog.returnValue='';
    $('#consent-description').textContent=action==='share'?'완성 회복 카드를 기기의 공유 기능으로 전달합니다. 공유를 지원하지 않으면 PNG를 기기에 저장합니다. 동의하지 않으면 공유하거나 저장하지 않습니다.':'회복 카드를 이 기기에 저장하고 기독교환경운동연대에게 전송,보관하는데 동의하시나요?';
    $('#consent-accept').textContent=action==='share'?'동의하고 공유하기':action==='retry'?'동의하고 다시 보내기':'동의하고 저장·보내기';
    openDialog(dialog,document.activeElement);
  }
  function download(){askConsent('save-send');}
  function share(){askConsent('share');}
  async function shareSnapshot(snapshot){
    try{
      const file=new File([snapshot.blob],`RECOVERY44_${snapshot.key}.png`,{type:'image/png'});
      if(navigator.canShare?.({files:[file]})&&navigator.share)await navigator.share({files:[file],title:'MY RECOVERY · 2026'});
      else{downloadBlob(snapshot.blob,snapshot.key);notify('이 브라우저에서는 파일 공유 대신 PNG 저장을 제공합니다.');}
    }catch(error){if(error.name!=='AbortError')notify('공유하지 못했습니다. 다시 시도해주세요.');}
  }
  function updateUploadControls(){
    const panel=$('.card-upload');if(!panel)return;
    panel.hidden=!uploadBusy&&!uploadError&&!uploadReceipt;
    const status=$('#upload-status');status.textContent=uploadBusy?uploadStage:uploadError?'사진을 전송하지 못했습니다.':uploadReceipt?'전송 완료 ✓':'';
    status.classList.toggle('is-error',!!uploadError);
    const detail=$('#upload-error-detail');detail.hidden=!uploadError;detail.textContent=uploadError;
    const retry=$('[data-action="retry-upload"]');retry.hidden=!uploadAttempt||(!uploadError&&!uploadRetrying);
    retry.disabled=uploadBusy||photoLoading||!!cardTask||photoPointers.size>0||!!photoPreviewFrame;retry.textContent=uploadBusy&&uploadRetrying?'다시 전송하는 중입니다…':'다시 시도';
    const receipt=$('#uploaded-card');receipt.hidden=!uploadReceipt;
    if(uploadReceipt){$('img',receipt).src=uploadReceipt.url;$('img',receipt).alt=`Dropbox에 전송한 ${uploadReceipt.key} 회복 카드`;}
    panel.setAttribute('aria-busy',String(uploadBusy));
  }
  async function transmitAttempt(attempt,retry=false){
    if(uploadBusy||!uploadConsent||!attempt||attempt!==uploadAttempt||attempt.version!==cardRender)return;
    uploadBusy=true;uploadRetrying=retry;uploadError='';uploadStage=retry?'다시 전송하는 중입니다…':'완성 카드를 전송 중입니다…';
    const run=++uploadRun;updatePhotoControls();let timeout;
    try{
      // Retry reuses this exact Blob; do not call getCard/drawCard here.
      const file=new File([attempt.blob],'RECOVERY44_card.png',{type:'image/png'});
      const form=new FormData();form.append('file',file);
      const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),90000);
      const response=await fetch(UPLOAD_URL,{method:'POST',body:form,credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.ok!==true){
        const error=typeof data?.error==='string'?data.error:data?.error?.message;
        throw new Error(error||(data?.error?JSON.stringify(data.error):`사진 전송에 실패했습니다. (HTTP ${response.status})`));
      }
      if(run!==uploadRun)return;
      if(uploadReceipt)URL.revokeObjectURL(uploadReceipt.url);
      uploadReceipt={url:URL.createObjectURL(attempt.blob),key:attempt.key};uploadAttempt=null;uploadConsent=false;
    }catch(error){
      if(run===uploadRun)uploadError=error.name==='AbortError'?'서버 응답 시간이 길어 전송 결과를 확인하지 못했습니다.':error instanceof TypeError?'인터넷 연결을 확인한 뒤 다시 시도해주세요.':error.message;
    }finally{
      clearTimeout(timeout);
      if(run===uploadRun){uploadBusy=false;uploadRetrying=false;updatePhotoControls();}
    }
  }
  function retryUpload(){
    if(uploadBusy||photoLoading||cardTask||photoPointers.size||photoPreviewFrame||!uploadAttempt)return;
    if(!uploadConsent){askConsent('retry');return;}
    transmitAttempt(uploadAttempt,true);
  }
  $('#consent-decline').onclick=()=>$('#consent-dialog').close('declined');
  $('#consent-dialog').addEventListener('close',()=>{if($('#consent-dialog').returnValue!=='accepted')uploadConsent=false;consentRequest=null;});
  $('#consent-accept').onclick=()=>{
    const request=consentRequest;$('#consent-dialog').close('accepted');consentRequest=null;
    if(!request||request.snapshot.version!==cardRender||uploadBusy){notify('카드가 변경되었습니다. 다시 눌러주세요.');return;}
    if(request.action==='share'){shareSnapshot(request.snapshot);return;}
    uploadConsent=true;
    if(request.action==='retry'){transmitAttempt(uploadAttempt,true);return;}
    uploadAttempt=request.snapshot;
    downloadBlob(request.snapshot.blob,request.snapshot.key);
    transmitAttempt(uploadAttempt);
  };
  story.addEventListener('change',e=>{
    if(['camera-photo','choose-photo'].includes(e.target.id)){const file=e.target.files?.[0];e.target.value='';usePhoto(file);}

  });
  function minimumPhotoZoom(){const im=customPhoto.image;return Math.min(1080/im.naturalWidth,900/im.naturalHeight)/Math.max(1080/im.naturalWidth,900/im.naturalHeight);}
  function photoGeometry(photo=customPhoto,image=photo?.image){
    const base=Math.max(1080/image.naturalWidth,900/image.naturalHeight),scale=base*(photo?.zoom||1);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    const rangeX=Math.abs(w-1080)/2,rangeY=Math.abs(h-900)/2;
    const panX=Math.max(-rangeX,Math.min(rangeX,photo?.panX||0));
    const panY=Math.max(-rangeY,Math.min(rangeY,photo?.panY||0));
    return {base,scale,w,h,panX,panY,x:(1080-w)/2+panX,y:(900-h)/2+panY};
  }
  function cancelPhotoEditing(){
    photoPointers.clear();photoGesture=null;photoGestureChanged=false;
    if(photoPreviewFrame)cancelAnimationFrame(photoPreviewFrame);photoPreviewFrame=0;
  }
  function cardPoint(point){
    const r=$('#result-card').getBoundingClientRect();
    const rotated=matchMedia('(orientation: portrait) and (max-width: 767px) and (any-pointer: coarse)').matches;
    return rotated?{x:(point.clientY-r.top)/r.height*1080,y:(r.right-point.clientX)/r.width*1350}:{x:(point.clientX-r.left)/r.width*1080,y:(point.clientY-r.top)/r.height*1350};
  }
  function normalizePhoto(){const view=photoGeometry();customPhoto.panX=view.panX;customPhoto.panY=view.panY;}
  function refreshPhoto(preview=false){
    normalizePhoto();resetUploadState();cardBlob=null;
    if(preview){
      if(!photoPreviewFrame)photoPreviewFrame=requestAnimationFrame(()=>{photoPreviewFrame=0;if(customPhoto&&$('#result-card'))drawCard(false);});
      updatePhotoControls();
    }else{
      if(photoPreviewFrame)cancelAnimationFrame(photoPreviewFrame);photoPreviewFrame=0;drawCard();
    }
  }
  function zoomPhoto(factor,anchor={x:540,y:450}){
    if(!customPhoto||uploadBusy||photoLoading)return;
    const view=photoGeometry(),zoom=Math.max(minimumPhotoZoom(),Math.min(4,customPhoto.zoom*factor));
    if(zoom===customPhoto.zoom)return;
    const ix=(anchor.x-view.x)/view.scale,iy=(anchor.y-view.y)/view.scale,scale=view.base*zoom;
    customPhoto.zoom=zoom;
    customPhoto.panX=anchor.x-ix*scale-(1080-customPhoto.image.naturalWidth*scale)/2;
    customPhoto.panY=anchor.y-iy*scale-(900-customPhoto.image.naturalHeight*scale)/2;
    refreshPhoto();
  }
  function rebasePhotoGesture(){
    const points=[...photoPointers.values()],view=photoGeometry();
    if(points.length===1)photoGesture={point:points[0],panX:view.panX,panY:view.panY};
    else if(points.length===2){
      const mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};
      photoGesture={distance:Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)),zoom:customPhoto.zoom,imageX:(mid.x-view.x)/view.scale,imageY:(mid.y-view.y)/view.scale};
    }else photoGesture=null;
  }
  story.addEventListener('pointerdown',e=>{
    if(e.target.id!=='result-card'||!customPhoto||uploadBusy||photoLoading||e.button!==0||photoPointers.size>=2)return;
    const point=cardPoint(e);if(point.y<0||point.y>900||point.x<0||point.x>1080)return;
    e.preventDefault();if(!photoPointers.size)photoGestureChanged=false;e.target.focus({preventScroll:true});e.target.setPointerCapture(e.pointerId);photoPointers.set(e.pointerId,point);rebasePhotoGesture();updatePhotoControls();
  });
  story.addEventListener('pointermove',e=>{
    if(!customPhoto||uploadBusy||photoLoading||!photoPointers.has(e.pointerId)||!photoGesture)return;
    e.preventDefault();const before={panX:customPhoto.panX,panY:customPhoto.panY,zoom:customPhoto.zoom};photoPointers.set(e.pointerId,cardPoint(e));const points=[...photoPointers.values()];
    if(points.length===1){customPhoto.panX=photoGesture.panX+points[0].x-photoGesture.point.x;customPhoto.panY=photoGesture.panY+points[0].y-photoGesture.point.y;}
    else{
      const mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};
      customPhoto.zoom=Math.max(minimumPhotoZoom(),Math.min(4,photoGesture.zoom*Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)/photoGesture.distance));
      const base=Math.max(1080/customPhoto.image.naturalWidth,900/customPhoto.image.naturalHeight),scale=base*customPhoto.zoom;
      customPhoto.panX=mid.x-photoGesture.imageX*scale-(1080-customPhoto.image.naturalWidth*scale)/2;
      customPhoto.panY=mid.y-photoGesture.imageY*scale-(900-customPhoto.image.naturalHeight*scale)/2;
    }
    normalizePhoto();
    if(Math.abs(customPhoto.panX-before.panX)>.001||Math.abs(customPhoto.panY-before.panY)>.001||Math.abs(customPhoto.zoom-before.zoom)>.0001){photoGestureChanged=true;refreshPhoto(true);}
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])story.addEventListener(event,e=>{
    if(!photoPointers.delete(e.pointerId)||!customPhoto)return;
    if(photoPointers.size)rebasePhotoGesture();else{photoGesture=null;if(photoGestureChanged)refreshPhoto();else updatePhotoControls();}
  });
  story.addEventListener('wheel',e=>{
    if(e.target.id!=='result-card'||!customPhoto||uploadBusy||photoLoading)return;
    const point=cardPoint(e);if(point.y<0||point.y>900)return;
    e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?600:1);zoomPhoto(Math.exp(-delta*.0015),point);
  },{passive:false});
  story.addEventListener('keydown',e=>{
    if(e.target.id!=='result-card'||!customPhoto||uploadBusy||photoLoading||e.ctrlKey||e.metaKey)return;
    const step=e.shiftKey?50:10;
    if(['+','=','-','_'].includes(e.key)){e.preventDefault();e.stopPropagation();zoomPhoto(['+','='].includes(e.key)?1.1:1/1.1);return;}
    if(e.key==='ArrowLeft')customPhoto.panX-=step;else if(e.key==='ArrowRight')customPhoto.panX+=step;
    else if(e.key==='ArrowUp')customPhoto.panY-=step;else if(e.key==='ArrowDown')customPhoto.panY+=step;
    else if(e.key==='Home'){customPhoto.zoom=1;customPhoto.panX=0;customPhoto.panY=0;}else return;
    e.preventDefault();e.stopPropagation();refreshPhoto();
  });
  const actions={'zoom-in':()=>zoomPhoto(1.2),'zoom-out':()=>zoomPhoto(1/1.2),'reset-view':()=>{if(customPhoto&&!uploadBusy){customPhoto.zoom=1;customPhoto.panX=0;customPhoto.panY=0;refreshPhoto();}},'retry-upload':retryUpload,camera:()=>$('#camera-photo').click(),'pick-photo':()=>$('#choose-photo').click(),'reset-photo':()=>{clearPhoto();drawCard();},next:()=>show(index+1,{focus:true}),churches:()=>churches(),'photo-next':()=>nextPhoto(),nepal:()=>nepal(),river:()=>river(),download,share,choose:()=>show(sceneNumber('your-recovery'),{focus:true}),restart:()=>{clearPhoto();cardRender++;chosen=null;cardBlob=null;state.clear();show(0,{focus:true});}};
  story.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;if(uploadBusy&&(['camera','pick-photo','reset-photo','choose','restart'].includes(target.dataset.action)||target.dataset.choice!==undefined))return;if(target.dataset.action)actions[target.dataset.action]?.();if(target.dataset.option!==undefined)selectOption(+target.dataset.option);if(target.dataset.choice!==undefined){chosen=choices[+target.dataset.choice];show(sceneNumber('my-recovery'),{focus:true});}});
  story.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.classList.add('photo-failed');e.target.alt='이미지를 불러올 수 없습니다. '+e.target.alt;}},true);
  $('#previous').onclick=()=>show(index-1,{focus:true});$('#next').onclick=()=>show(index+1,{focus:true});
  function openDialog(dialog,opener){dialog._opener=opener;dialog.showModal();}
  $('#menu').onclick=()=>openDialog($('#map-dialog'),$('#menu'));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>d._opener?.focus({preventScroll:true})));
  document.addEventListener('keydown',e=>{const d=document.querySelector('dialog[open]');if(!d||e.key!=='Tab')return;const items=[...d.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')];if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!d.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!d.contains(document.activeElement))){e.preventDefault();first.focus();}});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.altKey||e.ctrlKey||e.metaKey)return;if(e.target.closest('input,textarea,select,.filmstrip,#result-card'))return;const interactive=e.target.closest('button,a');if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();if(e.key==='ArrowRight'&&index<sceneNumber('your-recovery'))show(index+1,{focus:true});else if(e.key==='ArrowLeft')show(index-1,{focus:true});}else if(e.code==='Space'&&!interactive&&index<sceneNumber('your-recovery')){e.preventDefault();show(index+1,{focus:true});}});
  let touch=null;
  const touchDelta=(t,point)=>{
    const x=point.clientX-t.x,y=point.clientY-t.y;
    return t.rotated?{x:y,y:-x}:{x,y};
  };
  document.addEventListener('touchstart',e=>{
    if(e.target.id==='result-card'&&customPhoto&&cardPoint(e.touches[0]).y<=900){touch=null;return;}
    if(e.touches.length!==1||e.target.closest('input,label')){touch=null;return;}
    const point=e.touches[0],scene=e.target.closest('.scene,dialog');if(!scene)return;
    touch={x:point.clientX,y:point.clientY,lastY:0,axis:null,scene,
      noNavigation:!!e.target.closest('dialog,button,a,.filmstrip,#result-card'),
      rotated:matchMedia('(orientation: portrait) and (max-width: 767px) and (any-pointer: coarse)').matches};
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!touch||e.touches.length!==1)return;
    const delta=touchDelta(touch,e.touches[0]);
    if(!touch.axis){
      if(Math.abs(delta.y)>8&&Math.abs(delta.y)>Math.abs(delta.x)*1.15)touch.axis='vertical';
      else if(Math.abs(delta.x)>8&&Math.abs(delta.x)>Math.abs(delta.y)*1.15)touch.axis='horizontal';
    }
    if(touch.axis==='vertical'){
      if(e.cancelable)e.preventDefault();
      touch.scene.scrollTop-=delta.y-touch.lastY;
    }else if(touch.axis==='horizontal'&&!touch.noNavigation&&e.cancelable)e.preventDefault();
    touch.lastY=delta.y;
  },{passive:false});
  document.addEventListener('touchend',e=>{
    if(!touch)return;const gesture=touch;touch=null;
    if(gesture.axis==='vertical'||gesture.noNavigation)return;
    const delta=touchDelta(gesture,e.changedTouches[0]);
    if(Math.abs(delta.x)>65&&Math.abs(delta.x)>Math.abs(delta.y)*1.5){
      if(delta.x<0&&index<sceneNumber('your-recovery'))show(index+1,{focus:true});
      if(delta.x>0)show(index-1,{focus:true});
    }
  },{passive:true});
  document.addEventListener('touchcancel',()=>touch=null,{passive:true});
  window.addEventListener('hashchange',()=>{const n=scenes.findIndex(s=>'#'+s.id===(location.hash==='#walking-again'?'#walking':location.hash==='#we-are-trees'?'#forest-voices':location.hash));if(n>=0&&n!==index)show(n,{hash:false});});
  async function boot(){try{const res=await fetch('data/scenes.json');if(!res.ok)throw new Error('기록 응답 오류');scenes=await res.json();$('#chapter-list').innerHTML=['opening','beginning','no-nukes','conversion','nepal','another-world','recovery','your-recovery'].map(sceneNumber).map(i=>`<a href="#${scenes[i].id}" data-chapter="${i}"><span>${i===0?'START':scenes[i].kind==='choices'?'YOU':`PART ${String(scenes[i].part).padStart(2,'0')}`}</span>${i===0?'올해 돌아보기':scenes[i].kind==='choices'?'나의 회복 남기기':parts[scenes[i].part]}</a>`).join('');$('#chapter-list').addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();$('#map-dialog').close();show(+a.dataset.chapter,{focus:true});}});const n=scenes.findIndex(s=>'#'+s.id===(location.hash==='#walking-again'?'#walking':location.hash==='#we-are-trees'?'#forest-voices':location.hash));show(n<0?0:n);}catch{story.innerHTML='<section class="error-panel"><h1>기록을 불러오지 못했습니다.</h1><p>인터넷 연결을 확인한 뒤 새로고침해주세요. 파일을 직접 여셨다면 README의 로컬 서버 실행 방법을 이용해주세요.</p><button class="primary" id="retry">다시 불러오기</button></section>';$('#retry').onclick=boot;$('#previous').disabled=true;$('#next').disabled=true;}}
  boot();
})();
