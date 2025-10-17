import { Logo } from '@/components/common/Logo'
import { Card } from '@/components/ui/card'
import { FileText, HelpCircle, Zap } from 'lucide-react'

export const EmptyState = () => {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <Logo className="w-10 h-10 md:w-12 md:h-12" />
        </div>
        
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1.5">
            Zyn
          </h1>
          <p className="text-sm text-gray-600">
            Ask about your documents or chat freely in model-only mode
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-3 hover:border-rose-200 transition-colors cursor-pointer">
            <Zap className="w-5 h-5 text-rose-500 mb-1.5 mx-auto" />
            <h3 className="font-medium text-xs mb-0.5">Sample Questions</h3>
            <p className="text-xs text-gray-500">
              Ask about your docs
            </p>
          </Card>

          <Card className="p-3 hover:border-rose-200 transition-colors cursor-pointer">
            <FileText className="w-5 h-5 text-rose-500 mb-1.5 mx-auto" />
            <h3 className="font-medium text-xs mb-0.5">Browse Files</h3>
            <p className="text-xs text-gray-500">
              Manage documents
            </p>
          </Card>

          <Card className="p-3 hover:border-rose-200 transition-colors cursor-pointer">
            <HelpCircle className="w-5 h-5 text-rose-500 mb-1.5 mx-auto" />
            <h3 className="font-medium text-xs mb-0.5">How it Works</h3>
            <p className="text-xs text-gray-500">
              Learn about features
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
