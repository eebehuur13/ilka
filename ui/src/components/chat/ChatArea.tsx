import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/stores/useChatStore'
import { ChatMessage } from './ChatMessage'
import { EmptyState } from './EmptyState'
import { Button } from '@/components/ui/button'
import { ArrowDown } from 'lucide-react'
import { queryDocuments } from '@/lib/api'
import { getUserId } from '@/lib/auth'
import type { MethodResult } from '@/types'

const USER_ID = getUserId()

interface ChatAreaProps {
  onRelatedTermClick?: (term: string) => void
}

export const ChatArea = ({ onRelatedTermClick }: ChatAreaProps) => {
  const { messages, mode, updateMessage } = useChatStore()
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

  // Regenerate answer for a specific message
  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // Find the previous user message
    let userQuery = ''
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content
        break
      }
    }

    if (!userQuery) return

    try {
      // Set message to streaming state
      updateMessage(messageId, { isStreaming: true, content: 'Regenerating...' })

      // Re-run query
      const response = await queryDocuments(userQuery, USER_ID, { mode })

      const getMethodLabel = (method: string): string => {
        if (method.includes('method1-bm25-direct')) return '⚡ BM25 Direct'
        if (method.includes('method2-bm25-agents')) return '⚡ BM25 Agents'
        if (method.includes('method3-vector')) return '🎯 Vector Search'
        if (method.includes('method4-hyde')) return '🧠 HyDE Search'
        if (method.includes('method-summary')) return '📄 Summary'
        if (method.includes('bm25')) return '⚡ BM25'
        return method
      }

      const methods: MethodResult[] = response.answers.map((answer: any) => ({
        method: answer.method,
        label: getMethodLabel(answer.method),
        latency_ms: answer.latency_ms,
        answer: answer.text,
        citations: answer.citations,
        confidence: answer.confidence,
        status: 'complete' as const
      }))

      // Update message with new results
      updateMessage(messageId, {
        content: response.answers[0]?.text || 'No answer generated',
        method: methods,
        allAnswers: methods,
        analysis: response.analysis,
        isStreaming: false
      })
    } catch (error) {
      console.error('Regenerate failed:', error)
      updateMessage(messageId, {
        content: 'Failed to regenerate. Please try again.',
        isStreaming: false
      })
    }
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
            <ChatMessage 
              key={message.id} 
              message={message}
              onRegenerate={message.role === 'assistant' && mode !== 'model-only' ? () => handleRegenerate(message.id) : undefined}
              onRelatedTermClick={onRelatedTermClick}
            />
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
