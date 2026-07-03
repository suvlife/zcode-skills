---
name: blog-publisher
description: Publish Markdown content to Ghost blog via Admin API. Use when the user says "发博客", "发布到博客", "发到Ghost", "publish to blog", or wants to publish written content to their Ghost CMS. Supports creating posts with title, tags, slug, and draft/published status. Auto-extracts title from H1 heading if not specified.
triggers:
  - 发博客
  - 发布到博客
  - 发到Ghost
  - publish to blog
  - publish to ghost
---

# Blog Publisher (Ghost CMS)

Publish Markdown content to a Ghost blog via the Ghost Admin API.

## When to Use

- User says "发博客" / "发布到博客" / "发到Ghost" / "publish to blog"
- User has written Markdown content and wants to publish it
- User wants to create a draft post on Ghost
- User wants to publish analysis/research output to their blog

## Configuration

Config is stored at `~/.agents/skills/blog-publisher/config.json`. If missing, create it:

```json
{
  "url": "https://blog.example.com",
  "admin_api_key": "key_id:secret_hex"
}
```

## How to Publish

### Option A: Publish a Markdown file

```bash
python3 ~/.agents/skills/blog-publisher/scripts/publish_ghost.py article.md \
  --title "My Post Title" \
  --slug "my-post-slug" \
  --tags "tag1,tag2,tag3" \
  --status published
```

### Option B: Publish inline Markdown content

```bash
python3 ~/.agents/skills/blog-publisher/scripts/publish_ghost.py \
  --content "# Hello World\n\nThis is my post." \
  --title "Hello World" \
  --slug "hello-world" \
  --tags "test" \
  --status published
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `md_file` | One of md_file/content | — | Path to Markdown file |
| `--content` | One of md_file/content | — | Inline Markdown string |
| `--title` | No | Auto from H1 | Post title |
| `--slug` | No | Auto from title | URL slug |
| `--tags` | No | "" | Comma-separated tags |
| `--status` | No | published | `published` or `draft` |
| `--featured` | No | false | Feature the post |

## Workflow

1. Prepare Markdown content (tables, code blocks, images all supported)
2. Determine title (user-specified > first H1 > filename)
3. Generate slug (from title, transliterated for CJK)
4. Call the publish script
5. Return the public URL to the user

## Notes

- Markdown is converted to HTML via `python-markdown` with `tables` and `fenced_code` extensions
- Ghost Admin API uses JWT authentication (HS256)
- The config file uses the same format as `~/.publish_config.json` for compatibility
- If `~/.publish_config.json` exists, it will be used as fallback
- Posts are published immediately by default; use `--status draft` for drafts
