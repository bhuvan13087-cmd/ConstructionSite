import React from 'react';

export const Card = ({
  title,
  subtitle,
  headerActions,
  children,
  className = '',
  variant = 'default', // 'default', 'accent', 'table'
  ...props
}) => {
  if (variant === 'accent') {
    return (
      <div className={`detail-card ${className}`} {...props}>
        {(title || headerActions) && (
          <div className="card-header-accent">
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p className="field-hint" style={{ marginTop: '4px', textTransform: 'none' }}>{subtitle}</p>}
            </div>
            {headerActions && <div className="card-header-actions">{headerActions}</div>}
          </div>
        )}
        <div className="card-body">
          {children}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`table-card ${className}`} {...props}>
        {(title || headerActions) && (
          <div className="card-header-accent">
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p className="field-hint" style={{ marginTop: '4px', textTransform: 'none' }}>{subtitle}</p>}
            </div>
            {headerActions && <div className="card-header-actions">{headerActions}</div>}
          </div>
        )}
        <div className="table-container">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`detail-card ${className}`} {...props}>
      {(title || headerActions) && (
        <div className="card-header-accent" style={{ background: 'transparent', borderBottom: 'none' }}>
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="field-hint" style={{ marginTop: '4px', textTransform: 'none' }}>{subtitle}</p>}
          </div>
          {headerActions && <div className="card-header-actions">{headerActions}</div>}
        </div>
      )}
      <div className="card-body" style={{ paddingTop: (title || headerActions) ? 0 : '24px' }}>
        {children}
      </div>
    </div>
  );
};

export default Card;
