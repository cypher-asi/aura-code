/**
 * Split text into alternating prose / fenced-code segments so that
 * text-processing helpers can leave code blocks untouched.
 */
export function splitByCodeFences(text: string): { content: string; isCode: boolean }[] {
  const segments: { content: string; isCode: boolean }[] = [];
  const fenceRe = /^ {0,3}(`{3,}|~{3,})/gm;
  let cursor = 0;
  let insideCode = false;
  let openFenceChar = "";
  let openFenceLen = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    const fenceChar = match[1][0];
    const fenceLen = match[1].length;

    if (!insideCode) {
      if (match.index > cursor) {
        segments.push({ content: text.slice(cursor, match.index), isCode: false });
      }
      cursor = match.index;
      insideCode = true;
      openFenceChar = fenceChar;
      openFenceLen = fenceLen;
    } else if (fenceChar === openFenceChar && fenceLen >= openFenceLen) {
      const lineEnd = text.indexOf("\n", match.index);
      const blockEnd = lineEnd === -1 ? text.length : lineEnd + 1;
      segments.push({ content: text.slice(cursor, blockEnd), isCode: true });
      cursor = blockEnd;
      insideCode = false;
    }
  }

  if (cursor < text.length) {
    segments.push({ content: text.slice(cursor), isCode: insideCode });
  }

  return segments;
}

export function stripEmojis(text: string): string {
  return splitByCodeFences(text)
    .map((seg) =>
      seg.isCode
        ? seg.content
        : seg.content
            .replace(/\p{Extended_Pictographic}/gu, "")
            .replace(/ {2,}/g, " "),
    )
    .join("");
}

/** Collapse accidental paragraph breaks in prose, preserving code blocks. */
function normalizeProseBreaks(prose: string): string {
  return prose.replace(/\n\n+/g, (match, offset) => {
    const before = prose.slice(0, offset).split("\n");
    const after = prose.slice(offset + match.length).split("\n");

    const lastLine = before[before.length - 1]?.trim() ?? "";
    const nextLine = after.find((line) => line.trim().length > 0)?.trim() ?? "";

    const looksLikeTableRow = (line: string) => /^\|.+\|\s*$/.test(line);
    if (looksLikeTableRow(lastLine) && looksLikeTableRow(nextLine)) {
      return "\n";
    }

    const looksLikeSentenceEnd = /[.!?:]\s*$/.test(lastLine);
    const looksLikeMarkdownBlock =
      /^(?:[-*+]\s+|#+\s+|\d+[.)]\s+)/.test(lastLine) ||
      /^(?:[-*+]\s+|#+\s+|\d+[.)]\s+)/.test(nextLine);
    const looksLikeSpecIndex = /^\d{1,3}:\s+/.test(lastLine);
    const looksLikeWrappedSentence =
      /[a-z,]$/.test(lastLine) && /^[a-z]/.test(nextLine);

    if (looksLikeSentenceEnd || looksLikeMarkdownBlock || looksLikeSpecIndex) {
      return match;
    }

    return looksLikeWrappedSentence ? " " : match;
  });
}

export function normalizeMidSentenceBreaks(text: string): string {
  return splitByCodeFences(text)
    .map((seg) => (seg.isCode ? seg.content : normalizeProseBreaks(seg.content)))
    .join("");
}
