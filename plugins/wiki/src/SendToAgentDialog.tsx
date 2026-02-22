const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

import type { PluginAPI, AgentInfo } from '@clubhouse/plugin-types';
import { color, font, overlay, dialog, baseInput } from './styles';

// ── Props ────────────────────────────────────────────────────────────────

interface SendToAgentDialogProps {
  api: PluginAPI;
  filePath: string;
  content: string;
  onClose: () => void;
}

// ── Status badge helper ──────────────────────────────────────────────────

function statusBadge(status: AgentInfo['status']) {
  const base: React.CSSProperties = {
    fontSize: 9,
    padding: '1px 4px',
    borderRadius: 4,
  };

  switch (status) {
    case 'sleeping':
      return React.createElement('span', {
        style: { ...base, background: 'rgba(34, 197, 94, 0.15)', color: color.textSuccess },
      }, 'sleeping');
    case 'running':
      return React.createElement('span', {
        style: { ...base, background: 'rgba(234, 179, 8, 0.15)', color: color.textWarning },
      }, 'running');
    case 'error':
      return React.createElement('span', {
        style: { ...base, background: 'rgba(248, 113, 113, 0.15)', color: color.textError },
      }, 'error');
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────

export function SendToAgentDialog({ api, filePath, content, onClose }: SendToAgentDialogProps) {
  const [instructions, setInstructions] = useState('');
  const [durableAgents, setDurableAgents] = useState<AgentInfo[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load durable agents on mount
  useEffect(() => {
    const agents = api.agents.list().filter((a) => a.kind === 'durable');
    setDurableAgents(agents);
  }, [api]);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Build mission string
  const buildMission = useCallback((): string => {
    const parts = [
      `Wiki page: ${filePath}`,
      '',
      'Page content:',
      '```markdown',
      content,
      '```',
    ];
    if (instructions.trim()) {
      parts.push('', `Additional instructions: ${instructions.trim()}`);
    }
    return parts.join('\n');
  }, [filePath, content, instructions]);

  // Durable agent handler
  const handleDurableAgent = useCallback(async (agent: AgentInfo) => {
    if (agent.status === 'running') {
      const ok = await api.ui.showConfirm(
        `"${agent.name}" is currently running. Sending this page will interrupt its current work. Continue?`
      );
      if (!ok) return;
      await api.agents.kill(agent.id);
    }

    const mission = buildMission();
    try {
      await api.agents.resume(agent.id, { mission });
      api.ui.showNotice(`Wiki page sent to ${agent.name}`);
    } catch {
      api.ui.showError(`Failed to send to ${agent.name}`);
    }
    onClose();
  }, [api, buildMission, onClose]);

  const AgentAvatar = api.widgets.AgentAvatar;

  return React.createElement('div', {
    ref: overlayRef,
    style: overlay,
  },
    React.createElement('div', {
      style: { ...dialog, width: 320, maxHeight: '80vh', overflow: 'auto' },
    },
      // Title
      React.createElement('div', {
        style: { fontSize: 14, fontWeight: 500, color: color.text, marginBottom: 12 },
      }, 'Send to Agent'),

      // File path
      React.createElement('div', {
        style: { fontSize: 10, color: color.textSecondary, marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      }, filePath),

      // Instructions textarea
      React.createElement('textarea', {
        style: {
          ...baseInput,
          height: 80,
          resize: 'none',
          fontFamily: font.family,
        },
        placeholder: 'Additional instructions (optional)',
        value: instructions,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setInstructions(e.target.value),
      }),

      // Agent list
      React.createElement('div', { style: { marginTop: 12 } },
        // Empty state
        durableAgents.length === 0
          ? React.createElement('div', {
              style: { fontSize: 12, color: color.textSecondary, textAlign: 'center', padding: '16px 0' },
            }, 'No durable agents found')
          : null,

        // Durable agents
        ...durableAgents.map((agent) =>
          React.createElement('button', {
            key: agent.id,
            style: {
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              fontSize: 12,
              color: color.text,
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: font.family,
            },
            onClick: () => handleDurableAgent(agent),
          },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement(AgentAvatar, {
                agentId: agent.id,
                size: 'sm',
                showStatusRing: true,
              }),
              React.createElement('span', { style: { fontWeight: 500 } }, agent.name),
              statusBadge(agent.status),
            ),
            agent.status === 'running'
              ? React.createElement('div', {
                  style: { fontSize: 10, color: color.textWarning, marginTop: 2, paddingLeft: 20 },
                }, 'Will interrupt current work')
              : React.createElement('div', {
                  style: { fontSize: 10, color: color.textSecondary, marginTop: 2, paddingLeft: 20 },
                }, 'Send page to this agent'),
          ),
        ),
      ),

      // Cancel button
      React.createElement('div', { style: { marginTop: 12, display: 'flex', justifyContent: 'flex-end' } },
        React.createElement('button', {
          style: {
            padding: '4px 12px',
            fontSize: 12,
            color: color.textSecondary,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: font.family,
          },
          onClick: onClose,
        }, 'Cancel'),
      ),
    ),
  );
}
