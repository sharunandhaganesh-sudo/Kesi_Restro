/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useModalBehavior — Reusable modal hook providing:
 * 1. Background scroll locking (prevents page behind modal from scrolling)
 * 2. Automatic cleanup on modal unmount or close
 * 3. Escape key dismissal
 * 4. Safe backdrop click/touch handling with event propagation protection
 */

import { useEffect, useCallback } from 'react';

interface UseModalBehaviorOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
}

export function useModalBehavior({
  isOpen,
  onClose,
  closeOnEscape = true,
  lockScroll = true,
}: UseModalBehaviorOptions) {
  useEffect(() => {
    if (!isOpen) return;

    let originalOverflow = '';
    if (lockScroll && typeof document !== 'undefined') {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    if (closeOnEscape && typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (lockScroll && typeof document !== 'undefined') {
        document.body.style.overflow = originalOverflow;
      }
      if (closeOnEscape && typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, onClose, closeOnEscape, lockScroll]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.target === e.currentTarget) {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  return { handleBackdropClick };
}
