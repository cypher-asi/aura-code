import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders paragraphs", () => {
    const result = renderMarkdown("Hello world");
    expect(result).toContain("<p>");
    expect(result).toContain("Hello world");
  });

  it("renders headings", () => {
    const result = renderMarkdown("# Title");
    expect(result).toContain("<h1");
    expect(result).toContain("Title");
  });

  it("renders bold text", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toContain("<strong>");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("`code`");
    expect(result).toContain("<code>");
    expect(result).toContain("code");
  });

  it("renders fenced code blocks with syntax highlighting", () => {
    const md = "```typescript\nconst x = 1;\n```";
    const result = renderMarkdown(md);
    expect(result).toContain("<pre>");
    expect(result).toContain("<code");
    expect(result).toContain("language-typescript");
  });

  it("renders code blocks without language as auto-highlighted", () => {
    const md = "```\nconst x = 1;\n```";
    const result = renderMarkdown(md);
    expect(result).toContain("<pre>");
    expect(result).toContain("hljs");
  });

  it("renders unordered lists", () => {
    const md = "- item 1\n- item 2";
    const result = renderMarkdown(md);
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
  });

  it("escapes HTML in code blocks to prevent XSS", () => {
    const md = '```\n<script>alert("xss")</script>\n```';
    const result = renderMarkdown(md);
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).not.toContain('<script>alert');
  });

  it("handles empty string", () => {
    const result = renderMarkdown("");
    expect(result).toBe("");
  });

  it("handles GFM line breaks", () => {
    const result = renderMarkdown("line1\nline2");
    expect(result).toContain("<br");
  });

  it("falls back to escaped HTML for very large code blocks", () => {
    const bigCode = "x".repeat(100_001);
    const md = "```\n" + bigCode + "\n```";
    const result = renderMarkdown(md);
    expect(result).toContain("hljs");
    expect(result).not.toContain("language-");
  });
});
