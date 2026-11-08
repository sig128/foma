"""Bundle FOMA's source files into one self-contained HTML page."""
import json, pathlib, sys

root = pathlib.Path(__file__).parent
src = root / "src"
logos_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "logos.json"
out = root / "dist" / "foma.html"

logos = json.loads(logos_path.read_text())
css = (src / "styles.css").read_text()
js_parts = [f"const LOGOS = {json.dumps(logos, separators=(',', ':'))};"]
for name in ["data.js", "core.js", "views.js", "exec.js", "ai.js", "boot.js"]:
    js_parts.append(f"// ---- {name} ----\n" + (src / name).read_text())
js = "\n".join(js_parts)
if "</script" in js.lower():
    raise SystemExit("script contains a closing script tag")
shell = (src / "shell.html").read_text()
html = shell.replace("/*__CSS__*/", css).replace("/*__JS__*/", js)
out.parent.mkdir(exist_ok=True)
out.write_text(html)
(root / "dist" / "app.js").write_text("(() => {\n'use strict';\n" + js + "\n})();\n")
print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
