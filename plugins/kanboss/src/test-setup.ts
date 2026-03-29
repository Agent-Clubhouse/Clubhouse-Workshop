import React from 'react';

// Plugin components access React via globalThis.React (provided by the
// Clubhouse runtime). Make it available in the test environment.
(globalThis as Record<string, unknown>).React = React;
