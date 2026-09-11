import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';

/**
 * BackHandler Stack & Context
 */
const BackHandlerContext = createContext({
  register: () => () => { },
  unregister: () => { },
  triggerBack: () => false,
  markProgrammaticPop: () => { }
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
  const ignoreProgrammaticPopsCountRef = useRef(0);
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

  const markProgrammaticPop = useCallback(() => {
    ignoreProgrammaticPopsCountRef.current += 1;
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
    }

    const handlePopState = (event) => {
      // 1. If user confirmed exit, allow normal browser navigation
      if (isExitingRef.current) {
        return;
      }

      // 2. If this popstate was caused by programmatic window.history.back(), ignore it completely
      if (ignoreProgrammaticPopsCountRef.current > 0) {
        ignoreProgrammaticPopsCountRef.current -= 1;
        return;
      }

      // 3. If Exit Dialog is already showing, a back press simply dismisses it
      if (showExitConfirm) {
        setShowExitConfirm(false);
        window.history.pushState({ wa_app_root: true }, '');
        return;
      }

      // 4. Try closing any open sub-layer/modal/screen
      const handled = triggerBack();

      if (!handled) {
        // 5. User is at the root screen (no modals/chats open) -> Intercept exit & show confirmation dialog
        window.history.pushState({ wa_app_root: true }, '');
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
    contextValue: { register, unregister, triggerBack, markProgrammaticPop }
  };
}

/**
 * useRegisterBackHandler
 * 
 * Reusable hook for any component to register a back action when open.
 * Pushes a history state when opening so a single back press immediately closes it.
 * 
 * @param {boolean} isOpen - Whether this screen/modal/tab is currently active
 * @param {() => void} onClose - Function to execute when back button is pressed
 * @param {number} priority - Higher priority handlers execute first (Default: 50, Modals: 100, Tabs: 10)
 */
export function useRegisterBackHandler(isOpen, onClose, priority = 50) {
  const context = useContext(BackHandlerContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedStateRef = useRef(false);

  useEffect(() => {
    if (!context?.register) return;

    if (isOpen) {
      // Push history state entry if not already pushed for this open session
      if (!pushedStateRef.current && typeof window !== 'undefined') {
        window.history.pushState({ wa_layer: true, priority }, '');
        pushedStateRef.current = true;
      }

      const handlerObj = {
        isOpen: true,
        priority,
        onClose: () => {
          pushedStateRef.current = false;
          onCloseRef.current?.();
        }
      };

      const unregister = context.register(handlerObj);

      return () => {
        unregister();
        // If closed via UI (and not by browser popstate), clean up pushed history state safely
        if (pushedStateRef.current && typeof window !== 'undefined') {
          pushedStateRef.current = false;
          context.markProgrammaticPop?.();
          try {
            window.history.back();
          } catch { }
        }
      };
    } else {
      pushedStateRef.current = false;
    }
  }, [context, isOpen, priority]);
}

export { BackHandlerContext };
export default useBackButtonHandler;
