import classNames from 'classnames';
import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}
