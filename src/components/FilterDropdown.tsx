import { useState, useEffect, useRef } from 'react';

interface FilterDropdownProps {
  label: string;
  iconClass: string;
  placeholder: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  formatValue?: (v: string) => string;
}

export default function FilterDropdown({
  label,
  iconClass,
  placeholder,
  values = [],
  selected = [],
  onToggle,
  isOpen,
  setIsOpen,
  formatValue
}: FilterDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clear search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  const safeValues = Array.isArray(values) ? values : [];
  const safeSelected = Array.isArray(selected) ? selected : [];

  const filteredValues = safeValues.filter((v) => {
    const displayValue = formatValue ? formatValue(v) : v;
    return String(displayValue ?? '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="relative group/filter" ref={dropdownRef}>
      <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">
        {label}
      </label>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`w-full px-3 py-2 text-left border rounded-xl transition-all flex items-center justify-between group-hover/filter:shadow-sm ${
          safeSelected.length > 0
            ? 'border-indigo-500 bg-indigo-50/60 text-indigo-700 dark:text-indigo-400 font-bold'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <i className={`${iconClass} text-xs ${safeSelected.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`} />
          <span className="text-sm truncate">
            {safeSelected.length > 0 ? `${safeSelected.length} Selected` : placeholder}
          </span>
        </div>
        <i
          className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          } ${safeSelected.length > 0 ? 'text-indigo-400' : 'text-gray-300'}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-72">
          {/* Search Input Box */}
          <div className="p-2 border-b border-gray-50 dark:border-white/5 bg-gray-50/50 dark:bg-gray-900/30">
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full pl-3 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500/50 dark:text-gray-200"
              />
              {searchTerm && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <i className="fas fa-times-circle text-[10px]" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1 flex-1">
            {filteredValues.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-400 italic text-center">No options found</div>
            ) : (
              <div className="grid grid-cols-1 gap-0.5">
                {filteredValues.map((v) => (
                  <label
                    key={v}
                    className="flex items-center px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg cursor-pointer transition-colors group/item relative overflow-hidden"
                  >
                    <input
                      type="checkbox"
                      checked={safeSelected.includes(v)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggle(v);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                    />
                    <span
                      className={`text-sm ml-3 transition-all truncate pr-4 ${
                        safeSelected.includes(v)
                          ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                      title={formatValue ? formatValue(v) : v}
                    >
                      {formatValue ? formatValue(v) : v}
                    </span>
                    {safeSelected.includes(v) && (
                      <div className="absolute right-3">
                        <i className="fas fa-check text-indigo-500 text-xs" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer with summary */}
          {safeSelected.length > 0 && (
            <div className="p-2 border-t border-gray-50 dark:border-white/5 bg-indigo-50/30 dark:bg-indigo-900/10 flex justify-between items-center">
                <span className="text-[9px] font-bold text-indigo-600/60 dark:text-indigo-400/60 uppercase">{safeSelected.length} items selected</span>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        // This might need a 'clear' callback if we want a clear button here
                    }}
                    className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-tighter"
                >
                    {/* Clear */}
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
