import { User, Brain, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage as ChatMessageType } from '@/types'
import { Logo } from '@/components/common/Logo'
import { formatTime } from '@/lib/utils'
import { CitationCard } from './CitationCard'
import { AnalyzerInsights } from './AnalyzerInsights'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'

interface ChatMessageProps {
  message: ChatMessageType
  onRegenerate?: () => void
  onRelatedTermClick?: (term: string) => void
}

export const ChatMessage = ({ message, onRegenerate, onRelatedTermClick }: ChatMessageProps) => {
  const isUser = message.role === 'user'
  const [showThinking, setShowThinking] = useState(false)
  const [currentAnswerIndex, setCurrentAnswerIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  const currentAnswer = message.allAnswers?.[currentAnswerIndex]
  const totalAnswers = message.allAnswers?.length || 0
  const hasMultipleAnswers = totalAnswers > 1

  const handleCopy = () => {
    const textToCopy = hasMultipleAnswers ? (currentAnswer?.answer || '') : message.content
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isUser) {
    return (
      <div className="flex gap-3 md:gap-4 justify-end">
        <div className="flex-1 max-w-2xl">
          <div className="bg-gray-100 rounded-lg p-3 md:p-4">
            <p className="text-sm md:text-base text-gray-900">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 justify-end">
            <User className="w-3 h-3" />
            <span>You</span>
            <span>·</span>
            <span>{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 md:gap-4">
      <div className="flex-shrink-0">
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-rose-100 flex items-center justify-center">
          <Logo className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>

      <div className="flex-1 space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Zyn</span>
          <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
        </div>

        {message.analysis && (
          <AnalyzerInsights 
            analysis={message.analysis} 
            onRelatedTermClick={onRelatedTermClick}
          />
        )}

        {(hasMultipleAnswers || (message.method && message.method.length > 0)) && (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">{hasMultipleAnswers ? (currentAnswer?.label || 'Method') : (message.method?.[0]?.label || 'Method')}</span>
              {(hasMultipleAnswers ? currentAnswer?.status : message.method?.[0]?.status) === 'pending' && (
                <span className="text-gray-500">⏳ Loading...</span>
              )}
              {(hasMultipleAnswers ? currentAnswer?.status : message.method?.[0]?.status) !== 'pending' && (
                <>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded ${
                    (hasMultipleAnswers ? currentAnswer?.confidence : message.method?.[0]?.confidence) === 'high' ? 'bg-green-100 text-green-800' :
                    (hasMultipleAnswers ? currentAnswer?.confidence : message.method?.[0]?.confidence) === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {(hasMultipleAnswers ? currentAnswer?.confidence : message.method?.[0]?.confidence) || 'unknown'} confidence
                  </span>
                  <span>•</span>
                  <span className="text-gray-600">{(hasMultipleAnswers ? currentAnswer?.citations?.length : message.method?.[0]?.citations?.length) || 0} sources</span>
                  <span>•</span>
                  <span className="text-gray-500">{(hasMultipleAnswers ? currentAnswer?.latency_ms : message.method?.[0]?.latency_ms) || 0}ms</span>
                </>
              )}
            </div>
            
            {hasMultipleAnswers && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentAnswerIndex(i => Math.max(0, i - 1))}
                  disabled={currentAnswerIndex === 0}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <span className="text-xs text-gray-500 min-w-[3rem] text-center">
                  {currentAnswerIndex + 1} of {totalAnswers}
                </span>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCurrentAnswerIndex(i => Math.min(totalAnswers - 1, i + 1))}
                  disabled={currentAnswerIndex === totalAnswers - 1}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {message.thinking && (
          <div className="mb-3">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-gray-100"
            >
              <Brain className="w-4 h-4" />
              <span>{showThinking ? 'Hide' : 'Show'} thinking process</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showThinking ? 'rotate-180' : ''}`} />
            </button>
            
            {showThinking && (
              <div className="mt-2 p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                  <Brain className="w-3 h-3" />
                  <span>Chain of Thought</span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {message.thinking}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({children}) => <p className="mb-4 leading-relaxed last:mb-0">{children}</p>,
              h1: ({children}) => <h1 className="text-xl font-bold mt-6 mb-3 first:mt-0">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-bold mt-5 mb-2 first:mt-0">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
              ul: ({children}) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
              li: ({children}) => <li className="leading-relaxed">{children}</li>,
              code: ({node, ...props}) => {
                const isInline = !node?.position || (node.position.start.line === node.position.end.line)
                return isInline
                  ? <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                  : <code className="block bg-gray-100 p-3 rounded-md mb-4 text-sm font-mono overflow-x-auto" {...props} />
              },
              blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700">{children}</blockquote>,
              table: ({children}) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
                    {children}
                  </table>
                </div>
              ),
              thead: ({children}) => (
                <thead className="bg-gray-50">
                  {children}
                </thead>
              ),
              tbody: ({children}) => (
                <tbody className="bg-white divide-y divide-gray-200">
                  {children}
                </tbody>
              ),
              tr: ({children}) => (
                <tr>
                  {children}
                </tr>
              ),
              th: ({children}) => (
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 border-r border-gray-300 last:border-r-0">
                  {children}
                </th>
              ),
              td: ({children}) => (
                <td className="px-3 py-2 text-sm text-gray-700 border-r border-gray-200 last:border-r-0">
                  {children}
                </td>
              ),
            }}
          >
            {hasMultipleAnswers ? (currentAnswer?.answer || '') : message.content}
          </ReactMarkdown>
          {message.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-gray-900 animate-pulse" />}
        </div>

        {hasMultipleAnswers && currentAnswer?.citations && currentAnswer.citations.length > 0 && (
          <CitationCard citations={currentAnswer.citations} />
        )}

        {!hasMultipleAnswers && message.method && message.method.some(m => m.citations && m.citations.length > 0) && (
          <CitationCard 
            citations={message.method.flatMap(m => m.citations || [])} 
          />
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-1" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          {onRegenerate && (
            <Button variant="ghost" size="sm" onClick={onRegenerate}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Regenerate
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ThumbsUp className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ThumbsDown className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
