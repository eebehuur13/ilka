import { useFileStore } from '@/stores/useFileStore'
import { FileCard } from './FileCard'

export const FileList = () => {
  const { documents } = useFileStore()

  if (documents.length === 0) {
    return (
      <p className="text-xs text-gray-400 px-2">No files uploaded</p>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <FileCard key={doc.id} document={doc} />
      ))}
    </div>
  )
}
