#!/usr/bin/env python3
"""Publish Markdown content to Ghost blog via Admin API.

Usage:
    # From a file
    python3 publish_ghost.py article.md --title "My Title" --tags "tag1,tag2"

    # From inline content
    python3 publish_ghost.py --content "# Hello\n\nWorld" --title "Hello"

    # As draft
    python3 publish_ghost.py article.md --title "My Title" --status draft
"""

import argparse
import json
import base64
import hmac
import hashlib
import re
import time
import sys
from pathlib import Path
from urllib import request, error
from urllib.parse import quote

try:
    import markdown
except ImportError:
    print("Error: markdown package not found. Install with: pip install markdown", file=sys.stderr)
    sys.exit(1)


# ─── Config Loading ───────────────────────────────────────────────

def load_config() -> dict:
    """Load Ghost config from skill config.json, falling back to ~/.publish_config.json."""
    # 1. Skill-local config
    skill_config = Path(__file__).parent.parent / "config.json"
    if skill_config.exists():
        with open(skill_config, "r", encoding="utf-8") as f:
            return json.load(f)

    # 2. Legacy ~/.publish_config.json
    home_config = Path.home() / ".publish_config.json"
    if home_config.exists():
        with open(home_config, "r", encoding="utf-8") as f:
            cfg = json.load(f)
            return cfg.get("ghost", cfg)

    print("Error: No config found. Create ~/.agents/skills/blog-publisher/config.json with:", file=sys.stderr)
    print('{"url": "https://your-blog.com", "admin_api_key": "key_id:secret"}', file=sys.stderr)
    sys.exit(1)


GHOST_CFG = load_config()
GHOST_URL = GHOST_CFG["url"].rstrip("/")
ADMIN_API_KEY = GHOST_CFG["admin_api_key"]
KEY_ID, SECRET = ADMIN_API_KEY.split(":")


# ─── JWT & API ────────────────────────────────────────────────────

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_jwt(key_id: str, secret_hex: str) -> str:
    iat = int(time.time())
    exp = iat + 300  # 5 min validity
    header = {"alg": "HS256", "typ": "JWT", "kid": key_id}
    payload = {"iat": iat, "exp": exp, "aud": "/admin/"}

    header_b64 = b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}"

    secret_bytes = bytes.fromhex(secret_hex)
    signature = hmac.new(secret_bytes, signing_input.encode(), hashlib.sha256).digest()
    signature_b64 = b64url_encode(signature)

    return f"{signing_input}.{signature_b64}"


def ghost_api_call(endpoint: str, data: dict = None, method: str = "GET") -> dict:
    token = generate_jwt(KEY_ID, SECRET)
    url = f"{GHOST_URL}/ghost/api/admin/{endpoint}"
    headers = {
        "Authorization": f"Ghost {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }

    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req = request.Request(url, data=body, headers=headers, method=method)
    else:
        req = request.Request(url, headers=headers, method=method)

    try:
        with request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {err_body}", file=sys.stderr)
        raise


# ─── Helpers ──────────────────────────────────────────────────────

def extract_title(md: str, fallback: str = "未命名文章") -> str:
    """Extract first H1 heading from Markdown."""
    match = re.search(r"^#\s+(.+)$", md, re.MULTILINE)
    return match.group(1).strip() if match else fallback


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title (handles CJK)."""
    # Try ASCII-only slug first
    slug = re.sub(r"[^\w\s-]", "", title.strip())
    slug = re.sub(r"[-\s]+", "-", slug).strip("-").lower()

    if not slug:
        # CJK: use URL-encoded title
        slug = quote(title.strip(), safe="")[:80]
        slug = re.sub(r"%", "-", slug)

    return slug or f"post-{int(time.time())}"


# ─── Main ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Publish Markdown to Ghost blog")
    parser.add_argument("md_file", nargs="?", help="Path to Markdown file")
    parser.add_argument("--content", help="Inline Markdown content")
    parser.add_argument("--title", help="Post title (auto from H1 if omitted)")
    parser.add_argument("--slug", help="URL slug (auto from title if omitted)")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--status", default="published", choices=["published", "draft"])
    parser.add_argument("--featured", action="store_true", help="Feature this post")
    args = parser.parse_args()

    # Get Markdown content
    if args.content:
        md_content = args.content
    elif args.md_file:
        md_path = Path(args.md_file)
        if not md_path.exists():
            print(f"Error: File not found: {md_path}", file=sys.stderr)
            sys.exit(1)
        md_content = md_path.read_text(encoding="utf-8")
    else:
        parser.error("Provide either a markdown file path or --content")

    # Determine title & slug
    title = args.title or extract_title(md_content)
    slug = args.slug or generate_slug(title)

    # Convert Markdown to HTML
    html_content = markdown.markdown(md_content, extensions=["tables", "fenced_code"])

    # Parse tags
    tags = [{"name": t.strip()} for t in args.tags.split(",") if t.strip()]

    # Build payload
    post_payload = {
        "posts": [{
            "title": title,
            "slug": slug,
            "html": html_content,
            "status": args.status,
            "feature_image": None,
            "featured": args.featured,
            "tags": tags,
        }]
    }

    # Publish
    print(f"Publishing '{title}' to Ghost...")
    result = ghost_api_call("posts/?source=html", post_payload, method="POST")
    post = result["posts"][0]
    public_url = f"{GHOST_URL}/posts/{post['slug']}/"

    print(f"✅ Published successfully!")
    print(f"Title: {post['title']}")
    print(f"URL: {public_url}")
    print(f"Slug: {post['slug']}")
    print(f"Status: {post['status']}")
    print(f"Published at: {post.get('published_at', 'N/A')}")


if __name__ == "__main__":
    main()
