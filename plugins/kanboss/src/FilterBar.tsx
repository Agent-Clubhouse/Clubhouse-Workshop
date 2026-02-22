const React = globalThis.React;
const { useCallback } = React;

import type { Label, Priority } from './types';
import { PRIORITY_CONFIG } from './types';
import { kanBossState, type FilterState } from './state';
import * as S from './styles';

interface FilterBarProps {
  filter: FilterState;
  labels: Label[];
}

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high', 'critical'];

export function FilterBar({ filter, labels }: FilterBarProps) {
  const hasFilters = filter.searchQuery || filter.priorityFilter !== 'all' || filter.labelFilter !== 'all' || filter.stuckOnly;

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    kanBossState.setFilter({ searchQuery: e.target.value });
  }, []);

  const handlePriority = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    kanBossState.setFilter({ priorityFilter: e.target.value as Priority | 'all' });
  }, []);

  const handleLabel = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    kanBossState.setFilter({ labelFilter: e.target.value });
  }, []);

  const handleStuck = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    kanBossState.setFilter({ stuckOnly: e.target.checked });
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 16px',
      borderBottom: `1px solid ${S.color.border}`,
      background: S.color.bgSecondary,
      flexShrink: 0,
      fontFamily: S.font.family,
      fontSize: 11,
    }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search cards..."
        value={filter.searchQuery}
        onChange={handleSearch}
        style={{
          ...S.baseInput,
          width: 160,
          padding: '4px 8px',
          fontSize: 11,
        }}
      />

      {/* Priority filter */}
      <select
        value={filter.priorityFilter}
        onChange={handlePriority}
        style={{
          ...S.baseInput,
          width: 'auto',
          padding: '4px 8px',
          fontSize: 11,
        }}
      >
        <option value="all">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
        ))}
      </select>

      {/* Label filter */}
      {labels.length > 0 && (
        <select
          value={filter.labelFilter}
          onChange={handleLabel}
          style={{
            ...S.baseInput,
            width: 'auto',
            padding: '4px 8px',
            fontSize: 11,
          }}
        >
          <option value="all">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}

      {/* Stuck only */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: S.color.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <input
          type="checkbox"
          checked={filter.stuckOnly}
          onChange={handleStuck}
        />
        Stuck only
      </label>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => kanBossState.clearFilter()}
          style={{
            ...S.baseButton,
            padding: '3px 8px',
            fontSize: 10,
            color: S.color.textTertiary,
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
