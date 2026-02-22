import React from 'react';

// Plugin source files access React via globalThis.React (runtime convention).
// In the test environment, we need to set it up manually.
(globalThis as any).React = React;

// Enable React act() support
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
