import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Sidebar, Button, Text } from "@cypher-asi/zui";
import { X } from "lucide-react";
import { useSidekick } from "../context/SidekickContext";
import { StatusBadge } from "./StatusBadge";
import type { PreviewItem } from "../context/SidekickContext";
import styles from "./Preview.module.css";

function SpecPreview({ spec }: { spec: import("../types").Spec }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {spec.markdown_contents}
      </ReactMarkdown>
    </div>
  );
}

function TaskPreview({ task }: { task: import("../types").Task }) {
  return (
    <>
      <div className={styles.taskMeta}>
        <Text variant="muted" size="sm" as="span">Status</Text>
        <span><StatusBadge status={task.status} /></span>
        <Text variant="muted" size="sm" as="span">Description</Text>
        <Text size="sm" as="span">{task.description || "—"}</Text>
        {task.execution_notes && (
          <>
            <Text variant="muted" size="sm" as="span">Exec Notes</Text>
            <Text size="sm" as="span">{task.execution_notes}</Text>
          </>
        )}
      </div>
    </>
  );
}

function previewTitle(item: PreviewItem): string {
  return item.kind === "spec" ? item.spec.title : item.task.title;
}

export function Preview() {
  const { previewItem, closePreview } = useSidekick();

  if (!previewItem) return null;

  return (
    <Sidebar
      className={styles.previewPanel}
      resizable
      resizePosition="left"
      defaultWidth={320}
      minWidth={200}
      maxWidth={600}
      storageKey="aura-preview"
      header={
        <div className={styles.previewHeader}>
          <Text size="sm" className={styles.previewTitle} style={{ fontWeight: 600 }}>
            {previewTitle(previewItem)}
          </Text>
          <Button variant="ghost" size="sm" iconOnly icon={<X size={14} />} onClick={closePreview} />
        </div>
      }
    >
      <div className={styles.previewBody}>
        {previewItem.kind === "spec" && <SpecPreview spec={previewItem.spec} />}
        {previewItem.kind === "task" && <TaskPreview task={previewItem.task} />}
      </div>
    </Sidebar>
  );
}
