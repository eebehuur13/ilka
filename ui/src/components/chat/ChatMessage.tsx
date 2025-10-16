import { User } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'
import { Logo } from '@/components/common/Logo'
import { formatTime } from '@/lib/utils'
import { MethodBadge } from './MethodBadge'
import { CitationCard } from './CitationCard'
import { Button } from '@/components/ui/button'
import { Copy, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'

interface ChatMessageProps {
  message: ChatMessageType
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex gap-4 justify-end">
        <div className="flex-1 max-w-2xl">
          <div className="bg-gray-100 rounded-lg p-4">
            <p className="text-sm text-gray-900">{message.content}</p>
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
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
          <Logo className="w-5 h-5" />
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Ilka</span>
          <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
        </div>

        {message.method && message.method.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.method.map((m, idx) => (
              <MethodBadge key={idx} method={m} />
            ))}
          </div>
        )}

        <div className="prose prose-sm max-w-none">
          <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.method && message.method.some(m => m.citations && m.citations.length > 0) && (
          <CitationCard 
            citations={message.method.flatMap(m => m.citations || [])} 
          />
        )}

        {message.method && message.method.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500 p-2 bg-gray-50 rounded-md">
            <span>⚡ {message.method.length} methods</span>
            <span>·</span>
            <span>
              {message.method.reduce((sum, m) => sum + (m.citations?.length || 0), 0)} sources
            </span>
            <span>·</span>
            <span>High confidence</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Regenerate
          </Button>
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
