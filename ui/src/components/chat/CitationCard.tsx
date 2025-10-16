import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import type { Citation } from '@/types'
import { Card } from '@/components/ui/card'

interface CitationCardProps {
  citations: Citation[]
}

export const CitationCard = ({ citations }: CitationCardProps) => {
  const [expanded, setExpanded] = useState(false)

  if (citations.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">{citations.length} sources</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-3 space-y-3">
          {citations.map((citation, idx) => (
            <div key={idx} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-gray-500">[{idx + 1}]</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {citation.file_name}:{citation.start_line}-{citation.end_line}
                  </p>
                  <p className="text-gray-600 mt-1 text-xs line-clamp-2">
                    {citation.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
