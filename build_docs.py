"""Bundle the FOMA docs (content, styles, runtime) into one self-contained HTML page."""
import pathlib, re

root = pathlib.Path(__file__).parent
d = root / "docs"
core = (root / "src" / "core.js").read_text()
m = re.search(r"^const EMBLEM = (\{.*?^\});", core, re.S | re.M)
if not m:
    raise SystemExit("emblems not found in src/core.js")
emblems = "const EMBLEMS = " + m.group(1) + ";"
md = (d / "content.md").read_text()
js = "\n".join([emblems] + [(d / n).read_text() for n in ["docs-core.js", "docs-widgets.js", "docs-app.js"]])
for name, text in [("content", md), ("script", js)]:
    if "</script" in text.lower():
        raise SystemExit(f"{name} contains a closing script tag")
html = (d / "shell.html").read_text().replace("/*__CSS__*/", (d / "docs.css").read_text()).replace("/*__MD__*/", md).replace("/*__JS__*/", js)
out = root / "dist" / "docs.html"
out.write_text(html)
print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")
