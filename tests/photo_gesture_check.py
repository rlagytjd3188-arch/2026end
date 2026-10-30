"""Direct photo manipulation with real touch/mouse events; no production calls."""
import json,pathlib,tempfile
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright

def ready(page):page.wait_for_function('document.querySelector("#result-card").getAttribute("aria-busy")==="false" && !document.querySelector("[data-action=download]").disabled')
def image(page):return page.locator('#result-card').evaluate('(c)=>c.toDataURL()')
def location(page,x,y,rotated):
    r=page.locator('#result-card').bounding_box()
    return {'x':r['x']+r['width']*(1-y/1350),'y':r['y']+r['height']*x/1080} if rotated else {'x':r['x']+r['width']*x/1080,'y':r['y']+r['height']*y/1350}

def touch_move(page,cdp,points,rotated):
    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[dict(location(page,x,y,rotated),id=i) for i,x,y in points]})

with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    source=Image.new('RGB',(800,1600));d=ImageDraw.Draw(source)
    for y in range(0,1600,80):
      for x in range(0,800,80):d.rectangle((x,y,x+79,y+79),fill=(x%230+20,y%230+20,(x+y)%230+20))
    path=pathlib.Path(tmp)/'grid.png';source.save(path)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(1440,960),(844,390),(568,320),(390,844),(320,568)]:
      for build in ['', 'dist/RECOVERY44.html']:
        c=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=True,reduced_motion='reduce');page=c.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script('window.__encodes=0;const encode=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(...args){window.__encodes++;return encode.apply(this,args);};')
        page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
        page.locator('#choose-photo').set_input_files(path);ready(page)
        canvas=page.locator('#result-card');canvas.scroll_into_view_if_needed();rotated=h>w and w<768
        assert page.locator('#photo-horizontal,#photo-vertical').count()==0
        assert canvas.evaluate('(c)=>getComputedStyle(c).touchAction')=='none'
        original=image(page);before=page.locator('.scene').evaluate('(e)=>e.scrollTop');encodes=page.evaluate('window.__encodes')
        canvas.tap();ready(page);assert image(page)==original and page.evaluate('window.__encodes')==encodes
        cdp=c.new_cdp_session(page);start=location(page,540,400,rotated)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[dict(start,id=1)]})
        for dy in [30,60,90,120,150]:touch_move(page,cdp,[(1,540,400+dy)],rotated)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready(page)
        assert image(page)!=original
        assert page.locator('.scene').evaluate('(e)=>e.scrollTop')==before
        assert page.evaluate('window.__encodes')==encodes+1
        # Two-finger zoom, including the sideways portrait display.
        points=[dict(location(page,430,400,rotated),id=1),dict(location(page,650,400,rotated),id=2)]
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        for spread in [20,40,70,100,130]:touch_move(page,cdp,[(1,430-spread,400),(2,650+spread,400)],rotated)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready(page)
        assert 180<=int(page.locator('#photo-zoom-level').inner_text().rstrip('%'))<=250
        # Pinching inward can show the entire original image, below the initial cover size.
        points=[dict(location(page,320,400,rotated),id=1),dict(location(page,760,400,rotated),id=2)]
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        for inset in [40,80,120,160,190]:touch_move(page,cdp,[(1,320+inset,400),(2,760-inset,400)],rotated)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready(page)
        assert int(page.locator('#photo-zoom-level').inner_text().rstrip('%'))<100
        # Mouse drag is available on desktop and also uses app coordinates when rotated.
        previous=image(page);start=location(page,540,400,rotated);end=location(page,650,470,rotated)
        page.mouse.move(**start);page.mouse.down();page.mouse.move(**end,steps=5);page.mouse.up();ready(page);assert image(page)!=previous
        # Wheel zoom and explicit buttons; keyboard cannot navigate away from the card.
        canvas.focus();page.keyboard.press('Home');ready(page)
        point=location(page,400,300,rotated);page.mouse.move(**point);page.mouse.wheel(0,-200)
        page.wait_for_function('document.querySelector("#photo-zoom-level").textContent!=="100%"');ready(page)
        assert int(page.locator('#photo-zoom-level').inner_text().rstrip('%'))>100
        canvas.focus()
        for _ in range(20):page.keyboard.press('+')
        ready(page);assert page.locator('#photo-zoom-level').inner_text()=='400%'
        assert page.locator('[data-action="zoom-in"]').is_disabled()
        page.keyboard.press('Home');ready(page);assert page.locator('#photo-zoom-level').inner_text()=='100%'
        assert page.locator('[data-action="zoom-out"]').is_enabled()
        for _ in range(20):page.keyboard.press('-')
        ready(page);assert int(page.locator('#photo-zoom-level').inner_text().rstrip('%'))<100
        assert page.locator('[data-action="zoom-out"]').is_disabled()
        page.keyboard.press('Home');ready(page)
        page.locator('[data-action="zoom-in"]').click();ready(page)
        assert page.locator('#photo-zoom-level').inner_text()=='120%'
        page.locator('[data-action="choose"]').click();page.locator('[data-choice="1"]').click();ready(page)
        assert page.locator('#photo-zoom-level').inner_text()=='120%'
        page.locator('[data-action="reset-view"]').click();ready(page)
        assert page.locator('#photo-zoom-level').inner_text()=='100%'
        assert page.locator('#result-card').count()==1 and not errors,errors
        results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS'});c.close()
    browser.close();print(json.dumps(results,indent=2))
