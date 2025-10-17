import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export const Dropdown = ({ options, value, onChange, className }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300 transition-colors"
      >
        {selectedOption?.icon}
        <span className="font-medium">{selectedOption?.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
                option.value === value
                  ? "bg-purple-50 text-purple-900"
                  : "hover:bg-gray-50 text-gray-900"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{option.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
