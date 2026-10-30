from playwright.sync_api import sync_playwright
from pathlib import Path
import json, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(ROOT/"scripts/build_standalone.py")],check=True)
out=Path('/tmp/recovery-check')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':844,'height':390},has_touch=True,is_mobile=True,reduced_motion='reduce');page=c.new_page();page.goto('http://127.0.0.1:4173');page.wait_for_selector('.hero');page.wait_for_timeout(400)
 resources=page.evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name.split("/").pop(),bytes:r.transferSize}))');print('initial resources',json.dumps(resources))
 page.tap('[data-action="next"]');page.wait_for_selector('[data-scene="beginning"]')
 # Trusted browser touch swipe via Chrome DevTools.
 cdp=c.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':300,'y':200}]})
 for x in [250,200,150,100]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':200}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_selector('[data-scene="research"]')
 page.goto('http://127.0.0.1:4173/#forest-voices');page.wait_for_selector('[data-scene="forest-voices"]')
 # Inline field notes need no dialog; the chapter dialog retains focus.
 assert page.locator('.field-record').is_visible()
 page.tap('#menu');page.keyboard.press('Tab');assert page.evaluate('document.activeElement.closest("dialog") !== null');page.keyboard.press('Escape');assert page.locator('#menu').evaluate('(e)=>e===document.activeElement')
 page.goto('http://127.0.0.1:4173/#your-recovery');page.tap('[data-choice="1"]');page.wait_for_selector('#result-card');page.wait_for_timeout(400)
 # Force non-Web-Share fallback (this API may be unavailable in Chromium).
 page.evaluate('Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true})')
 with page.expect_download():page.tap('[data-action="share"]')
 page.screenshot(path=str(out/'mobile-result-final.png'))
 print('trusted tap/swipe, modal focus, share fallback: PASS');c.close()
 # Offline release must make no network request and still export a real PNG.
 c=b.new_context(viewport={'width':1440,'height':960},reduced_motion='reduce');page=c.new_page();errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url) if r.url.startswith('http') and r.resource_type!='document' else None)
 page.goto('http://127.0.0.1:4173/dist/RECOVERY44.html');page.wait_for_selector('.hero');page.wait_for_function('document.fonts.status==="loaded"');page.screenshot(path=str(out/'desktop-final-opening.png'))
 page.locator('#menu').click();page.locator('#chapter-list a[href="#your-recovery"]').click();page.locator('[data-choice="0"]').click();page.wait_for_timeout(500)
 with page.expect_download() as d:page.locator('[data-action="download"]').click()
 d.value.save_as(out/'offline-card-final.png');assert not errors,errors;assert not requests,requests;print('self-contained HTML / card export / zero additional requests: PASS')
 c.close();b.close()
