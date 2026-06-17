import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary', // 'primary', 'outline', 'text', 'danger', 'success'
  size = 'md', // 'sm', 'md', 'lg'
  type = 'button',
  isLoading = false,
  disabled = false,
  icon: Icon = null,
  className = '',
  onClick,
  style = {},
  ...props
}) => {
  let btnClass = 'btn';
  let customStyle = { ...style };

  if (variant === 'primary') {
    btnClass += ' btn-primary';
  } else if (variant === 'outline') {
    btnClass += ' btn-outline';
  } else if (variant === 'text') {
    btnClass = 'btn-text';
  } else if (variant === 'danger') {
    btnClass += ' btn-danger-custom';
  } else if (variant === 'success') {
    btnClass += ' btn-success-custom';
  }

  // Adjust size styles
  if (size === 'sm') {
    customStyle = {
      ...customStyle,
      padding: variant === 'text' ? '0' : '6px 12px',
      fontSize: '11px',
      height: 'auto',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    };
  } else if (size === 'lg') {
    customStyle = {
      ...customStyle,
      padding: '16px 28px',
      fontSize: '14px',
    };
  }

  return (
    <button
      type={type}
      className={`${btnClass} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      style={customStyle}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={16} className="spinner-icon" style={{ animation: 'spin 0.8s linear infinite' }} />
      ) : (
        Icon && <Icon size={16} />
      )}
      <span>{isLoading ? 'Processing...' : children}</span>
    </button>
  );
};

export default Button;
