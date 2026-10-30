"""Opening glyphs, church row, poster size and readable march records; local only."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('/tmp/recovery-mobile-layout')
OUT.mkdir(exist_ok=True)
SCENES = json.loads(Path('data/scenes.json').read_text())
CHURCH = next(s for s in SCENES if s['id'] == 'daily-worship')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    results = []
    for w, h in [(1440, 960), (844, 390), (568, 320), (390, 844), (320, 568), (412, 900)]:
        mobile = w != 1440
        for build in ['', 'dist/RECOVERY44.html']:
            context = browser.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile,
                                          has_touch=mobile, reduced_motion='reduce')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            base = 'http://127.0.0.1:4173/' + build + '#'

            def visit(scene):
                page.goto(base + scene)
                page.wait_for_selector('[data-scene="' + scene + '"]')
                page.wait_for_function('document.fonts.status === "loaded"')

            # Work in the virtual landscape coordinate system on rotated phones.
            page.add_init_script('''window.logicalRect = e => {
                const r = e.getBoundingClientRect();
                return innerHeight > innerWidth && innerWidth < 768
                    ? {left:r.top,right:r.bottom,top:innerWidth-r.right,bottom:innerWidth-r.left}
                    : {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
            };''')
            visit('opening')
            glyphs = page.locator('.hero-glyph')
            assert glyphs.count() == 9
            assert page.locator('.hero h1').get_attribute('aria-label') == 'RECOVERY'
            boxes = glyphs.evaluate_all('(es) => es.map(logicalRect)')
            assert all(boxes[i+1]['left'] - boxes[i]['right'] >= 1 for i in range(8)), boxes
            assert boxes[0]['left'] >= 0 and boxes[-1]['right'] <= max(w, h), boxes
            if not build:
                page.screenshot(path=str(OUT / f'opening-{w}x{h}.png'))

            visit('daily-worship')
            buttons = page.locator('.switches .chip')
            assert buttons.all_text_contents() == CHURCH['buttonLabels']
            boxes = buttons.evaluate_all('(es) => es.map(logicalRect)')
            assert max(b['top'] for b in boxes) - min(b['top'] for b in boxes) < 1, boxes
            assert all(boxes[i]['right'] < boxes[i+1]['left'] for i in range(2)), boxes
            photo_sources = []
            for i in range(3):
                buttons.nth(i).click()
                assert page.locator('.field-record p').text_content() == CHURCH['details'][i]
                page.wait_for_function('(label)=>document.querySelector(".visual img").alt===label', arg=CHURCH['labels'][i])
                source = page.locator('.visual img').get_attribute('src')
                if not build:
                    assert source.endswith(CHURCH['photos'][i] + '.webp')
                photo_sources.append(source)
                assert page.locator('.visual figcaption').text_content() == CHURCH['labels'][i]
            assert len(set(photo_sources)) == 3
            if not build:
                page.screenshot(path=str(OUT / f'churches-{w}x{h}.png'))

            visit('nepal')
            image = page.locator('.nepal .visual>img')
            page.wait_for_function('document.querySelector(".nepal .visual>img").naturalWidth > 0')
            poster = image.evaluate('''e => ({width:e.clientWidth,height:e.clientHeight,
                ratio:e.naturalHeight/e.naturalWidth,max:getComputedStyle(e).maxHeight})''')
            assert poster['max'] == 'none' and abs(poster['height'] - poster['width'] * poster['ratio']) < 2, poster
            assert poster['height'] > (250 if mobile else 400), poster
            if not build:
                page.screenshot(path=str(OUT / f'nepal-{w}x{h}.png'))
            page.locator('[data-action="nepal"]').click()
            text = page.locator('#carbon-dialog').inner_text()
            assert '탄소배출은' in text and '한국교회도' in text
            assert '온실가스는' not in text and '한국교회의 연대도' not in text
            page.locator('#carbon-dialog [data-close]').click()

            visit('river')
            record = page.locator('.river .field-record')
            css = record.evaluate('''e => ({background:getComputedStyle(e).backgroundColor,
                color:getComputedStyle(e.querySelector('p')).color,
                size:parseFloat(getComputedStyle(e.querySelector('p')).fontSize)})''')
            assert css['background'] == 'rgba(8, 20, 15, 0.94)', css
            assert css['color'] == 'rgb(248, 246, 237)' and css['size'] >= 14, css
            page.locator('.scene').evaluate('(e)=>e.scrollTop=e.scrollHeight')
            bounds = page.evaluate('''() => ({text:logicalRect(document.querySelector('.field-record p')),
                footer:logicalRect(document.querySelector('.navigation'))})''')
            assert bounds['text']['bottom'] <= bounds['footer']['top'] + 1, bounds
            if not build:
                page.screenshot(path=str(OUT / f'river-{w}x{h}.png'))
            assert not errors, errors
            results.append({'viewport': f'{w}x{h}', 'build': build or 'source', 'checks': 'PASS'})
            context.close()
    browser.close()
    print(json.dumps(results, indent=2))
