"""Mock Worker contract tests; never writes test images to the real Dropbox."""
import io, json, pathlib, tempfile
from email.parser import BytesParser
from email import policy
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
ENDPOINT='https://recovery44-upload.kh3188.workers.dev/'

def ready(page):page.wait_for_function('document.querySelector("#result-card")?.getAttribute("aria-busy")==="false"')

def file_part(request):
    assert request.url==ENDPOINT and request.method=='POST'
    assert 'authorization' not in request.headers
    ct=request.headers['content-type'];assert ct.startswith('multipart/form-data; boundary=')
    msg=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+ct+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+request.post_data_buffer)
    parts=list(msg.iter_parts());assert len(parts)==1
    assert parts[0].get_param('name',header='content-disposition')=='file'
    assert parts[0].get_filename().endswith('.png')
    assert parts[0].get_filename().isascii()
    assert parts[0].get_content_type()=='image/png'
    content=parts[0].get_payload(decode=True);im=Image.open(io.BytesIO(content))
    assert im.format=='PNG' and im.size==(1080,1350)
    assert im.getpixel((45,1000))[:3]==(206,250,115)
    return content

with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    tmp=pathlib.Path(tmp);im=Image.new('RGB',(160,240),'#cc8844')
    for fmt in ['JPEG','PNG','WEBP']:im.save(tmp/('photo.'+fmt.lower()),fmt)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(1440,960),(844,390),(568,320),(390,844),(320,568)]:
      for build in ['', 'dist/RECOVERY44.html']:
        c=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=True,reduced_motion='reduce');page=c.new_page()
        pending=[];requests=[];errors=[];extra=[]
        def handle(route):
            if route.request.method=='OPTIONS':route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return
            requests.append(route.request);pending.append(route)
        page.route(ENDPOINT,handle);page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda req:extra.append(req.url) if build and req.url.startswith('http') and req.url!=ENDPOINT and req.resource_type!='document' else None)
        page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
        assert page.locator('.card-upload').is_hidden()
        assert page.locator('#choose-photo').get_attribute('accept')=='image/*'
        assert page.locator('#choose-photo').get_attribute('multiple') is None
        for ext in ['jpeg','png','webp']:
            page.locator('#choose-photo').set_input_files(tmp/f'photo.{ext}');ready(page)
            assert page.locator('.photo-position-controls').is_visible()
        assert not requests
        assert not page.locator('#upload-consent').is_checked()
        assert page.locator('[data-action="upload-card"]').is_disabled()
        page.locator('#upload-consent').check();assert page.locator('[data-action="upload-card"]').is_enabled()
        page.locator('[data-action="upload-card"]').click();page.wait_for_function('document.querySelector("#upload-status").textContent.includes("전송 중")')
        assert page.locator('[data-action="upload-card"]').is_disabled()
        page.locator('[data-action="upload-card"]').evaluate('(e)=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
        assert len(requests)==1;sent=file_part(requests[0])
        pending.pop(0).fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{"ok":true}')
        page.wait_for_selector('#uploaded-card img');page.wait_for_function('document.querySelector("#uploaded-card img").naturalWidth===1080')
        assert 'Dropbox에 전송되었습니다' in page.locator('#upload-status').inner_text()
        assert not page.locator('#upload-consent').is_checked()
        # API errors must be shown literally; no HTML injection or fake success.
        page.locator('#upload-consent').check();page.locator('[data-action="upload-card"]').click()
        page.wait_for_function('document.querySelector("#upload-status").textContent.includes("전송 중")')
        msg='Dropbox 테스트 오류 <script>window.injected=true</script>'
        pending.pop(0).fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'ok':False,'error':msg}))
        page.wait_for_function('(message)=>document.querySelector("#upload-status").textContent===message',arg=msg)
        assert page.evaluate('window.injected') is None
        page.locator('[data-action="upload-card"]').click();page.wait_for_function('document.querySelector("#upload-status").textContent.includes("전송 중")')
        pending.pop(0).abort('failed');page.wait_for_function('document.querySelector("#upload-status").textContent.includes("인터넷 연결")')
        # Genuine HEIC uses a local decoder when native browser decoding fails.
        page.locator('#choose-photo').set_input_files(ROOT/'tests/fixtures/card-sample.heic');ready(page)
        assert page.locator('#photo-error').is_hidden(),page.locator('#photo-error').inner_text()
        assert page.locator('.photo-position-controls').is_visible()
        assert page.evaluate('typeof window.HeicTo')=='function'
        page.locator('#choose-photo').set_input_files({'name':'sample.HEIF','mimeType':'image/heif','buffer':(ROOT/'tests/fixtures/card-sample.heic').read_bytes()});ready(page)
        assert page.locator('#photo-error').is_hidden()
        page.locator('#upload-consent').check();page.locator('[data-action="upload-card"]').click()
        page.wait_for_function('document.querySelector("#upload-status").textContent.includes("전송 중")')
        file_part(requests[-1]);pending.pop(0).fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{"ok":true}')
        page.wait_for_function('document.querySelector("#upload-status").textContent.includes("Dropbox에 전송되었습니다")')
        # File size/type validation runs before decode or POST.
        if w==1440 and not build:
            count=len(requests)
            page.locator('#choose-photo').set_input_files({'name':'large.jpg','mimeType':'image/jpeg','buffer':b'0'*(15*1024*1024+1)})
            assert '15MB' in page.locator('#photo-error').inner_text();assert len(requests)==count
            page.locator('#choose-photo').set_input_files({'name':'bad.gif','mimeType':'image/gif','buffer':b'GIF89a'})
            assert 'HEIC/HEIF' in page.locator('#photo-error').inner_text();assert len(requests)==count
        assert page.locator('.scene').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert not errors,errors
        assert not extra,extra
        results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS','worker':'mocked; no production upload'})
        c.close()
    browser.close();print(json.dumps(results,indent=2))
