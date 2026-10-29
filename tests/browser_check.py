"""Run with Python Playwright and an existing local HTTP server on port 4173."""
import json, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path('/tmp/recovery-check'); OUT.mkdir(exist_ok=True)
scenes=json.loads((ROOT/'data/scenes.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 results=[]
 for name,w,h,mobile,reduced in [('desktop',1440,960,False,False),('mobile',390,844,True,False),('small-reduced',320,568,True,True)]:
  context=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=1,reduced_motion='reduce' if reduced else 'no-preference',accept_downloads=True)
  page=context.new_page();errors=[];bad=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:bad.append(r.url) if r.status>=400 else None)
  page.goto('http://127.0.0.1:4173');page.wait_for_selector('.hero');page.wait_for_function('document.fonts.status === "loaded"');page.wait_for_timeout(750);page.screenshot(path=str(OUT/f'{name}-opening.png'))
  assert page.locator('#previous').is_disabled()
  page.locator('[data-action="next"]').click()
  for i,s in enumerate(scenes[1:-1],1):
   page.wait_for_selector(f'[data-scene="{s["id"]}"]');page.wait_for_timeout(30 if reduced else 680)
   assert page.locator('.scene').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),(name,s['id'],'horizontal overflow')
   if s['source']:
    assert page.locator('.field-record').count()==1
    assert page.locator('.field-record p').inner_text()==s['detail']
   assert page.locator('[data-action="detail"]').count()==0
   for option in page.locator('[data-option]').all():
    option.click();assert option.get_attribute('aria-pressed')=='true'
   if s['kind']=='timeline':
    page.locator('[data-step="2"]').click();assert '위법성' in page.locator('.timeline-copy').inner_text()
   if s['kind']=='churches':
    page.wait_for_timeout(1100);assert page.locator('[data-counter]').inner_text()=='16'
    page.locator('[data-action="churches"]').click();page.wait_for_timeout(1100)
    assert page.locator('[data-counter]').inner_text()=='162';assert page.locator('.church-dots .on').count()==162
    page.locator('[data-action="churches"]').click();page.wait_for_timeout(1100)
    assert page.locator('[data-counter]').inner_text()=='16'
    page.locator('[data-action="churches"]').click();page.wait_for_timeout(1100)
   if s['kind']=='calendar':
    assert page.locator('.calendar-photo img').evaluate('(im)=>im.complete && im.naturalWidth==540')
    assert page.locator('[data-action="season"]').count()==0
    assert page.locator('.calendar-season').count()==0
   if s['kind'] in ['photo-gallery','possibility']:
    image=page.locator('.visual img');seen=[]
    for n in range(len(s['photos'])):
     seen.append(image.get_attribute('src'));page.locator('[data-action="photo-next"]').click()
    assert len(set(seen))==len(s['photos'])
    assert image.get_attribute('src')==seen[0]
   if s['kind']=='nepal':
    page.locator('[data-action="nepal"]').click();assert page.locator('#carbon-dialog').is_visible();assert '11.3t' in page.locator('#carbon-dialog').inner_text()
    page.keyboard.press('Tab');assert page.evaluate('document.activeElement.closest("#carbon-dialog")!==null')
    page.keyboard.press('Escape');assert not page.locator('#carbon-dialog').is_visible()
    assert page.locator('[data-action="nepal"]').evaluate('(el)=>el===document.activeElement')
   if s['kind']=='river':
    page.locator('[data-action="river"]').click();page.wait_for_timeout(1100)
    assert page.locator('[data-counter="20000"]').inner_text()=='20,000+'
    assert page.locator('[data-counter="620"]').inner_text()=='620'
    page.locator('[data-action="river"]').click();page.wait_for_timeout(1100)
    assert page.locator('[data-counter="20000"]').inner_text()=='0'
   if s['kind']=='film':
    strip=page.locator('.filmstrip');strip.evaluate('(el)=>el.scrollLeft=el.scrollWidth');assert strip.evaluate('(el)=>el.scrollLeft')>0
   if s['id'] in ['gadeok','churches','another-world','your-recovery']:
    page.locator('.scene').evaluate('(el)=>el.scrollTop=0');page.wait_for_timeout(750);page.screenshot(path=str(OUT/f'{name}-{s["id"]}.png'))
   # Back/forward preserves interaction state and works for every scene.
   if i<len(scenes)-2:
    page.locator('#next').click();page.locator('#previous').click();page.wait_for_selector(f'[data-scene="{s["id"]}"]');page.locator('#next').click()
  # Four genuinely distinct cards and PNG dimensions.
  downloads=[]
  for option in range(4):
   page.locator(f'[data-choice="{option}"]').click();page.wait_for_selector('#result-card');page.wait_for_timeout(800)
   with page.expect_download() as item:page.locator('[data-action="download"]').click()
   dest=OUT/f'{name}-card-{option}.png';item.value.save_as(dest)
   from PIL import Image
   assert Image.open(dest).size==(1080,1350)
   downloads.append(dest.read_bytes())
   if option==3:page.screenshot(path=str(OUT/f'{name}-result.png'))
   page.locator('[data-action="choose"]').click()
  assert len(set(downloads))==4
  # Clicking a focused native button with Space must not advance the scene twice.
  page.locator('[data-choice="0"]').focus();page.keyboard.press('Space');page.wait_for_selector('#result-card')
  page.locator('[data-action="restart"]').click();page.wait_for_selector('.hero')
  page.keyboard.press('ArrowRight');page.wait_for_selector('[data-scene="beginning"]')
  page.keyboard.press('ArrowLeft');page.wait_for_selector('.hero')
  # Real touch events for navigation, with vertical movement excluded.
  page.evaluate("""() => {
   const el=document.querySelector('.hero h1');const t=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
   el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t(260,220)]}));
   el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[t(60,225)]}));
  }""")
  page.wait_for_selector('[data-scene="beginning"]')
  page.locator('#menu').click();page.locator('#chapter-list a[href="#another-world"]').click();page.wait_for_selector('.possibility')
  assert not page.locator('#map-dialog').is_visible()
  assert not errors,(name,errors);assert not bad,(name,bad)
  results.append({'viewport':name,'scenes':len(scenes),'cards':4,'console_errors':errors,'failed_requests':bad,'checks':'PASS'})
  context.close()
 # Failure states: data and photo errors produce readable recoverable UI.
 c=browser.new_context();page=c.new_page();page.route('**/data/scenes.json',lambda route:route.fulfill(status=503,body='unavailable'));page.goto('http://127.0.0.1:4173');page.wait_for_selector('#retry');page.unroute('**/data/scenes.json');page.locator('#retry').click();page.wait_for_selector('.hero');c.close()
 c=browser.new_context();page=c.new_page();page.route('**/*.webp',lambda route:route.fulfill(status=404,body='missing'));page.goto('http://127.0.0.1:4173');page.wait_for_selector('.photo-failed');assert '불러올 수 없습니다' in page.locator('.hero-image').get_attribute('alt');c.close()
 browser.close();print(json.dumps(results,ensure_ascii=False,indent=2))
