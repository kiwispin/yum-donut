
const PixelAvatar = ({ icon, color, size = 'md', isOnline, className = "" }) => {
    const sizeClasses = {
        sm: "w-8 h-8 text-sm",
        md: "w-10 h-10 text-xl",
        lg: "w-16 h-16 text-3xl",
        xl: "w-24 h-24 text-5xl"
    };

    const sizeStyle = typeof size === 'number' ? { width: size, height: size, fontSize: size * 0.5 } : {};
    const sizeClass = typeof size === 'string' ? sizeClasses[size] || sizeClasses.md : "";

    return (
        <div
            className={`rounded-lg flex items-center justify-center shadow-sm relative ${sizeClass} ${className}`}
            style={{ backgroundColor: color || '#ddd', ...sizeStyle }}
        >
            {icon || '?'}
            {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            )}
        </div>
    );
};
