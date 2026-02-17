// Wrapper for @paymoapp/active-window to handle optional dependency

export interface ActiveWindowInfo {
  title: string;
}

export interface ActiveWindowAPI {
  initialize: () => void;
  getActiveWindow: () => ActiveWindowInfo;
  subscribe: (callback: (winInfo: ActiveWindowInfo) => void) => number;
  unsubscribe: (id: number) => void;
}

let activeWindow: ActiveWindowAPI;

try {
  // Try to load the native module
  const ActiveWindow = require('@paymoapp/active-window');
  activeWindow = ActiveWindow.default || ActiveWindow;
  activeWindow.initialize();
} catch (error) {
  console.warn('@paymoapp/active-window not available, using stub implementation');
  // Stub implementation
  activeWindow = {
    initialize: () => {},
    getActiveWindow: () => ({ title: 'Crusader Kings III' }),
    subscribe: () => 0,
    unsubscribe: () => {}
  };
}

export default activeWindow;