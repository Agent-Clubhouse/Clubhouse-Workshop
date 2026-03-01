// ---------------------------------------------------------------------------
// MissionInput — Text area for assigning a mission to a group
// ---------------------------------------------------------------------------

const React = globalThis.React;
const { useState, useCallback } = React;

interface MissionInputProps {
  onSubmit: (mission: string) => void;
  disabled: boolean;
  hasLeader: boolean;
  memberCount: number;
}

export function MissionInput({ onSubmit, disabled, hasLeader, memberCount }: MissionInputProps) {
  const [text, setText] = useState("");

  const canSubmit = text.trim().length > 0 && hasLeader && memberCount >= 1 && !disabled;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(text.trim());
    setText("");
  }, [text, canSubmit, onSubmit]);

  let hint = "";
  if (memberCount === 0) hint = "Add at least one member before assigning work.";
  else if (!hasLeader) hint = "Designate a group leader before assigning work.";
  else if (disabled) hint = "Group is already planning or executing.";

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{
        margin: "0 0 8px 0",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: "var(--font-family)",
      }}>
        Assign Work
      </h3>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe what you want this group to accomplish..."
        rows={4}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 13,
          borderRadius: 6,
          border: "1px solid var(--border-primary)",
          background: disabled ? "var(--bg-surface)" : "var(--bg-primary)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-family)",
          resize: "vertical",
          boxSizing: "border-box",
          lineHeight: 1.5,
          opacity: disabled ? 0.6 : 1,
        }}
      />

      {hint && (
        <div style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          marginTop: 4,
          fontFamily: "var(--font-family)",
        }}>
          {hint}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid var(--border-accent)",
            background: canSubmit ? "var(--bg-accent)" : "var(--bg-surface)",
            color: canSubmit ? "var(--text-accent)" : "var(--text-muted)",
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "var(--font-family)",
          }}
        >
          Start Mission
        </button>
      </div>
    </div>
  );
}
