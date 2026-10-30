"""Cartesian photo pad: pointer, touch, keyboard and rotated phone display."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('/tmp/recovery-coordinates');OUT.mkdir(exist_ok=True)

def ready(page):page.wait_for_function('document.querySelector("#result-card").getAttribute("aria-busy")==="false"')
def values(page):return [page.locator('#photo-x').input_value(),page.locator('#photo-y').input_value()]
def point(page,x,y,rotated):
    r=page.locator('#photo-coordinate-pad').bounding_box();u=(x+100)/200;v=(100-y)/200
    return (r['x']+r['width']*(1-v),r['y']+r['height']*u) if rotated else (r['x']+r['width']*u,r['y']+r['height']*v)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(1440,960),(844,390),(568,320),(390,844),(320,568)]:
        for build in ['', 'dist/RECOVERY44.html']:
            c=b.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=w<1000,reduced_motion='reduce')
            page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
            page.locator('#choose-photo').set_input_files(Path(__file__).resolve().parents[1]/'assets/photos/05-p18-0.webp');ready(page)
            assert values(page)==['0','0']
            pad=page.locator('#photo-coordinate-pad');pad.scroll_into_view_if_needed()
            # The 2-D point uses mathematical axes; dragging must not scroll or change scenes.
            rotated=h>w and w<768;cx,cy=point(page,0,0,rotated);tx,ty=point(page,60,60,rotated)
            before=page.locator('.scene').evaluate('(e)=>e.scrollTop')
            cdp=c.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy}]})
            for i in range(1,7):
                cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx+(tx-cx)*i/6,'y':cy+(ty-cy)*i/6}]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});ready(page)
            x,y=map(int,values(page));assert abs(x-60)<=2 and abs(y-60)<=2,(w,h,values(page))
            assert page.locator('.scene').evaluate('(e)=>e.scrollTop')==before
            assert page.locator('#result-card').count()==1
            # Desktop mouse drag and keyboard share the same signed coordinates.
            page.locator('[data-action="center-photo"]').click();ready(page);assert values(page)==['0','0']
            pad.focus();page.keyboard.press('ArrowRight');page.keyboard.press('Shift+ArrowUp');ready(page);assert values(page)==['1','10']
            page.keyboard.press('Home');ready(page);assert values(page)==['0','0']
            page.locator('#photo-x').fill('250');ready(page);assert values(page)[0]=='100'
            page.locator('#photo-y').fill('-250');ready(page);assert values(page)[1]=='-100'
            page.locator('[data-action="center-photo"]').click();ready(page)
            pad.scroll_into_view_if_needed();cx,cy=point(page,0,0,rotated);tx,ty=point(page,-60,-60,rotated)
            page.mouse.move(cx,cy);page.mouse.down();page.mouse.move(tx,ty,steps=6);page.mouse.up();ready(page)
            x,y=map(int,values(page));assert abs(x+60)<=2 and abs(y+60)<=2
            before=values(page);page.locator('[data-action="choose"]').click();page.locator('[data-choice="1"]').click();ready(page);assert values(page)==before
            assert page.locator('.scene').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
            pad=page.locator('#photo-coordinate-pad');pad.scroll_into_view_if_needed()
            if w<1000:
                visible=page.evaluate('''() => {
                  const c=document.querySelector('#result-card').getBoundingClientRect(),n=document.querySelector('.navigation').getBoundingClientRect();
                  return innerHeight>innerWidth?{bottom:innerWidth-c.left,footer:innerWidth-n.right}:{bottom:c.bottom,footer:n.top};
                }''')
                assert visible['bottom']<=visible['footer']+1,visible
            if not build:page.screenshot(path=str(OUT/f'coordinates-{w}.png'))
            assert not errors,errors;results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS'});c.close()
    b.close();print(json.dumps(results,indent=2))
