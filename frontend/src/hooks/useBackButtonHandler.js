import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';

/**
 * BackHandler Stack & Context
 */
const BackHandlerContext = createContext({
  register: () => () => { },
  unregister: () => { },
  triggerBack: () => false
});

/**
 * useBackButtonHandler
 * 
 * Top-level hook to manage browser History API popstate events,
 * layer back stack, and root exit confirmation dialog.
 */
export function useBackButtonHandler({
  isLoggedIn = true,
  enabled = true
} = {}) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const isExitingRef = useRef(false);
  const handlersStackRef = useRef([]);

  // Register a back action to the stack
  const register = useCallback((handlerObj) => {
    handlersStackRef.current.push(handlerObj);
    // Sort descending by priority (higher priority runs first)
    handlersStackRef.current.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Return unregister cleanup function
    return () => {
      handlersStackRef.current = handlersStackRef.current.filter((h) => h !== handlerObj);
    };
  }, []);

  const unregister = useCallback((handlerObj) => {
    handlersStackRef.current = handlersStackRef.current.filter((h) => h !== handlerObj);
  }, []);

  const triggerBack = useCallback(() => {
    // Find highest priority active handler
    for (let i = 0; i < handlersStackRef.current.length; i++) {
      const item = handlersStackRef.current[i];
      if (item && item.isOpen && typeof item.onClose === 'function') {
        try {
          item.onClose();
          return true;
        } catch (err) {
          console.error('[BackButton] Error executing close handler:', err);
        }
      }
    }
    return false;
  }, []);

  // Initialize and handle window.history and popstate
  useEffect(() => {
    if (!enabled || !isLoggedIn || typeof window === 'undefined') return;

    // Push initial baseline state if not already set
    if (!window.history.state || !window.history.state.wa_app_root) {
      window.history.replaceState({ wa_app_root: true, depth: 0 }, '');
      window.history.pushState({ wa_app_root: true, depth: 1 }, '');
    }

    const handlePopState = () => {
      // If user confirmed exit, allow browser navigation
      if (isExitingRef.current) {
        return;
      }

      // 1. If Exit Dialog is already showing, a back press dismisses it
      if (showExitConfirm) {
        setShowExitConfirm(false);
        window.history.pushState({ wa_app_root: true, depth: 1 }, '');
        return;
      }

      // 2. Try closing any open sub-layer/modal/screen
      const handled = triggerBack();

      if (handled) {
        // Re-push history entry so subsequent back presses are captured
        window.history.pushState({ wa_app_root: true, depth: 1 }, '');
      } else {
        // 3. User is at the root screen -> Intercept exit & show confirmation dialog
        window.history.pushState({ wa_app_root: true, depth: 1 }, '');
        setShowExitConfirm(true);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, isLoggedIn, showExitConfirm, triggerBack]);

  // Handle "Yes / Exit" action
  const handleConfirmExit = useCallback(() => {
    isExitingRef.current = true;
    setShowExitConfirm(false);

    // Navigate back to truly exit
    try {
      window.history.go(-2);
    } catch {
      window.history.back();
    }
  }, []);

  // Handle "No / Cancel" action
  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  return {
    showExitConfirm,
    handleConfirmExit,
    handleCancelExit,
    setShowExitConfirm,
    contextValue: { register, unregister, triggerBack }
  };
}

/**
 * useRegisterBackHandler
 * 
 * Reusable hook for any component to register a back action when open.
 * 
 * @param {boolean} isOpen - Whether this screen/modal/tab is currently active
 * @param {() => void} onClose - Function to execute when back button is pressed
 * @param {number} priority - Higher priority handlers execute first (Default: 50, Modals: 100, Tabs: 10)
 */
export function useRegisterBackHandler(isOpen, onClose, priority = 50) {
  const context = useContext(BackHandlerContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!context?.register || !isOpen) return;

    const handlerObj = {
      isOpen: true,
      priority,
      onClose: () => onCloseRef.current?.()
    };

    const unregister = context.register(handlerObj);
    return () => {
      unregister();
    };
  }, [context, isOpen, priority]);
}

export { BackHandlerContext };
export default useBackButtonHandler;

