import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Loader2, Zap, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dropdown } from '@/components/ui/dropdown'
import { useChatStore } from '@/stores/useChatStore'
import { queryDocuments, queryDocumentsStream } from '@/lib/api'
import { getUserId } from '@/lib/auth'
import type { ChatMessage, MethodResult, QueryAnalysis } from '@/types'

const USER_ID = getUserId()

interface ChatInputProps {
  suggestedQuery?: string
}

export const ChatInput = ({ suggestedQuery }: ChatInputProps) => {
  const [input, setInput] = useState('')
  const { mode, reasoning, setReasoning, isProcessing, setIsProcessing, addMessage } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle suggested query from related terms
  useEffect(() => {
    if (suggestedQuery) {
      setInput(suggestedQuery)
      textareaRef.current?.focus()
      adjustHeight()
    }
  }, [suggestedQuery])

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    addMessage(userMessage)
    const query = input.trim()
    setInput('')
    setIsProcessing(true)

    try {
      // Use streaming for both modes
      if (mode === 'model-only' || mode === 'file-search') {
        const aiMessageId = `msg-${Date.now()}-ai`
        let thinking = ''
        let answer = ''
        let analysis: QueryAnalysis | undefined = undefined
        const methodResults: MethodResult[] = []
        let plannedMethods: string[] = []

        const getMethodLabel = (method: string): string => {
          if (method.includes('method1-bm25-direct')) return '⚡ BM25 Direct'
          if (method.includes('method2-bm25-agents')) return '⚡ BM25 Agents'
          if (method.includes('method3-vector')) return '🎯 Vector Search'
          if (method.includes('method4-hyde')) return '🧠 HyDE Search'
          if (method.includes('method-summary')) return '📄 Summary'
          if (method.includes('bm25')) return '⚡ BM25'
          return method
        }

        // Create initial streaming message
        const aiMessage: ChatMessage = {
          id: aiMessageId,
          role: 'assistant',
          content: mode === 'file-search' ? 'Processing query...' : '',
          timestamp: new Date(),
          thinking: '',
          isStreaming: true,
          method: [],
          allAnswers: []
        }
        addMessage(aiMessage)

        await queryDocumentsStream(
          query,
          USER_ID,
          (event) => {
            const { updateMessage } = useChatStore.getState()
            
            if (mode === 'model-only') {
              // Handle model-only streaming
              if (event.type === 'thinking') {
                console.log('[DEBUG] Received thinking event:', event.text?.substring(0, 50))
                thinking += event.text || ''
                updateMessage(aiMessageId, { thinking, isStreaming: true })
              } else if (event.type === 'thinking_complete') {
                console.log('[DEBUG] Thinking complete:', event.text?.substring(0, 50))
                thinking = event.text || ''
                updateMessage(aiMessageId, { thinking, isStreaming: true })
              } else if (event.type === 'answer') {
                answer += event.text || ''
                updateMessage(aiMessageId, { content: answer, thinking, isStreaming: true })
              } else if (event.type === 'done') {
                updateMessage(aiMessageId, { content: answer, thinking, isStreaming: false })
              } else if (event.type === 'error') {
                updateMessage(aiMessageId, { 
                  content: 'Sorry, I encountered an error: ' + (event.message || 'Unknown error'),
                  isStreaming: false 
                })
              }
            } else if (mode === 'file-search') {
              // Handle file-search streaming
              if (event.type === 'analysis_complete') {
                analysis = event.analysis
                updateMessage(aiMessageId, { 
                  analysis,
                  content: 'Analyzing query and planning methods...',
                  isStreaming: true 
                })
              } else if (event.type === 'methods_planned') {
                plannedMethods = event.methods || []
                // Create pending method placeholders
                const pendingMethods = plannedMethods.map(m => ({
                  method: m,
                  label: getMethodLabel(m),
                  latency_ms: 0,
                  answer: '',
                  citations: [],
                  confidence: 'medium' as const,
                  status: 'pending' as const
                }))
                updateMessage(aiMessageId, { 
                  content: 'Running retrieval methods...',
                  method: pendingMethods,
                  allAnswers: pendingMethods,
                  isStreaming: true 
                })
              } else if (event.type === 'method_complete') {
                const completedAnswer = event.answer
                const methodResult: MethodResult = {
                  method: completedAnswer.method,
                  label: getMethodLabel(completedAnswer.method),
                  latency_ms: completedAnswer.latency_ms,
                  answer: completedAnswer.text,
                  citations: completedAnswer.citations,
                  confidence: completedAnswer.confidence,
                  status: 'complete' as const
                }
                
                methodResults.push(methodResult)
                
                // Update message with new method result
                updateMessage(aiMessageId, { 
                  content: methodResults[0]?.answer || 'Retrieving answers...',
                  method: methodResults,
                  allAnswers: methodResults,
                  analysis,
                  isStreaming: true 
                })
              } else if (event.type === 'method_error') {
                console.error('Method error:', event.method, event.error)
              } else if (event.type === 'done') {
                updateMessage(aiMessageId, { 
                  content: methodResults[0]?.answer || 'No results found',
                  method: methodResults,
                  allAnswers: methodResults,
                  analysis,
                  isStreaming: false 
                })
              } else if (event.type === 'error') {
                updateMessage(aiMessageId, { 
                  content: 'Sorry, I encountered an error: ' + (event.message || 'Unknown error'),
                  isStreaming: false 
                })
              }
            }
          },
          (error) => {
            console.error('Stream error:', error)
            const { updateMessage } = useChatStore.getState()
            updateMessage(aiMessageId, { 
              content: 'Sorry, I encountered an error processing your query.',
              isStreaming: false 
            })
          },
          mode,
          reasoning
        )
      } else {
        // Non-streaming file-search mode
        const response = await queryDocuments(query, USER_ID, {
          mode
          // Let backend router decide methods based on analyzer
        })

        // Create AI message with method results
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

        const aiMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: response.answers[0]?.text || 'No answer generated',
          timestamp: new Date(),
          method: methods,
          allAnswers: methods,
          analysis: response.analysis
        }

        addMessage(aiMessage)
      }
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

  const reasoningOptions = [
    {
      value: 'false',
      label: 'Fast',
      icon: <Zap className="w-4 h-4 text-blue-500" />,
      description: 'Quick responses'
    },
    {
      value: 'true',
      label: 'Reasoning',
      icon: <Brain className="w-4 h-4 text-purple-500" />,
      description: 'Deep thinking'
    }
  ]

  return (
    <div className="border-t border-gray-200 bg-white p-3 md:p-4 mb-2 md:mb-3">
      <div className="max-w-3xl mx-auto">
        <div className="space-y-2">
          {/* Model Selector - Only show in model-only mode */}
          {mode === 'model-only' && (
            <Dropdown
              options={reasoningOptions}
              value={reasoning.toString()}
              onChange={(val) => setReasoning(val === 'true')}
            />
          )}

          {/* Input Area */}
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
                className="min-h-[52px] md:min-h-[60px] max-h-[200px] resize-none pr-12 text-base"
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
              className="h-[52px] md:h-[60px] px-4 md:px-6 min-w-[52px] md:min-w-[60px]"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
              ) : (
                <Send className="w-5 h-5 md:w-4 md:h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
