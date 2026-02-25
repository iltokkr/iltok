import React, { useState, useRef, useEffect } from 'react';
import styles from '@/styles/JobFilter.module.css';

interface SelectDropdownProps {
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  placeholder,
  value,
  options,
  onSelect,
  icon,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = value ? options.find((o) => o.value === value)?.label ?? placeholder : placeholder;

  return (
    <div className={styles.regionDropdown} ref={ref}>
      <button
        type="button"
        className={`${styles.regionTrigger} ${isOpen ? styles.regionTriggerOpen : ''} ${disabled ? styles.regionTriggerDisabled : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        {icon && <span className={styles.regionIcon}>{icon}</span>}
        <span className={styles.regionTriggerText}>{displayLabel}</span>
        <span className={styles.regionChevron}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {isOpen && (
        <div className={styles.regionPanel}>
          <ul className={styles.regionList} role="listbox">
            {options.map((opt) => (
              <li key={opt.value || 'empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`${styles.regionOption} ${value === opt.value ? styles.regionOptionActive : ''}`}
                  onClick={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SelectDropdown;
