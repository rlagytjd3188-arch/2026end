"""Trusted touch scrolling and first-view mobile layout, local server port 4173."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/recovery-mobile-reading');OUT.mkdir(exist_ok=True)

def swipe(page,cdp,w,h):
    # App coordinates are landscape even when the physical screen is portrait.
    rotated=h>w;aw,ah=(h,w) if rotated else (w,h)
    def physical(x,y):return (w-y,x) if rotated else (x,y)
    x,y=aw*.28,ah*.72;px,py=physical(x,y)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':px,'y':py}]})
    for dy in range(12,133,12):
        px,py=physical(x,y-dy)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':px,'y':py}]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})

def inside(page,selector,w,h):
    r=page.locator(selector).bounding_box();assert r and r['x']>=0 and r['y']>=0 and r['x']+r['width']<=w+1 and r['y']+r['height']<=h+1,(selector,r)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(844,390),(568,320),(390,844),(320,568)]:
        for build in ['', 'dist/RECOVERY44.html']:
            c=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,reduced_motion='reduce')
            page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));cdp=c.new_cdp_session(page)
            base='http://127.0.0.1:4173/'+build+'#'
            page.goto(base+'opening');page.wait_for_selector('.hero');page.wait_for_function('document.fonts.status==="loaded"')
            # Compare in unrotated app coordinates so the assertion covers both orientations.
            rects=page.evaluate('''() => {
              const portrait=innerHeight>innerWidth;
              const rect=q=>{const r=document.querySelector(q).getBoundingClientRect();return portrait?{top:innerWidth-r.right,bottom:innerWidth-r.left,left:r.top,right:r.bottom}:{top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
              return {header:rect('.masthead'),title:rect('.hero h1'),note:rect('.hero-note'),button:rect('.hero-bottom button'),footer:rect('.navigation'),spacing:getComputedStyle(document.querySelector('.hero h1')).letterSpacing};
            }''')
            assert rects['spacing']=='normal' or float(rects['spacing'].replace('px',''))>=0
            assert rects['title']['top']>=rects['header']['bottom']+3,rects
            assert rects['title']['bottom']<=rects['note']['top'],rects
            assert rects['button']['bottom']<=rects['footer']['top']+1,rects
            inside(page,'.hero h1',w,h)
            if not build:page.screenshot(path=str(OUT/f'opening-{w}.png'))
            page.goto(base+'gadeok');page.wait_for_selector('[data-scene="gadeok"]')
            assert page.locator('.scene').evaluate('(e)=>e.scrollHeight>e.clientHeight')
            swipe(page,cdp,w,h)
            assert page.locator('.scene').evaluate('(e)=>e.scrollTop')>50
            assert page.locator('[data-scene="gadeok"]').count()==1
            for _ in range(9):swipe(page,cdp,w,h)
            assert page.locator('.scene').evaluate('(e)=>e.scrollTop>=e.scrollHeight-e.clientHeight-2')
            bounds=page.evaluate('''() => {
              const text=document.querySelector('.field-record p').getBoundingClientRect(),nav=document.querySelector('.navigation').getBoundingClientRect();
              return innerHeight>innerWidth?{bottom:innerWidth-text.left,footer:innerWidth-nav.right}:{bottom:text.bottom,footer:nav.top};
            }''')
            assert bounds['bottom']<=bounds['footer']+1,bounds
            if not build:page.screenshot(path=str(OUT/f'long-text-end-{w}.png'))
            page.goto(base+'river');page.wait_for_selector('.river')
            inside(page,'[data-action="river"]',w,h)
            inside(page,'.river-stats',w,h)
            page.locator('[data-action="river"]').tap();page.wait_for_function("() => [...document.querySelectorAll('[data-counter]')].some(e=>e.textContent==='20,000+')")
            assert page.locator('.river-lines').evaluate('(e)=>e.classList.contains("joined")')
            inside(page,'[data-action="river"]',w,h)
            if not build:page.screenshot(path=str(OUT/f'river-active-{w}.png'))
            page.goto(base+'nepal');page.wait_for_selector('[data-action="nepal"]');page.locator('[data-action="nepal"]').tap()
            swipe(page,cdp,w,h)
            assert page.locator('#carbon-dialog').evaluate('(e)=>e.scrollTop')>30
            assert not errors,errors
            results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS'});c.close()
    b.close();print(json.dumps(results,indent=2))
