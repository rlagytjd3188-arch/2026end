"""Personal photo cards: run with the local server on port 4173."""
import hashlib, json, pathlib, tempfile
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright


def ready(page):
    page.wait_for_function('document.querySelector("#result-card")?.getAttribute("aria-busy")==="false"')


def fingerprint(page):
    return page.locator('#result-card').evaluate('(c)=>c.toDataURL()')


def pixel(page):
    return page.locator('#result-card').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(540,200,1,1).data)')


with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    tmp=pathlib.Path(tmp)
    portrait=Image.new('RGB',(800,1600));draw=ImageDraw.Draw(portrait)
    draw.rectangle((0,0,800,530),fill='red');draw.rectangle((0,531,800,1060),fill='green');draw.rectangle((0,1061,800,1600),fill='blue')
    portrait.save(tmp/'portrait.png')
    orientation=Image.Exif();orientation[274]=6;portrait.save(tmp/'camera-oriented.jpg',quality=95,exif=orientation)
    landscape=Image.new('RGB',(1600,600));draw=ImageDraw.Draw(landscape)
    draw.rectangle((0,0,530,600),fill='red');draw.rectangle((531,0,1060,600),fill='green');draw.rectangle((1061,0,1600,600),fill='blue')
    landscape.save(tmp/'landscape.jpg',quality=95)
    (tmp/'broken.jpg').write_bytes(b'not a valid image')
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(1440,960),(390,844),(320,568)]:
        for build in ['', 'dist/RECOVERY44.html']:
            c=browser.new_context(viewport={'width':w,'height':h},reduced_motion='reduce',accept_downloads=True,has_touch=True)
            page=c.new_page();errors=[];uploads=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:uploads.append(r.url) if r.method!='GET' else None)
            page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
            original=fingerprint(page)
            assert page.locator('[data-action="reset-photo"]').is_hidden()
            # Native chooser buttons: capture is a progressive enhancement on phones.
            with page.expect_file_chooser() as chooser:page.locator('[data-action="camera"]').click()
            assert chooser.value.element.get_attribute('capture')=='environment'
            chooser.value.set_files(tmp/'portrait.png');ready(page)
            assert fingerprint(page)!=original
            assert '내 사진을 적용했습니다' in page.locator('#photo-status').inner_text()
            page.locator('#photo-y').fill('0');ready(page);top=pixel(page)
            page.locator('#photo-y').fill('100');ready(page);bottom=pixel(page)
            assert top!=bottom and top[0]>top[2] and bottom[2]>bottom[0]
            with page.expect_download() as d:page.locator('[data-action="download"]').click()
            dest=tmp/'card.png';d.value.save_as(dest);png=Image.open(dest)
            assert png.size==(1080,1350) and list(png.getpixel((540,200)))==bottom
            # Frame and lettering remain on the exported card.
            assert png.getpixel((45,1000))[:3]==(206,250,115)
            region=png.crop((74,1100,1000,1220))
            assert sum(count for count,color in region.getcolors(region.width*region.height) if min(color[:3])>200)>1000
            page.evaluate('Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true})')
            with page.expect_download() as shared:page.locator('[data-action="share"]').click()
            shared.value.save_as(tmp/'shared.png');assert Image.open(tmp/'shared.png').getpixel((540,200))==png.getpixel((540,200))
            # File picker cancellation and failed decoding preserve the previous photo.
            before=fingerprint(page);page.locator('#choose-photo').set_input_files([]);ready(page);assert fingerprint(page)==before
            page.locator('#choose-photo').set_input_files(tmp/'broken.jpg')
            page.wait_for_function('document.querySelector("#toast").textContent.includes("사진을 열 수 없습니다")');ready(page)
            assert fingerprint(page)==before
            with page.expect_file_chooser() as chooser:page.locator('[data-action="pick-photo"]').click()
            assert chooser.value.element.get_attribute('capture') is None
            chooser.value.set_files(tmp/'landscape.jpg');ready(page)
            page.locator('#photo-x').fill('0');ready(page);left=pixel(page)
            page.locator('#photo-x').fill('100');ready(page);right=pixel(page);assert left!=right
            # Phone JPEG orientation is honored before positioning and exporting.
            page.locator('#camera-photo').set_input_files(tmp/'camera-oriented.jpg');ready(page)
            page.locator('#photo-x').fill('0');ready(page);left=pixel(page)
            page.locator('#photo-x').fill('100');ready(page);right=pixel(page)
            assert left[2]>left[0] and right[0]>right[2]
            # All four recovery designs accept the user's photo, retained across choices.
            for option in range(4):
                page.locator('[data-action="choose"]').click();page.locator(f'[data-choice="{option}"]').click();ready(page)
                assert page.locator('.photo-position-controls').is_visible()
                with page.expect_download() as d:page.locator('[data-action="download"]').click()
                d.value.save_as(tmp/f'card-{option}.png');assert Image.open(tmp/f'card-{option}.png').size==(1080,1350)
            assert len({hashlib.sha256((tmp/f'card-{i}.png').read_bytes()).digest() for i in range(4)})==4
            page.locator('[data-action="choose"]').click();page.locator('[data-choice="0"]').click();ready(page)
            page.locator('[data-action="reset-photo"]').click();ready(page);assert fingerprint(page)==original
            # Reset while a decode is pending must not reapply a discarded photo.
            page.evaluate('''() => {const decode=Image.prototype.decode;Image.prototype.decode=async function(){await decode.call(this);await new Promise(r=>setTimeout(r,150));};}''')
            page.locator('#choose-photo').set_input_files(tmp/'portrait.png');page.locator('[data-action="reset-photo"]').click();ready(page)
            page.wait_for_timeout(180);assert fingerprint(page)==original
            page.locator('#choose-photo').set_input_files(tmp/'portrait.png');ready(page)
            page.locator('[data-action="restart"]').click();page.wait_for_selector('.hero')
            page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
            assert page.locator('.photo-position-controls').is_hidden()
            assert page.locator('.scene').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
            assert not errors,errors;assert not uploads,uploads
            results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS'})
            c.close()
    browser.close();print(json.dumps(results,indent=2))
