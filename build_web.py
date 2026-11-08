"""Build the public website into public/: the app at / and the docs at /docs.

The artifact pages in dist/ are fragments that rely on Claude's page wrapper. The website
needs full documents, its own icons, and links between app and docs that stay on the site.
"""
import pathlib, shutil

import build
import build_docs

ROOT = pathlib.Path(__file__).parent
PUB = ROOT / "public"
BRAND = ROOT / "brand"
APP_ARTIFACT = "https://claude.ai/artifact/TDYxUeAktuvFsbACz5R2b3"
DOCS_ARTIFACT = "https://claude.ai/artifact/1vCpDxYFkBoiWMJbiGAfBc"

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0A09">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FOMA">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="/og.png">
<meta name="twitter:card" content="summary_large_image">
"""


def document(shell, title, desc, fill_head, fill_body):
    """Turn an artifact shell (head tags, a style block, then body markup) into a full HTML document."""
    head, body = shell.split("</style>", 1)
    head = "\n".join(line for line in head.splitlines() if "claude:" not in line)
    return (HEAD.format(title=title, desc=desc) + fill_head(head) + "</style>\n</head>\n<body>\n"
            + fill_body(body).strip() + "\n</body>\n</html>\n")


def swap(text, old, new):
    if old not in text:
        raise SystemExit(f"expected link not found: {old}")
    return text.replace(old, new)


def main():
    if PUB.exists():
        shutil.rmtree(PUB)
    (PUB / "docs").mkdir(parents=True)

    shell, css, js = build.bundle()
    js = swap(js, DOCS_ARTIFACT, "/docs")
    app = document(shell, "FOMA", "Memecoin trading where every call comes with receipts.",
                   lambda h: h.replace("/*__CSS__*/", css), lambda b: b.replace("/*__JS__*/", js))
    (PUB / "index.html").write_text(app)

    dshell, dcss, md, djs = build_docs.bundle()
    djs = swap(djs, APP_ARTIFACT, "/")
    docs = document(dshell, "FOMA Docs", "How FOMA works: ideas with receipts, execution policy, order states, fees and records.",
                    lambda h: h.replace("/*__CSS__*/", dcss), lambda b: b.replace("/*__MD__*/", md).replace("/*__JS__*/", djs))
    (PUB / "docs" / "index.html").write_text(docs)

    for src, dst in [("foma-mark.svg", "favicon.svg"), ("icon-192.png", "icon-192.png"), ("apple-touch-icon.png", "apple-touch-icon.png"),
                     ("foma-icon-512.png", "icon-512.png"), ("og.png", "og.png")]:
        shutil.copyfile(BRAND / src, PUB / dst)
    for f in sorted(PUB.rglob("*")):
        if f.is_file():
            print(f"{f.relative_to(ROOT)}  {f.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
