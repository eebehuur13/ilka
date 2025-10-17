import { Plus, User, Brain, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/useChatStore'
import { cn } from '@/lib/utils'
import { useFileStore } from '@/stores/useFileStore'

export const Header = () => {
  const { mode, reasoning, setMode, setReasoning, clearMessages } = useChatStore()
  const { documents } = useFileStore()

  const hasFiles = documents.length > 0

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <Button
        onClick={() => clearMessages()}
        variant="ghost"
        size="sm"
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        New Chat
      </Button>

      {/* Mode and Reasoning Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setMode('model-only')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              mode === 'model-only'
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            Model-Only
          </button>
          <button
            onClick={() => setMode('file-search')}
            disabled={!hasFiles}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              mode === 'file-search'
                ? "bg-rose-500 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900",
              !hasFiles && "opacity-50 cursor-not-allowed"
            )}
          >
            File-Search
          </button>
        </div>

        {/* Reasoning Toggle - Only show in model-only mode */}
        {mode === 'model-only' && (
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setReasoning(false)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5",
                !reasoning
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              Fast
            </button>
            <button
              onClick={() => setReasoning(true)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5",
                reasoning
                  ? "bg-purple-500 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Brain className="w-3.5 h-3.5" />
              Reasoning
            </button>
          </div>
        )}
      </div>

      {/* User Menu */}
      <Button variant="ghost" size="sm" className="gap-2">
        <User className="w-4 h-4" />
        User
      </Button>
    </header>
  )
}
