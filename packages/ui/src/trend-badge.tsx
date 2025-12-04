import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  trend: TrendDirection;
  value?: string | number;
}

/**
 * Badge component to display trend indicators (up/down/flat)
 * Useful for showing budget variance, spending trends, etc.
 */
export const TrendBadge = forwardRef<HTMLSpanElement, TrendBadgeProps>(
  ({ className, trend, value, children, ...props }, ref) => {
    const trendStyles = {
      up: 'bg-success-light text-success-dark',
      down: 'bg-danger-light text-danger-dark',
      flat: 'bg-gray-200 text-gray-700',
    };

    const trendIcons = {
      up: '↑',
      down: '↓',
      flat: '→',
    };

    const displayValue = value !== undefined ? value : children;

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
          trendStyles[trend],
          className
        )}
        {...props}
      >
        <span aria-hidden="true">{trendIcons[trend]}</span>
        {displayValue && <span>{displayValue}</span>}
      </span>
    );
  }
);

TrendBadge.displayName = 'TrendBadge';
