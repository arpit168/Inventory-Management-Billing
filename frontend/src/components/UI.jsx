export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  loading = false,
  disabled = false,
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-dark-700 text-white hover:bg-dark-600 border border-dark-600 focus:ring-dark-600',
    success: 'bg-success text-white hover:opacity-90 focus:ring-success',
    danger: 'bg-error text-white hover:opacity-90 focus:ring-error',
    warning: 'bg-warning text-white hover:opacity-90 focus:ring-warning',
    ghost: 'text-primary-400 hover:bg-dark-700 focus:ring-primary-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export const Input = ({ 
  type = 'text', 
  placeholder = '', 
  error = false,
  helperText = '',
  ...props 
}) => {
  return (
    <div className="w-full">
      <input
        type={type}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2 rounded-lg bg-dark-800 text-white border-2
          ${error ? 'border-error' : 'border-dark-700'}
          focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50
          transition-colors duration-200 placeholder-dark-400
        `}
        {...props}
      />
      {helperText && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-dark-400'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export const Select = ({ 
  label = '', 
  options = [],
  error = false,
  helperText = '',
  ...props 
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}
      <select
        className={`
          w-full px-4 py-2 rounded-lg bg-dark-800 text-white border-2
          ${error ? 'border-error' : 'border-dark-700'}
          focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50
          transition-colors duration-200
        `}
        {...props}
      >
        <option value="">Select an option</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-dark-400'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export const Textarea = ({ 
  placeholder = '', 
  error = false,
  helperText = '',
  rows = 4,
  ...props 
}) => {
  return (
    <div className="w-full">
      <textarea
        placeholder={placeholder}
        rows={rows}
        className={`
          w-full px-4 py-2 rounded-lg bg-dark-800 text-white border-2
          ${error ? 'border-error' : 'border-dark-700'}
          focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50
          transition-colors duration-200 placeholder-dark-400 resize-none
        `}
        {...props}
      />
      {helperText && (
        <p className={`mt-1 text-sm ${error ? 'text-error' : 'text-dark-400'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export const Card = ({ children, className = '' }) => (
  <div className={`bg-dark-800 rounded-lg border border-dark-700 p-6 shadow-md ${className}`}>
    {children}
  </div>
);

export const Badge = ({ children, variant = 'primary' }) => {
  const variants = {
    primary: 'bg-primary-600 bg-opacity-20 text-primary-400',
    success: 'bg-success bg-opacity-20 text-success',
    warning: 'bg-warning bg-opacity-20 text-warning',
    error: 'bg-error bg-opacity-20 text-error',
    info: 'bg-info bg-opacity-20 text-info',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

export const Alert = ({ children, variant = 'info', title = '' }) => {
  const variants = {
    success: 'bg-success bg-opacity-10 border-success text-success',
    error: 'bg-error bg-opacity-10 border-error text-error',
    warning: 'bg-warning bg-opacity-10 border-warning text-warning',
    info: 'bg-info bg-opacity-10 border-info text-info',
  };

  return (
    <div className={`border-l-4 p-4 rounded ${variants[variant]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <p className="text-sm">{children}</p>
    </div>
  );
};

export const Modal = ({ isOpen, onClose, title = '', children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`bg-dark-800 rounded-lg border border-dark-700 shadow-xl ${sizeClasses[size]} w-full mx-4`}>
        <div className="flex items-center justify-between border-b border-dark-700 p-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Table = ({ columns, data, loading = false }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-dark-700 border-b border-dark-600">
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-3 text-left text-sm font-semibold text-dark-100">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-dark-400">
                No data found
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx} className="border-b border-dark-700 hover:bg-dark-700 hover:bg-opacity-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <div className="flex items-center gap-1">
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            onClick={() => onPageChange(i + 1)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === i + 1
                ? 'bg-primary-600 text-white'
                : 'bg-dark-700 text-dark-100 hover:bg-dark-600'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  );
};
