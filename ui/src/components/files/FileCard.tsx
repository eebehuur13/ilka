import { FileText, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import type { Document } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useFileStore } from '@/stores/useFileStore'
import { deleteDocument } from '@/lib/api'
import { getUserId } from '@/lib/auth'
import { formatRelativeTime, formatFileSize } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileCardProps {
  document: Document
}

export const FileCard = ({ document }: FileCardProps) => {
  const { removeDocument } = useFileStore()

  const getStatusIcon = () => {
    switch (document.status) {
      case 'ready':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
    }
  }

  const getStatusText = () => {
    switch (document.status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'chunking':
        return 'Chunking...'
      case 'indexing_bm25':
        return 'Indexing...'
      case 'generating_summary':
        return 'Summarizing...'
      case 'generating_contexts':
        return 'Enriching...'
      case 'embedding':
        return 'Embedding...'
      case 'ready':
        return `Ready · ${document.chunk_count || 0} chunks`
      case 'error':
        return 'Error'
      default:
        return document.status
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Delete ${document.file_name}?`)) {
      try {
        await deleteDocument(document.id, getUserId())
        removeDocument(document.id)
      } catch (error) {
        console.error('Failed to delete document:', error)
        alert('Failed to delete document. Please try again.')
      }
    }
  }

  return (
    <div
      className={cn(
        "group relative rounded-md border border-gray-200 bg-white p-2 hover:border-gray-300 hover:shadow-sm transition-all",
        document.status === 'error' && "border-red-200 bg-red-50"
      )}
    >
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium truncate">{document.file_name}</p>
            {document.status !== 'ready' && document.status !== 'error' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 opacity-0 group-hover:opacity-100"
                onClick={handleDelete}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-1 mt-0.5">
            {getStatusIcon()}
            <span className="text-xs text-gray-500">{getStatusText()}</span>
          </div>

          {document.status === 'ready' && (
            <div className="text-xs text-gray-400 mt-0.5">
              {formatFileSize(document.file_size)} · {formatRelativeTime(new Date(document.upload_date))}
            </div>
          )}

          {document.progress !== undefined && document.status !== 'ready' && (
            <Progress value={document.progress} className="h-1 mt-2" />
          )}

          {document.status === 'error' && document.error_message && (
            <p className="text-xs text-red-600 mt-1">{document.error_message}</p>
          )}
        </div>

        {document.status === 'ready' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={handleDelete}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
