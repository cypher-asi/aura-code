import { useState, useEffect } from "react";
import { Text, Badge } from "@cypher-asi/zui";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../../../api/client";
import type { HarnessSkill } from "../../../types";
import previewStyles from "../../../components/Preview/Preview.module.css";

interface SkillPreviewProps {
  skill: HarnessSkill;
}

export function SkillPreview({ skill: initial }: SkillPreviewProps) {
  const [skill, setSkill] = useState(initial);
  const [loading, setLoading] = useState(!initial.body);

  useEffect(() => {
    setSkill(initial);
    if (initial.body && initial.description) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.harnessSkills.getSkill(initial.name).then((full) => {
      if (!cancelled) {
        setSkill((prev) => ({ ...prev, ...full }));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [initial]);

  return (
    <>
      <div className={previewStyles.taskMeta}>
        <div className={previewStyles.taskField}>
          <span className={previewStyles.fieldLabel}>Name</span>
          <Text size="sm">{skill.name}</Text>
        </div>
        {skill.description && (
          <div className={previewStyles.taskField}>
            <span className={previewStyles.fieldLabel}>Description</span>
            <Text size="sm" variant="secondary">{skill.description}</Text>
          </div>
        )}
        <div className={previewStyles.taskField}>
          <span className={previewStyles.fieldLabel}>Source</span>
          <Badge variant="stopped">{skill.source}</Badge>
        </div>
        {skill.frontmatter?.["allowed-tools"] && (
          <div className={previewStyles.taskField}>
            <span className={previewStyles.fieldLabel}>Allowed Tools</span>
            <Text size="sm" variant="secondary">
              {(skill.frontmatter["allowed-tools"] as string[]).join(", ")}
            </Text>
          </div>
        )}
        {skill.frontmatter?.model && (
          <div className={previewStyles.taskField}>
            <span className={previewStyles.fieldLabel}>Model</span>
            <Text size="sm" variant="secondary">{skill.frontmatter.model}</Text>
          </div>
        )}
        {skill.frontmatter?.context && (
          <div className={previewStyles.taskField}>
            <span className={previewStyles.fieldLabel}>Context</span>
            <Badge variant="running">{skill.frontmatter.context}</Badge>
          </div>
        )}
      </div>
      {loading && (
        <div className={previewStyles.taskMeta} style={{ alignItems: "center", padding: "var(--space-4) 0" }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
        </div>
      )}
      {!loading && skill.body && (
        <div className={previewStyles.taskMeta}>
          <span className={previewStyles.fieldLabel}>Skill File</span>
        </div>
      )}
      {!loading && skill.body && (
        <div className={previewStyles.specMarkdown}>
          <div className={previewStyles.markdown}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {skill.body}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </>
  );
}
