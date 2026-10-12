# يبني إضافة المتصفح (Chrome / Edge) من نفس كود أداة نور. الناتج: dist/ext/ و dist/tahdir-ext-<version>.zip
# --test: يضيف localhost للاختبار المحلي فقط (لا يُرفع للمتجر أبدًا)
import json, os, re, sys, zipfile, base64, io, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'extension'); OUT = os.path.join(ROOT, 'dist', 'ext' + ('_test' if '--test' in sys.argv else ''))
tool = open(os.path.join(ROOT, 'server', 'tahdir-noor.user.js'), encoding='utf-8').read()
ver = re.search(r'@version\s+(\S+)', tool).group(1)
body = tool[tool.index('==/UserScript=='):].split('\n', 1)[1]
test = '--test' in sys.argv
if test: body = body.replace("location.hostname === 'tahdir.hudhaifa-bio.workers.dev'", "(location.hostname === 'tahdir.hudhaifa-bio.workers.dev' || location.hostname === 'localhost')")
run = 'function (GM_getValue, GM_setValue, GM_deleteValue, GM_openInTab, GM_registerMenuCommand, unsafeWindow) {\n' + body + '\n}'
shim = open(os.path.join(SRC, 'shim.js'), encoding='utf-8').read().replace('__RUN__', '(' + run + ')').replace('__EXTVER__', ver)
if test: shim = shim.replace("location.hostname === 'tahdir.hudhaifa-bio.workers.dev')", "location.hostname === 'tahdir.hudhaifa-bio.workers.dev' || location.hostname === 'localhost')")
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
open(os.path.join(OUT, 'main.js'), 'w', encoding='utf-8').write(shim)
for f in ('bridge.js', 'background.js'): shutil.copy(os.path.join(SRC, f), OUT)
from PIL import Image
icons = json.load(open(os.path.join(ROOT, 'server', 'icons.json')))
big = Image.open(io.BytesIO(base64.b64decode(icons['/icon-512.png']))).convert('RGBA')
for n in (16, 32, 48, 128): big.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f'icon{n}.png'))
sites = ['https://lms.moe.gov.om/*', 'https://tahdir.hudhaifa-bio.workers.dev/*'] + (['http://localhost/*'] if test else [])
man = {
  'manifest_version': 3, 'name': 'الكبسولة — أداة نور', 'short_name': 'أداة نور', 'version': ver,
  'description': 'ترسل التحضير والواجب من موقع «الكبسولة» إلى منصة نور وتملأ الحقول تلقائيًا. لا تضغط حفظ أبدًا.',
  'author': 'أ. محمد مجدي', 'homepage_url': 'https://tahdir.hudhaifa-bio.workers.dev/',
  'permissions': ['storage'],
  'background': {'service_worker': 'background.js'},
  'content_scripts': [
    {'matches': sites, 'js': ['bridge.js'], 'run_at': 'document_start'},
    {'matches': sites, 'js': ['main.js'], 'run_at': 'document_idle', 'world': 'MAIN'}],
  'icons': {str(n): f'icon{n}.png' for n in (16, 32, 48, 128)},
  'action': {'default_icon': {str(n): f'icon{n}.png' for n in (16, 32)}, 'default_title': 'الكبسولة — أداة نور'},
  'minimum_chrome_version': '111'
}
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
if not test:
    z = os.path.join(ROOT, 'dist', f'tahdir-ext-{ver}.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(OUT)): zf.write(os.path.join(OUT, f), f)
    print(z)
print('ext', ver, OUT)
