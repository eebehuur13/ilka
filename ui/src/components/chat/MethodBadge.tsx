import { Loader2, CheckCircle } from 'lucide-react'
import type { MethodResult } from '@/types'
import { cn } from '@/lib/utils'

interface MethodBadgeProps {
  method: MethodResult
}

export const MethodBadge = ({ method }: MethodBadgeProps) => {
  const getBadgeColor = () => {
    if (method.method.includes('bm25')) {
      return 'bg-blue-100 text-blue-700 border-blue-200'
    }
    if (method.method.includes('vector')) {
      return 'bg-cyan-100 text-cyan-700 border-cyan-200'
    }
    if (method.method.includes('hyde')) {
      return 'bg-orange-100 text-orange-700 border-orange-200'
    }
    return 'bg-violet-100 text-violet-700 border-violet-200'
  }

  const getIcon = () => {
    if (method.status === 'streaming' || method.status === 'pending') {
      return <Loader2 className="w-3 h-3 animate-spin" />
    }
    return <CheckCircle className="w-3 h-3" />
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
        getBadgeColor()
      )}
    >
      {getIcon()}
      <span>{method.label}</span>
      {method.status === 'complete' && (
        <>
          <span>·</span>
          <span>{(method.latency_ms / 1000).toFixed(1)}s</span>
        </>
      )}
    </div>
  )
}
