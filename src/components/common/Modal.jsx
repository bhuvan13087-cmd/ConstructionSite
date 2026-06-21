import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '600px',
  closeOnOverlayClick = false,
  ...props
}) => {
  const [isDirty, setIsDirty] = useState(false);

  // Prevent background body scrolling when modal is open and reset dirty state
  useEffect(() => {
    if (isOpen) {
      setIsDirty(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Intercept navigation links click when modal is dirty
  useEffect(() => {
    const handleNavigationClick = (e) => {
      if (isOpen && isDirty) {
        const link = e.target.closest('a');
        if (link) {
          if (!window.confirm("Discard entered data?")) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    window.addEventListener('click', handleNavigationClick, true);
    return () => {
      window.removeEventListener('click', handleNavigationClick, true);
    };
  }, [isOpen, isDirty]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    // Outside clicks (overlay/background) will not close the modal
  };

  const handleFormChange = () => {
    setIsDirty(true);
  };

  const handleModalCardClickCapture = (e) => {
    const isCloseBtn = e.target.closest('.btn-close-modal');
    const isCancelBtn = e.target.closest('button') && (
      e.target.textContent.trim().toLowerCase() === 'cancel' ||
      e.target.closest('button').textContent.trim().toLowerCase() === 'cancel' ||
      e.target.textContent.trim().toLowerCase() === 'close' ||
      e.target.closest('button').textContent.trim().toLowerCase() === 'close' ||
      e.target.textContent.trim().toLowerCase() === 'discard' ||
      e.target.closest('button').textContent.trim().toLowerCase() === 'discard'
    );

    if (isCloseBtn || isCancelBtn) {
      if (isDirty) {
        if (!window.confirm("Discard entered data?")) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          setIsDirty(false);
        }
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} {...props}>
      <div 
        className="modal-card" 
        style={{ maxWidth }} 
        onChange={handleFormChange}
        onClickCapture={handleModalCardClickCapture}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-actions">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

