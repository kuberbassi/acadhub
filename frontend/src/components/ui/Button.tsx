import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import Loader from './Loader';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link' | 'filled' | 'tonal' | 'outlined' | 'text';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    icon?: ReactNode;
    children: ReactNode;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'filled',
    size = 'md',
    isLoading = false,
    icon,
    className = '',
    children,
    disabled,
    ...props
}) => {
    const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden shrink-0 whitespace-nowrap flex-nowrap";

    const variantClasses: Record<string, string> = {
        primary: "bg-primary text-on-primary hover:shadow-md hover:bg-primary/90 active:bg-primary/80 border border-transparent shadow-sm",
        filled: "bg-primary text-on-primary hover:shadow-md hover:bg-primary/90 active:bg-primary/80 border border-transparent shadow-sm",

        secondary: "bg-secondary-container text-on-secondary-container hover:shadow-sm hover:bg-secondary-container/80 active:bg-secondary-container/70 border border-transparent",
        tonal: "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 active:bg-secondary-container/70 border border-transparent shadow-none",

        outlined: "border border-outline text-primary hover:bg-primary/10 active:bg-primary/20",
        outline: "border border-outline text-primary hover:bg-primary/10 active:bg-primary/20",

        ghost: "text-primary hover:bg-primary/10 active:bg-primary/20 border-transparent",
        text: "text-primary hover:bg-primary/10 active:bg-primary/20 border-transparent",

        danger: "bg-error text-on-error hover:bg-error/90 active:bg-error/80 shadow-sm",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto bg-transparent",
    };

    const sizeClasses = {
        sm: "px-3 h-8 text-xs rounded-md gap-1.5",
        md: "px-4 h-10 text-xs rounded-md gap-2",
        lg: "px-6 h-12 text-sm rounded-lg gap-2.5",
    };

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant] || variantClasses.filled} ${sizeClasses[size] || sizeClasses.md} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {/* State Layer (Ripple effect placeholder) */}
            <span className="absolute inset-0 bg-current opacity-0 hover:opacity-[0.08] active:opacity-[0.12] transition-opacity duration-200" />

            {isLoading ? (
                <div className="flex items-center gap-2">
                    <Loader size={16} />
                    <span className="relative z-10">Loading...</span>
                </div>
            ) : (
                <>
                    {icon && <span className="relative z-10">{icon}</span>}
                    <span className="relative z-10 whitespace-nowrap">{children}</span>
                </>
            )}
        </button>
    );
};

export default Button;
