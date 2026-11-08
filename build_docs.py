"""Bundle the FOMA docs (content, styles, runtime) into one self-contained page, dist/docs.html."""
import pathlib, re

ROOT = pathlib.Path(__file__).parent
DOCS = ROOT / "docs"
JS_FILES = ["docs-core.js", "docs-widgets.js", "docs-app.js"]


def bundle():
    """Return (shell_html, css, markdown, js) for the docs."""
    core = (ROOT / "src" / "core.js").read_text()
    m = re.search(r"^const EMBLEM = (\{.*?^\});", core, re.S | re.M)
    if not m:
        raise SystemExit("emblems not found in src/core.js")
    md = (DOCS / "content.md").read_text()
    js = "\n".join(["const EMBLEMS = " + m.group(1) + ";"] + [(DOCS / n).read_text() for n in JS_FILES])
    for name, text in [("content", md), ("script", js)]:
        if "</script" in text.lower():
            raise SystemExit(f"{name} contains a closing script tag")
    return (DOCS / "shell.html").read_text(), (DOCS / "docs.css").read_text(), md, js


def render(shell, css, md, js):
    return shell.replace("/*__CSS__*/", css).replace("/*__MD__*/", md).replace("/*__JS__*/", js)


def main():
    out = ROOT / "dist" / "docs.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(render(*bundle()))
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
