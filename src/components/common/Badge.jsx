import React from 'react';

export const Badge = ({
  status = 'pending',
  children,
  className = '',
  ...props
}) => {
  const normStatus = (children || status || '').toString().toLowerCase().trim();

  let badgeClass = 'badge';

  if (['active', 'present', 'approved', 'success', 'verified', 'enabled', 'location: verified', 'attendance: enabled'].includes(normStatus)) {
    badgeClass += ' badge-success';
  } else if (['pending', 'planning', 'warning', 'in progress', 'progress'].includes(normStatus)) {
    badgeClass += ' badge-pending'; // accent blue
  } else if (['inactive', 'absent', 'rejected', 'danger', 'error', 'failed', 'disabled', 'not set', 'location: not set', 'attendance: disabled'].includes(normStatus)) {
    badgeClass += ' badge-danger';
  } else {
    badgeClass += ' badge-completed'; // slate gray
  }

  return (
    <span className={`${badgeClass} ${className}`} {...props}>
      {children || status}
    </span>
  );
};

export default Badge;
