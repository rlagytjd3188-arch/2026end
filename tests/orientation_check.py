"""Landscape rendering and rotation state, using the local server on port 4173."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT=Path('/tmp/recovery-orientation');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
 for build in ['', 'dist/RECOVERY44.html']:
  for w,h in [(390,844),(320,568)]:
   c=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,reduced_motion='reduce')
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:4173/'+build);page.wait_for_selector('.hero')
   assert page.locator('#orientation-guide').count()==0
   shell=page.locator('#app-shell')
   assert shell.evaluate('(el)=>Math.round(el.clientWidth)')==h
   assert shell.evaluate('(el)=>Math.round(el.clientHeight)')==w
   box=shell.bounding_box();assert abs(box['x'])<1 and abs(box['y'])<1 and abs(box['width']-w)<1 and abs(box['height']-h)<1
   # Native taps remain usable on the sideways scene.
   page.locator('[data-action="next"]').tap();page.wait_for_selector('[data-scene="beginning"]')
   # In portrait, a swipe along the sideways app's x axis is a physical vertical swipe.
   page.evaluate("""() => {
    const el=document.querySelector('.scene h2');const t=(x,y)=>new Touch({identifier:9,target:el,clientX:x,clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[t(150,400)]}));
    el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[t(150,200)]}));
   }""")
   page.wait_for_selector('[data-scene="research"]');page.locator('#previous').tap();page.wait_for_selector('[data-scene="beginning"]')
   page.set_viewport_size({'width':h,'height':w})
   assert shell.evaluate('(el)=>getComputedStyle(el).transform')=='none'
   page.wait_for_selector('[data-scene="beginning"]')
   assert page.locator('.split').evaluate('(el)=>getComputedStyle(el).display')=='grid'
   page.set_viewport_size({'width':w,'height':h})
   page.locator('#menu').tap();dialog=page.locator('#map-dialog');assert dialog.is_visible()
   d=dialog.bounding_box();assert d['x']>=-1 and d['y']>=-1 and d['x']+d['width']<=w+1 and d['y']+d['height']<=h+1,d
   if not build:page.screenshot(path=str(OUT/f'portrait-menu-{w}.png'))
   page.locator('#chapter-list a[href="#another-world"]').tap();page.wait_for_selector('.possibility')
   page.locator('[data-action="photo-next"]').tap();assert page.locator('.photo-position').inner_text()=='2 / 4'
   portrait_photo_height=page.locator('.visual img').evaluate('(im)=>im.clientHeight')
   page.set_viewport_size({'width':h,'height':w});assert page.locator('.photo-position').inner_text()=='2 / 4'
   assert page.locator('.visual img').evaluate('(im)=>im.clientHeight')==portrait_photo_height
   page.set_viewport_size({'width':w,'height':h});assert page.locator('.photo-position').inner_text()=='2 / 4'
   if not build:page.screenshot(path=str(OUT/f'portrait-content-{w}.png'))
   # Test a top-layer dialog and the result card while portrait is sideways.
   page.goto('http://127.0.0.1:4173/'+build+'#nepal');page.locator('[data-action="nepal"]').tap();assert page.locator('#carbon-dialog').is_visible();page.locator('#carbon-dialog [data-close]').tap()
   page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').tap()
   page.wait_for_function('document.querySelector("#result-card")?.getAttribute("aria-busy")==="false"')
   with page.expect_download():page.locator('[data-action="download"]').tap()
   page.set_viewport_size({'width':h,'height':w});page.wait_for_selector('#result-card')
   assert not errors,errors
   results.append({'viewport':f'{w}x{h} ↔ {h}x{w}','build':build or 'source','checks':'PASS'});c.close()
 # Desktop portrait/narrow windows are intentionally not rotated.
 c=b.new_context(viewport={'width':600,'height':900},has_touch=False)
 page=c.new_page();page.goto('http://127.0.0.1:4173/');page.wait_for_selector('.hero')
 assert page.locator('#app-shell').evaluate('(el)=>getComputedStyle(el).transform')=='none'
 c.close();b.close();print(json.dumps(results,ensure_ascii=False,indent=2))
