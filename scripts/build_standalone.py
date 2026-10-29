"""Create an offline, self-contained HTML release using only the Python standard library."""
import base64,json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[1]
output=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else root/'dist/RECOVERY44.html'
output.parent.mkdir(parents=True,exist_ok=True)
def uri(p,mime):return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
photos={p.stem:uri(p,'image/webp') for p in (root/'assets/photos').glob('*.webp')}
css=(root/'styles.css').read_text()
for p in (root/'assets').glob('*.woff'):css=css.replace('assets/'+p.name,uri(p,'font/woff'))
js=(root/'app.js').read_text().replace("const path = id => `assets/photos/${id}.webp`;","const path = id => EMBEDDED_PHOTOS[id];")
js=js.replace("const res=await fetch('data/scenes.json');","const res={ok:true,json:async()=>EMBEDDED_SCENES};")
scenes=json.loads((root/'data/scenes.json').read_text())
for scene in scenes:
 if scene.get('image'):
  scene['image']=uri(root/scene['image'],'image/png')
js='const EMBEDDED_PHOTOS='+json.dumps(photos)+';\nconst EMBEDDED_SCENES='+json.dumps(scenes,ensure_ascii=False)+';\n'+js
html=(root/'index.html').read_text()
html=html.replace('assets/logo.jpg',uri(root/'assets/logo.jpg','image/jpeg'))
html=re.sub(r'<link rel="preload"[^>]*>','',html)
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>')
html=html.replace('<script src="app.js" defer></script>','')
html=html.replace('</body>','<script>'+js+'</script></body>')
output.write_text(html)
print(output,output.stat().st_size,'bytes')
