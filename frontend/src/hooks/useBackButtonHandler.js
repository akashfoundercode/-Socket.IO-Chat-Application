import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useBackButtonHandler
 * 
 * Centralized, isolated hook to manage device/browser back-button behavior:
 * 1. Inside a 1-to-1 or group chat -> Device back button closes the conversation and returns to the chat list (No exit popup).
 * 2. In Profile Settings / Call -> Device back button returns to inbox / minimizes call (No exit popup).
 * 3. At root screen (Chat list with no chat open) -> Device back button opens the Exit confirmation dialog.
 * 4. Normal in-app clicks (switching tabs, opening chats, closing via on-screen buttons) NEVER trigger the exit dialog.
 * 5. In Exit dialog, "Exit" performs real exit/back navigation, and "Cancel" keeps the user on the root screen.
 */
export function useBackButtonHandler({
  isLoggedIn = true,
  activeChat = null,
  currentView = 'inbox',
  callState = null,
  isCallMinimized = false,
  onCloseChat,
  onCloseProfile,
  onMinimizeCall,
  enabled = true
} = {}) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const isExitingRef = useRef(false);
  const isProgrammaticBackRef = useRef(false);
  const hasSubscreenHistoryRef = useRef(false);

  // Keep references to current state and callbacks
  const isInsideSubscreen = Boolean(activeChat || currentView === 'profile' || (callState && !isCallMinimized));
  const isInsideSubscreenRef = useRef(isInsideSubscreen);
  isInsideSubscreenRef.current = isInsideSubscreen;

  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const isCallMinimizedRef = useRef(isCallMinimized);
  isCallMinimizedRef.current = isCallMinimized;

  const onCloseChatRef = useRef(onCloseChat);
  onCloseChatRef.current = onCloseChat;

  const onCloseProfileRef = useRef(onCloseProfile);
  onCloseProfileRef.current = onCloseProfile;

  const onMinimizeCallRef = useRef(onMinimizeCall);
  onMinimizeCallRef.current = onMinimizeCall;

  const showExitConfirmRef = useRef(showExitConfirm);
  showExitConfirmRef.current = showExitConfirm;

  // 1. Synchronize history state when entering/leaving sub-screens
  useEffect(() => {
    if (!enabled || !isLoggedIn || typeof window === 'undefined') return;

    if (isInsideSubscreen) {
      if (!hasSubscreenHistoryRef.current) {
        window.history.pushState({ wa_view: 'subscreen' }, '');
        hasSubscreenHistoryRef.current = true;
      }
    } else {
      // Subscreen was closed via on-screen UI button
      if (hasSubscreenHistoryRef.current) {
        hasSubscreenHistoryRef.current = false;
        // Clean up the pushed history entry without triggering back-interceptor
        isProgrammaticBackRef.current = true;
        try {
          window.history.back();
        } catch { }
      }
    }
  }, [enabled, isLoggedIn, isInsideSubscreen]);

  // 2. Global popstate listener for device/browser back button
  useEffect(() => {
    if (!enabled || !isLoggedIn || typeof window === 'undefined') return;

    // Set initial root state if needed
    if (!window.history.state || window.history.state.wa_view !== 'root') {
      window.history.replaceState({ wa_view: 'root' }, '');
    }

    const handlePopState = (event) => {
      // If user confirmed exit, allow the browser to naturally exit
      if (isExitingRef.current) {
        return;
      }

      // If triggered programmatically (e.g. UI close button cleanup), ignore it
      if (isProgrammaticBackRef.current) {
        isProgrammaticBackRef.current = false;
        return;
      }

      // CASE A: User is inside a sub-screen / chat / profile / call
      if (isInsideSubscreenRef.current) {
        hasSubscreenHistoryRef.current = false;

        if (callStateRef.current && !isCallMinimizedRef.current) {
          onMinimizeCallRef.current?.();
        } else if (currentViewRef.current === 'profile') {
          onCloseProfileRef.current?.();
        } else if (activeChatRef.current) {
          onCloseChatRef.current?.();
        }
        // Important: DO NOT show exit confirm when leaving a chat!
        return;
      }

      // CASE B: User is at ROOT screen (Chat list with no chat open)
      // If exit dialog is already open, pressing back simply closes it
      if (showExitConfirmRef.current) {
        setShowExitConfirm(false);
        window.history.pushState({ wa_view: 'root' }, '');
        return;
      }

      // Intercept exit at root: re-push root state to prevent immediate close, and open dialog
      window.history.pushState({ wa_view: 'root' }, '');
      setShowExitConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, isLoggedIn]);

  // 3. User clicked "Exit" button in confirmation dialog
  const handleConfirmExit = useCallback(() => {
    isExitingRef.current = true;
    setShowExitConfirm(false);

    // Perform actual exit navigation
    try {
      if (window.history.length > 1) {
        window.history.go(-2);
      } else {
        window.close();
      }
    } catch {
      window.history.back();
    }

    // Safety fallback to go back if go(-2) didn't exit the page
    setTimeout(() => {
      try {
        window.history.back();
      } catch { }
    }, 150);
  }, []);

  // 4. User clicked "Cancel" button in confirmation dialog
  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  return {
    showExitConfirm,
    handleConfirmExit,
    handleCancelExit,
    setShowExitConfirm
  };
}

export default useBackButtonHandler;
