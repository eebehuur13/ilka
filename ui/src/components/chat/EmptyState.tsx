import { Logo } from '@/components/common/Logo'
import { Card } from '@/components/ui/card'
import { FileText, HelpCircle, Zap } from 'lucide-react'

export const EmptyState = () => {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex justify-center">
          <Logo className="w-16 h-16" />
        </div>
        
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Zyn Knowledge Platform
          </h1>
          <p className="text-gray-600">
            Ask me anything about your uploaded documents or chat freely in model-only mode
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 hover:border-rose-200 transition-colors cursor-pointer">
            <Zap className="w-6 h-6 text-rose-500 mb-2" />
            <h3 className="font-medium text-sm mb-1">Sample Questions</h3>
            <p className="text-xs text-gray-500">
              Try asking about your documents
            </p>
          </Card>

          <Card className="p-4 hover:border-rose-200 transition-colors cursor-pointer">
            <FileText className="w-6 h-6 text-rose-500 mb-2" />
            <h3 className="font-medium text-sm mb-1">Browse Files</h3>
            <p className="text-xs text-gray-500">
              View and manage uploaded documents
            </p>
          </Card>

          <Card className="p-4 hover:border-rose-200 transition-colors cursor-pointer">
            <HelpCircle className="w-6 h-6 text-rose-500 mb-2" />
            <h3 className="font-medium text-sm mb-1">How it Works</h3>
            <p className="text-xs text-gray-500">
              Learn about Zyn's features
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
