import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ButtonWindow, Spinner, Text } from "@cypher-asi/zui";
import { Save } from "lucide-react";
import hljs from "highlight.js/lib/common";
import { api } from "../api/client";
import { filenameFromPath, langFromPath } from "../ide/lang";
import { windowCommand } from "../lib/windowCommand";
import styles from "./IdeView.module.css";

const MAX_HIGHLIGHT_SIZE = 100_000;

export function IdeView() {
  const [params] = useSearchParams();
  const filePath = params.get("file") ?? "";

  const [content, setContent] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const dirty = content !== null && savedContent !== null && content !== savedContent;
  const language = useMemo(() => langFromPath(filePath), [filePath]);
  const filename = filenameFromPath(filePath);

  useEffect(() => {
    if (!filePath) {
      setError("No file specified");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);
    setSavedContent(null);
    setSaveError(null);

    api
      .readFile(filePath)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.content != null) {
          setContent(res.content);
          setSavedContent(res.content);
        } else {
          setError(res.error ?? "Failed to read file");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const handleSave = useCallback(async () => {
    if (content == null || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.writeFile(filePath, content);
      if (res.ok) {
        setSavedContent(content);
      } else {
        setSaveError(res.error ?? "Failed to save");
      }
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }, [filePath, content, saving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
  }, []);

  const handleTab = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        setContent(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [],
  );

  const highlightedHtml = useMemo(() => {
    if (content == null) return "";
    if (content.length > MAX_HIGHLIGHT_SIZE) {
      return content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(content, { language }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch {
      return content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }, [content, language]);

  const lineCount = content ? content.split("\n").length : 0;
  const displayTitle = dirty ? `\u25CF ${filename}` : filename;

  return (
    <div className={styles.root}>
      {/* ---- Titlebar ---- */}
      <div
        className={styles.titlebar}
        onDoubleClick={() => windowCommand("maximize")}
      >
        <div className={styles.titlebarTitle}>{displayTitle}</div>
        <div className={styles.titlebarActions}>
          <ButtonWindow action="minimize" size="sm" onClick={() => windowCommand("minimize")} />
          <ButtonWindow action="maximize" size="sm" onClick={() => windowCommand("maximize")} />
          <ButtonWindow action="close" size="sm" onClick={() => windowCommand("close")} />
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className={styles.body}>
        {/* Sidebar placeholder for future file explorer */}
        <div className={styles.sidebar} />

        <div className={styles.editorPane}>
          {/* Tab bar */}
          <div className={styles.tabBar}>
            <button className={`${styles.tab} ${styles.active} ${dirty ? styles.dirty : ""}`}>
              <span className={styles.tabDot} />
              {filename}
            </button>
          </div>

          {/* Editor content */}
          {loading && (
            <div className={styles.loading}>
              <Spinner size="md" />
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <Text variant="primary">{error}</Text>
            </div>
          )}

          {!loading && !error && content != null && (
            <div className={styles.editorBody}>
              <div ref={gutterRef} className={styles.gutter}>
                {Array.from({ length: lineCount }, (_, i) => (
                  <span key={i} className={styles.gutterLine}>
                    {i + 1}
                  </span>
                ))}
              </div>
              <div className={styles.editorContainer}>
                <pre ref={highlightRef} className={styles.codeHighlight} aria-hidden>
                  <code
                    className={language ? `hljs language-${language}` : "hljs"}
                    dangerouslySetInnerHTML={{ __html: highlightedHtml + "\n" }}
                  />
                </pre>
                <textarea
                  ref={textareaRef}
                  className={styles.codeArea}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onScroll={handleScroll}
                  onKeyDown={handleTab}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Status bar ---- */}
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>{language ?? "plain text"}</span>
        {lineCount > 0 && <span className={styles.statusItem}>{lineCount} lines</span>}
        {saveError && <span className={styles.statusItem} style={{ color: "var(--color-danger)" }}>{saveError}</span>}
        {saving && <span className={styles.statusItem}>Saving...</span>}
        <span style={{ flex: 1 }} />
        <span className={styles.statusItem}>{filePath}</span>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            background: "none",
            border: "none",
            cursor: dirty ? "pointer" : "default",
            padding: "2px 4px",
            color: dirty ? "var(--color-text-primary)" : "var(--color-text-muted)",
            display: "flex",
            alignItems: "center",
          }}
          title="Save (Ctrl+S)"
        >
          <Save size={12} />
        </button>
      </div>
    </div>
  );
}
