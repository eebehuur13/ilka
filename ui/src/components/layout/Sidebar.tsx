import { Plus, FileText, Users, Settings, HelpCircle, BarChart3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'
import { FileList } from '@/components/files/FileList'
import { useChatStore } from '@/stores/useChatStore'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export const Sidebar = () => {
  const { conversations, currentConversationId, loadConversation, clearMessages } = useChatStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen, toggleUploadModal } = useUIStore()

  const handleNewChat = () => {
    clearMessages()
  }

  // Close sidebar on mobile by default
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300",
          "fixed md:relative z-50 md:z-0",
          sidebarOpen ? "w-[280px] md:w-[260px]" : "w-0 -translate-x-full md:translate-x-0 overflow-hidden"
        )}
      >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <span className="font-semibold text-lg">Zyn</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="md:hidden"
          onClick={toggleSidebar}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Recent Conversations */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
            Recent
          </h3>
          {conversations.slice(0, 5).map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors truncate",
                currentConversationId === conv.id && "bg-gray-100"
              )}
            >
              {conv.title}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 px-2">No conversations yet</p>
          )}
        </div>

        {/* Files Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <FileText className="w-3 h-3 inline mr-1" />
              Files
            </h3>
          </div>
          <Button
            onClick={toggleUploadModal}
            variant="outline"
            size="sm"
            className="w-full mb-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <FileList />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-200 p-3 space-y-1">
        <Button variant="ghost" size="sm" className="w-full justify-start" disabled>
          <Users className="w-4 h-4 mr-2" />
          People
          <span className="ml-auto text-xs text-gray-400">Soon</span>
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <HelpCircle className="w-4 h-4 mr-2" />
          Help
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <BarChart3 className="w-4 h-4 mr-2" />
          Usage
        </Button>
      </div>
    </aside>
    </>
  )
}
