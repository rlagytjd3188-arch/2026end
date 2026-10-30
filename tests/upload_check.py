"""Consent and manual retry tests; all Worker requests are mocked locally."""
import io, json, pathlib, tempfile
from email.parser import BytesParser
from email import policy
from PIL import Image
from playwright.sync_api import sync_playwright
from ui_helpers import ENDPOINT, accept_consent
ROOT=pathlib.Path(__file__).resolve().parents[1]

def ready(page):page.wait_for_function('document.querySelector("#result-card")?.getAttribute("aria-busy")==="false"')
def file_part(request):
    assert request.url==ENDPOINT and request.method=='POST'
    assert 'authorization' not in request.headers
    ct=request.headers['content-type'];assert ct.startswith('multipart/form-data; boundary=')
    msg=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+ct+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+request.post_data_buffer)
    parts=list(msg.iter_parts());assert len(parts)==1
    assert parts[0].get_param('name',header='content-disposition')=='file'
    assert parts[0].get_filename()=='RECOVERY44_card.png'
    assert parts[0].get_content_type()=='image/png'
    content=parts[0].get_payload(decode=True);im=Image.open(io.BytesIO(content))
    assert im.format=='PNG' and im.size==(1080,1350)
    assert im.getpixel((45,1000))[:3]==(206,250,115)
    return content

def fail_pending(page,pending):
    pending.pop(0).abort('failed')
    page.wait_for_function('document.querySelector("#upload-status").textContent==="사진을 전송하지 못했습니다."')
    assert page.locator('[data-action="retry-upload"]').is_enabled()

def begin(page):
    with page.expect_download():
        page.locator('[data-action="download"]').click();accept_consent(page)
    page.wait_for_function('document.querySelector("#upload-status").textContent.includes("전송 중")')

with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    tmp=pathlib.Path(tmp);im=Image.new('RGB',(160,240),'#cc8844')
    for fmt in ['JPEG','PNG','WEBP']:im.save(tmp/('photo.'+fmt.lower()),fmt)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);results=[]
    for w,h in [(1440,960),(844,390),(568,320),(390,844),(320,568)]:
      for build in ['', 'dist/RECOVERY44.html']:
        c=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=True,reduced_motion='reduce');page=c.new_page()
        page.add_init_script('''() => {}''')
        page.add_init_script('''window.__pngBuilds=0;window.__uploadBlobs=[];
          const toBlob=HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob=function(...args){window.__pngBuilds++;return toBlob.apply(this,args);};
          const NativeFile=window.File;
          window.File=class extends NativeFile{constructor(bits,name,options){super(bits,name,options);if(name==='RECOVERY44_card.png')window.__uploadBlobs.push(bits[0]);}};''')
        pending=[];requests=[];errors=[];downloads=[];extra=[]
        def handle(route):
            if route.request.method=='OPTIONS':route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return
            requests.append(route.request);pending.append(route)
        page.route(ENDPOINT,handle);page.on('pageerror',lambda e:errors.append(str(e)));page.on('download',lambda d:downloads.append(d))
        page.on('request',lambda req:extra.append(req.url) if build and req.url.startswith('http') and req.url!=ENDPOINT and req.resource_type!='document' else None)
        page.goto('http://127.0.0.1:4173/'+build+'#your-recovery');page.locator('[data-choice="0"]').click();ready(page)
        assert page.locator('[data-action="download"]').inner_text()=='나의 회복 저장 및 보내기'
        assert page.locator('#photo-coordinate-pad').count()==0
        assert page.locator('.photo-file-help,.photo-privacy').count()==0
        assert '2026년, 우리는 함께 걸었습니다.' not in page.locator('.scene').inner_text()
        for action in ['camera','pick-photo']:
            assert page.locator(f'[data-action="{action}"]').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(36, 72, 45)'
        for action in ['download','share']:
            page.locator(f'[data-action="{action}"]').click();assert page.locator('#consent-dialog').is_visible()
            page.locator('#consent-decline').click()
        assert not requests and not downloads
        assert page.locator('#choose-photo').get_attribute('accept')=='image/*'
        assert page.locator('#choose-photo').get_attribute('multiple') is None
        for ext in ['jpeg','png','webp']:
            page.locator('#choose-photo').set_input_files(tmp/f'photo.{ext}');ready(page)
        assert not requests
        builds=page.evaluate('window.__pngBuilds')
        begin(page);assert len(requests)==1;sent=file_part(requests[0])
        assert page.locator('[data-action="download"]').is_disabled()
        page.locator('[data-action="download"]').evaluate('(e)=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
        assert len(requests)==1
        fail_pending(page,pending)
        assert len(downloads)==1
        # Retry must use the identical Blob object and bytes with no PNG regeneration.
        for retry_index in [1,2]:
            page.locator('[data-action="retry-upload"]').click()
            page.wait_for_function('document.querySelector("#upload-status").textContent==="다시 전송하는 중입니다…"')
            assert page.locator('[data-action="retry-upload"]').is_disabled()
            page.locator('[data-action="retry-upload"]').evaluate('(e)=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
            assert len(requests)==retry_index+1
            assert file_part(requests[-1])==sent
            assert page.evaluate(f'window.__uploadBlobs[{retry_index}]===window.__uploadBlobs[0]')
            assert page.evaluate('window.__pngBuilds')==builds
            assert len(downloads)==1
            if retry_index==1:
                message='Dropbox 테스트 오류 <script>window.injected=true</script>'
                pending.pop(0).fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'ok':False,'error':message}))
                page.wait_for_function('(msg)=>document.querySelector("#upload-error-detail").textContent===msg',arg=message)
                assert page.evaluate('window.injected') is None
                assert page.locator('[data-action="retry-upload"]').is_enabled()
            else:
                pending.pop(0).fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{"ok":true}')
                page.wait_for_function('document.querySelector("#upload-status").textContent==="전송 완료 ✓"')
                page.wait_for_function('document.querySelector("#uploaded-card img").naturalWidth===1080')
                assert page.locator('[data-action="retry-upload"]').is_hidden()
        # Fresh photo and regenerated card discard previous failures.
        begin(page);fail_pending(page,pending)
        page.locator('#choose-photo').set_input_files(tmp/'photo.jpeg');ready(page)
        assert page.locator('.card-upload').is_hidden()
        assert page.locator('[data-action="retry-upload"]').is_hidden()
        begin(page);fail_pending(page,pending)
        page.locator('#photo-horizontal').fill('70');ready(page)
        assert page.locator('.card-upload').is_hidden()
        # Genuine HEIC and HEIF remain supported; no automatic upload.
        count=len(requests)
        page.locator('#choose-photo').set_input_files(ROOT/'tests/fixtures/card-sample.heic');ready(page)
        assert page.locator('#photo-error').is_hidden()
        assert page.evaluate('typeof window.HeicTo')=='function'
        page.locator('#choose-photo').set_input_files({'name':'sample.HEIF','mimeType':'image/heif','buffer':(ROOT/'tests/fixtures/card-sample.heic').read_bytes()});ready(page)
        assert page.locator('#photo-error').is_hidden() and len(requests)==count
        # Share still uses native sharing (or saving), but only after consent.
        page.evaluate('Object.defineProperty(navigator,"canShare",{value:()=>true,configurable:true});window.__shares=0;Object.defineProperty(navigator,"share",{value:async()=>{window.__shares++;},configurable:true})')
        page.locator('[data-action="share"]').click();accept_consent(page)
        page.wait_for_function('window.__shares===1');assert len(requests)==count
        if w==1440 and not build:
            page.locator('#choose-photo').set_input_files({'name':'large.jpg','mimeType':'image/jpeg','buffer':b'0'*(15*1024*1024+1)})
            assert '15MB' in page.locator('#photo-error').inner_text();assert len(requests)==count
        assert page.locator('.scene').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert not errors,errors;assert not extra,extra
        results.append({'viewport':f'{w}x{h}','build':build or 'source','checks':'PASS','worker':'mocked; no production contact'})
        c.close()
    browser.close();print(json.dumps(results,indent=2))
