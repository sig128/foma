"""Bundle FOMA's app source into one self-contained page, dist/foma.html, for Claude artifacts."""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
JS_FILES = ["data.js", "core.js", "views.js", "exec.js", "ai.js", "boot.js"]


def bundle(logos_path=None):
    """Return (shell_html, css, js) for the app."""
    logos = json.loads(pathlib.Path(logos_path or ROOT / "logos.json").read_text())
    parts = [f"const LOGOS = {json.dumps(logos, separators=(',', ':'))};"]
    parts += [f"// ---- {name} ----\n" + (SRC / name).read_text() for name in JS_FILES]
    js = "\n".join(parts)
    if "</script" in js.lower():
        raise SystemExit("app script contains a closing script tag")
    return (SRC / "shell.html").read_text(), (SRC / "styles.css").read_text(), js


def main():
    shell, css, js = bundle(sys.argv[1] if len(sys.argv) > 1 else None)
    out = ROOT / "dist" / "foma.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(shell.replace("/*__CSS__*/", css).replace("/*__JS__*/", js))
    (ROOT / "dist" / "app.js").write_text("(() => {\n'use strict';\n" + js + "\n})();\n")
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
