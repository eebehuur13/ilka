import { Plus, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/useChatStore'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { useFileStore } from '@/stores/useFileStore'

export const Header = () => {
  const { mode, setMode, clearMessages } = useChatStore()
  const { documents } = useFileStore()
  const { toggleSidebar } = useUIStore()

  const hasFiles = documents.length > 0

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-3 md:px-6">
      {/* Mobile: Hamburger, Desktop: New Chat */}
      <div className="flex items-center gap-2">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Button
          onClick={() => clearMessages()}
          variant="ghost"
          size="sm"
          className="hidden md:flex gap-2"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Mode Toggle - Responsive */}
      <div className="flex items-center gap-0.5 md:gap-1 bg-gray-100 p-0.5 md:p-1 rounded-lg">
        <button
          onClick={() => setMode('model-only')}
          className={cn(
            "px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap",
            mode === 'model-only'
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          <span className="hidden sm:inline">Model-Only</span>
          <span className="sm:hidden">Model</span>
        </button>
        <button
          onClick={() => setMode('file-search')}
          disabled={!hasFiles}
          className={cn(
            "px-2 md:px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all whitespace-nowrap",
            mode === 'file-search'
              ? "bg-rose-500 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900",
            !hasFiles && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="hidden sm:inline">File-Search</span>
          <span className="sm:hidden">Files</span>
        </button>
      </div>

      {/* User Menu - Icon only on mobile */}
      <Button variant="ghost" size="sm" className="gap-2">
        <User className="w-4 h-4" />
        <span className="hidden md:inline">User</span>
      </Button>
    </header>
  )
}
