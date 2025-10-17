import { Brain, Lightbulb, Tags, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { QueryAnalysis } from '@/types'
import { useState } from 'react'

interface AnalyzerInsightsProps {
  analysis: QueryAnalysis
  onRelatedTermClick?: (term: string) => void
}

export const AnalyzerInsights = ({ analysis, onRelatedTermClick }: AnalyzerInsightsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasInsights = (analysis.synonyms && analysis.synonyms.length > 0) || 
                      (analysis.related_terms && analysis.related_terms.length > 0)

  if (!hasInsights) return null

  return (
    <Card className="p-3 bg-blue-50 border-blue-200 text-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2 font-medium text-blue-900">
          <Brain className="w-4 h-4" />
          <span>Query Analysis</span>
          <span className="text-xs font-normal text-blue-700">
            {analysis.complexity} • {analysis.intent}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-blue-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {analysis.synonyms && analysis.synonyms.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-blue-700 mb-1.5 text-xs">
                <Tags className="w-3 h-3" />
                <span>Related terms:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.synonyms.map((syn, idx) => (
                  <span 
                    key={idx} 
                    className="px-2 py-1 bg-white rounded text-xs border border-blue-200"
                  >
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.related_terms && analysis.related_terms.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-blue-700 mb-1.5 text-xs">
                <Lightbulb className="w-3 h-3" />
                <span>Try asking about:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.related_terms.map((term, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 py-1 bg-white hover:bg-blue-100 rounded text-xs border border-blue-200 transition-colors"
                    onClick={() => onRelatedTermClick?.(term)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {analysis.recommended_methods && analysis.recommended_methods.length > 0 && (
            <div className="text-xs text-blue-600 pt-2 border-t border-blue-200">
              <span className="font-medium">Recommended methods:</span> {analysis.recommended_methods.join(', ')}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
