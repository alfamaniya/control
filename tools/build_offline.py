#!/usr/bin/env python3
from pathlib import Path
from html import unescape
import json, re, mimetypes, base64

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "control-offline.html"
HTML_FILES = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts and "dist" not in p.parts and p.relative_to(ROOT).as_posix() != "components/sidebar/index.html")

def local_path(owner, raw):
    raw = unescape(raw.strip()).split("#",1)[0].split("?",1)[0]
    if not raw or raw.startswith(("#","data:","blob:","mailto:","tel:","javascript:")): return None
    if raw.startswith(("http:","https:","//")): raise RuntimeError("Remote runtime dependency: "+raw+" in "+str(owner))
    p=(owner.parent/raw).resolve()
    if not p.is_file(): raise FileNotFoundError("Missing dependency "+raw+" in "+str(owner))
    return p

def css_inline(css, owner):
    def sub(m):
        raw=m.group(2).strip().strip("\"'")
        if raw.startswith(("data:","blob:","#")): return m.group(0)
        p=local_path(owner,raw)
        mime=mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        return 'url("data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()+'")'
    return re.sub(r'url\(\s*(["\']?)(.*?)\1\s*\)',sub,css,flags=re.I)

def route_href(raw, owner):
    raw=unescape(raw)
    if raw.startswith(("#","mailto:","tel:","javascript:","data:","http:","https:","//")): return raw
    clean=raw.split("#",1)[0].split("?",1)[0]
    if not clean.lower().endswith(".html"): return raw
    p=(owner.parent/clean).resolve()
    try: return "#/"+p.relative_to(ROOT).as_posix()
    except ValueError: return raw

def page_scripts(doc, page):
    out=[]
    for m in re.finditer(r'<script\b([^>]*)>(.*?)</script\s*>',doc,re.I|re.S):
        attrs,inline=m.group(1),m.group(2)
        typ=re.search(r'\btype\s*=\s*(["\'])(.*?)\1',attrs,re.I)
        if typ and typ.group(2).lower() not in ("text/javascript","application/javascript","module"): continue
        src=re.search(r'\bsrc\s*=\s*(["\'])(.*?)\1',attrs,re.I)
        if src: code=local_path(page,src.group(2)).read_text(encoding="utf-8")
        elif inline.strip(): code=inline
        else: continue
        code=code.replace('const root = new URL("../../", script.src);','const root = new URL("./", location.href);')
        code=code.replace('const url = (path) => new URL(path, root).href;','const url = (path) => "#/" + path.replace(/^\\.\\//, "");')
        code=code.replace('const routePath = (path) => { const pathname = new URL(path, root).pathname; return pathname.endsWith("/") ? pathname.slice(0,-1) : pathname; };','const routePath = (path) => "/" + path.split("/").filter(Boolean).join("/");')
        code=re.sub(r'window\.location\.pathname|location\.pathname','window.__CONTROL_ROUTE__',code)
        out.append(code)
    return out

pages={}
styles=[]
for page in HTML_FILES:
    doc=page.read_text(encoding="utf-8")
    bm=re.search(r'<body\b[^>]*>(.*?)</body\s*>',doc,re.I|re.S)
    if not bm: raise RuntimeError("Missing body: "+str(page))
    body=re.sub(r'<script\b[^>]*>.*?</script\s*>','',bm.group(1),flags=re.I|re.S)
    body=re.sub(r'(\bhref\s*=\s*)(["\'])(.*?)\2',lambda m:m.group(1)+m.group(2)+route_href(m.group(3),page)+m.group(2),body,flags=re.I)
    for lm in re.finditer(r'<link\b([^>]*)>',doc,re.I|re.S):
        attrs=lm.group(1)
        rel=re.search(r'\brel\s*=\s*(["\'])(.*?)\1',attrs,re.I)
        href=re.search(r'\bhref\s*=\s*(["\'])(.*?)\1',attrs,re.I)
        if rel and rel.group(2).lower()=="stylesheet" and href:
            cp=local_path(page,href.group(2)); styles.append(css_inline(cp.read_text(encoding="utf-8"),cp))
    styles += [css_inline(m.group(1),page) for m in re.finditer(r'<style\b[^>]*>(.*?)</style\s*>',doc,re.I|re.S)]
    pages["/"+page.relative_to(ROOT).as_posix()]={"body":body,"scripts":page_scripts(doc,page)}

if "/index.html" not in pages or len(pages)<10: raise RuntimeError("Incomplete page discovery: "+str(len(pages)))
uniq=[]; seen=set()
for s in styles:
    if s not in seen: seen.add(s); uniq.append(s)
data=json.dumps(pages,ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
css="\n".join(uniq).replace("</style","<\\/style")
html='''<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#14243d"><title>سامانه کنترل مصرف و ارسال کالا | نسخه مستقل آفلاین</title><style>'''+css+'''</style><style>html,body{min-height:100%;margin:0}#offline-root{min-height:100vh}.offline-build-note{position:fixed;z-index:99999;bottom:8px;left:8px;padding:4px 8px;border-radius:8px;background:#14243d;color:#fff;font:11px sans-serif;opacity:.72;pointer-events:none}</style></head><body><div id="offline-root"></div><div class="offline-build-note">نسخه مستقل آفلاین</div><script>const OFFLINE_PAGES='''+data+''';
const root=document.getElementById("offline-root");
function currentRoute(){let p=decodeURIComponent(location.hash.replace(/^#\\/?/,""));if(!p)p="index.html";p="/"+p.replace(/^\\/+/, "");if(!OFFLINE_PAGES[p])p="/index.html";return p;}
function renderRoute(){const route=currentRoute();window.__CONTROL_ROUTE__=route;const page=OFFLINE_PAGES[route];root.innerHTML=page.body;document.querySelectorAll("script[data-offline-page]").forEach(n=>n.remove());for(const code of page.scripts){const s=document.createElement("script");s.dataset.offlinePage="1";s.textContent=code+"\\n//# sourceURL=offline-page-script.js";document.body.appendChild(s);}window.scrollTo(0,0);}
window.addEventListener("hashchange",renderRoute);renderRoute();</script></body></html>'''
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(html,encoding="utf-8")
if re.search(r'<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["\']https?://',html,re.I): raise RuntimeError("Remote executable dependency found")
if "indexedDB" not in html: raise RuntimeError("IndexedDB database implementation not bundled")
print(f"Built {OUT.relative_to(ROOT)}: {len(pages)} pages, {len(uniq)} stylesheets, {OUT.stat().st_size:,} bytes")
