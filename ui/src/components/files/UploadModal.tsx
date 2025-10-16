import { useState, useCallback } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useUIStore } from '@/stores/useUIStore'
import { useFileStore } from '@/stores/useFileStore'
import { uploadDocument } from '@/lib/api'
import { getUserId } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/types'

const USER_ID = getUserId()

export const UploadModal = () => {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const { uploadModalOpen, toggleUploadModal } = useUIStore()
  const { addDocument } = useFileStore()

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.txt')) {
      alert('Only .txt files are supported for now')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const content = await file.text()
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await uploadDocument(file.name, content, USER_ID)

      clearInterval(progressInterval)
      setProgress(100)

      addDocument({
        id: response.document_id,
        file_name: file.name,
        status: response.status as DocumentStatus,
        file_size: file.size,
        upload_date: Date.now(),
        progress: 0
      })

      setTimeout(() => {
        toggleUploadModal()
        setUploading(false)
        setProgress(0)
      }, 500)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
      setUploading(false)
      setProgress(0)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  if (!uploadModalOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload Files</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleUploadModal}
            disabled={uploading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!uploading ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
              dragActive ? 'border-rose-500 bg-rose-50' : 'border-gray-300'
            )}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".txt"
              onChange={handleChange}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-900 mb-2">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supported: .txt files · Max size: 50 MB
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-8 h-8 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">Uploading...</p>
                <Progress value={progress} className="mt-2" />
                <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
