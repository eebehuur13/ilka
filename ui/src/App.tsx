import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { useFileStore } from './stores/useFileStore'
import { listDocuments, getDocumentStatus } from './lib/api'

// Generate or retrieve persistent user ID from localStorage
const getUserId = (): string => {
  let userId = localStorage.getItem('ilka_user_id')
  if (!userId) {
    userId = `user-${crypto.randomUUID()}`
    localStorage.setItem('ilka_user_id', userId)
    console.log('Generated new user ID:', userId)
  }
  return userId
}

const USER_ID = getUserId()

function App() {
  const { documents, updateDocument, addDocument } = useFileStore()

  // Load documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const docs = await listDocuments(USER_ID)
        docs.forEach(doc => {
          addDocument({
            id: doc.id,
            file_name: doc.file_name || doc.id,
            status: doc.status,
            chunk_count: doc.chunk_count,
            file_size: 0,
            upload_date: doc.upload_date || Date.now()
          })
        })
      } catch (error) {
        console.error('Failed to load documents:', error)
      }
    }

    loadDocuments()
  }, [])

  // Poll for document status updates
  useEffect(() => {
    const processingDocs = documents.filter(
      doc => doc.status !== 'ready' && doc.status !== 'error'
    )

    if (processingDocs.length === 0) return

    const interval = setInterval(async () => {
      for (const doc of processingDocs) {
        try {
          const status = await getDocumentStatus(doc.id)
          updateDocument(doc.id, {
            status: status.status,
            chunk_count: status.chunk_count,
            progress: getProgressForStatus(status.status)
          })
        } catch (error) {
          console.error(`Failed to get status for ${doc.id}:`, error)
        }
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [documents])

  return <AppLayout />
}

function getProgressForStatus(status: string): number {
  const progressMap: Record<string, number> = {
    uploading: 5,
    processing: 10,
    chunking: 20,
    indexing_bm25: 35,
    generating_summary: 50,
    generating_contexts: 75,
    embedding: 90,
    ready: 100,
    error: 0
  }
  return progressMap[status] || 0
}

export default App
