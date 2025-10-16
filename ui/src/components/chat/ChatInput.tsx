import { useState, useRef, type KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/stores/useChatStore'
import { queryDocuments } from '@/lib/api'
import type { ChatMessage, MethodResult } from '@/types'

const USER_ID = 'test-user' // TODO: Get from auth

export const ChatInput = () => {
  const [input, setInput] = useState('')
  const { mode, isProcessing, setIsProcessing, addMessage } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    addMessage(userMessage)
    setInput('')
    setIsProcessing(true)

    try {
      // Call API with mode
      const response = await queryDocuments(input.trim(), USER_ID, {
        mode,
        methods: mode === 'file-search' ? ['bm25'] : undefined
      })

      // Create AI message with method results
      const methods: MethodResult[] = response.answers.map((answer: any) => ({
        method: answer.method,
        label: answer.method.includes('bm25') ? '⚡ Fast Search' : '🧠 Deep Search',
        latency_ms: answer.latency_ms,
        answer: answer.text,
        citations: answer.citations,
        confidence: answer.confidence,
        status: 'complete' as const
      }))

      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.answers[0]?.text || 'No answer generated',
        timestamp: new Date(),
        method: methods
      }

      addMessage(aiMessage)
    } catch (error) {
      console.error('Query failed:', error)
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your query.',
        timestamp: new Date()
      }
      addMessage(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                adjustHeight()
              }}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'file-search' ? 'Ask about your documents...' : 'Ask me anything...'}
              className="min-h-[60px] max-h-[200px] resize-none pr-12"
              disabled={isProcessing}
            />
            {mode === 'file-search' && (
              <div className="absolute top-2 right-2">
                <span className="text-xs text-gray-400">Searching files</span>
              </div>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className="h-[60px] px-6"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          Ilka may produce inaccurate information. Always verify important facts.
        </p>
      </div>
    </div>
  )
}
