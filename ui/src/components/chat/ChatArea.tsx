import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/useChatStore'
import { ChatMessage } from './ChatMessage'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import { ArrowDown } from 'lucide-react'

export const ChatArea = () => {
  const { messages } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Check if user is at bottom
  const checkIfAtBottom = () => {
    if (!containerRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const threshold = 100 // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold
  }

  // Handle scroll events
  const handleScroll = () => {
    const atBottom = checkIfAtBottom()
    setIsAtBottom(atBottom)
    setShowScrollButton(!atBottom)
  }

  // Auto-scroll only if user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isAtBottom])

  // Scroll to bottom when button clicked
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
    setShowScrollButton(false)
  }

  if (messages.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
      >
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {showScrollButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="shadow-lg rounded-full px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
          >
            <ArrowDown className="w-4 h-4 mr-1" />
            Jump to bottom
          </Button>
        </div>
      )}
    </div>
  )
}
