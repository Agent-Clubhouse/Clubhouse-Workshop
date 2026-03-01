import { describe, it, expect } from 'vitest';
import { createMockAPI, ALL_SOUND_EVENTS } from './mock-api';
import type { SoundEvent } from '@clubhouse/plugin-types';

// ---------------------------------------------------------------------------
// ALL_SOUND_EVENTS
// ---------------------------------------------------------------------------

describe('ALL_SOUND_EVENTS', () => {
  const EXPECTED_EVENTS: SoundEvent[] = [
    'agent-done',
    'error',
    'permission',
    'permission-granted',
    'permission-denied',
    'agent-wake',
    'agent-sleep',
    'agent-focus',
    'notification',
  ];

  it('contains exactly 9 events', () => {
    expect(ALL_SOUND_EVENTS).toHaveLength(9);
  });

  it('includes every expected event', () => {
    for (const event of EXPECTED_EVENTS) {
      expect(ALL_SOUND_EVENTS).toContain(event);
    }
  });

  it('contains no duplicates', () => {
    const unique = new Set(ALL_SOUND_EVENTS);
    expect(unique.size).toBe(ALL_SOUND_EVENTS.length);
  });
});

// ---------------------------------------------------------------------------
// createMockAPI — sounds sub-API
// ---------------------------------------------------------------------------

describe('createMockAPI().sounds', () => {
  it('provides registerPack, unregisterPack, and listPacks', () => {
    const api = createMockAPI();
    expect(typeof api.sounds.registerPack).toBe('function');
    expect(typeof api.sounds.unregisterPack).toBe('function');
    expect(typeof api.sounds.listPacks).toBe('function');
  });

  it('registerPack resolves without error', async () => {
    const api = createMockAPI();
    await expect(api.sounds.registerPack('My Pack')).resolves.toBeUndefined();
  });

  it('unregisterPack resolves without error', async () => {
    const api = createMockAPI();
    await expect(api.sounds.unregisterPack()).resolves.toBeUndefined();
  });

  it('listPacks resolves to an empty array by default', async () => {
    const api = createMockAPI();
    await expect(api.sounds.listPacks()).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Type-level: PluginSoundPackDeclaration.sounds accepts SoundEvent keys
// ---------------------------------------------------------------------------

describe('PluginSoundPackDeclaration type compatibility', () => {
  it('accepts a valid partial sound pack mapping', () => {
    // This is a compile-time check — if it compiles, the types are correct.
    const pack: import('@clubhouse/plugin-types').PluginSoundPackDeclaration = {
      name: 'Test Pack',
      sounds: {
        'agent-done': 'sounds/done.mp3',
        'error': 'sounds/error.wav',
      },
    };
    expect(pack.name).toBe('Test Pack');
    expect(Object.keys(pack.sounds)).toHaveLength(2);
  });

  it('accepts an empty sounds mapping', () => {
    const pack: import('@clubhouse/plugin-types').PluginSoundPackDeclaration = {
      name: 'Empty Pack',
      sounds: {},
    };
    expect(pack.sounds).toEqual({});
  });

  it('accepts a full sound pack with all events', () => {
    const sounds: Partial<Record<SoundEvent, string>> = {};
    for (const event of ALL_SOUND_EVENTS) {
      sounds[event] = `sounds/${event}.mp3`;
    }
    const pack: import('@clubhouse/plugin-types').PluginSoundPackDeclaration = {
      name: 'Complete Pack',
      sounds,
    };
    expect(Object.keys(pack.sounds)).toHaveLength(9);
  });
});
