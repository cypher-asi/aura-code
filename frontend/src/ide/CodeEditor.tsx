import { useEffect, useMemo, useState } from "react";
import { Modal, Spinner, Text } from "@cypher-asi/zui";
import hljs from "highlight.js";
import { api } from "../api/client";
import { langFromPath, filenameFromPath } from "./lang";
import styles from "./CodeEditor.module.css";

export interface CodeEditorProps {
  filePath: string;
  onClose: () => void;
}

export function CodeEditor({ filePath, onClose }: CodeEditorProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    api
      .readFile(filePath)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.content != null) {
          setContent(res.content);
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

  const highlighted = useMemo(() => {
    if (content == null) return "";
    const lang = langFromPath(filePath);
    try {
      if (lang) {
        return hljs.highlight(content, { language: lang }).value;
      }
      return hljs.highlightAuto(content).value;
    } catch {
      return escapeHtml(content);
    }
  }, [content, filePath]);

  const lineCount = content ? content.split("\n").length : 0;
  const filename = filenameFromPath(filePath);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={filename}
      subtitle={filePath}
      size="xl"
      fullHeight
      noPadding
    >
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
          <div className={styles.gutter}>
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className={styles.gutterLine}>
                {i + 1}
              </span>
            ))}
          </div>
          <pre className={styles.codeArea}>
            <code
              className="hljs"
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        </div>
      )}
    </Modal>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
