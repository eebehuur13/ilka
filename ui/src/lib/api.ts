import axios from 'axios'
import type { Document, QueryOptions } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const uploadDocument = async (fileName: string, content: string, userId: string): Promise<{ document_id: string; status: string; message: string }> => {
  const response = await api.post('/upload', {
    file_name: fileName,
    content,
    user_id: userId
  })
  return response.data
}

export const queryDocuments = async (
  query: string, 
  userId: string, 
  options?: QueryOptions & { mode?: 'model-only' | 'file-search' }
) => {
  const response = await api.post('/query', {
    query,
    user_id: userId,
    ...options
  })
  return response.data
}

export const listDocuments = async (userId: string): Promise<Document[]> => {
  const response = await api.get(`/documents?user_id=${userId}`)
  return response.data.documents || []
}

export const deleteDocument = async (documentId: string, userId: string): Promise<void> => {
  await api.delete(`/documents/${documentId}?user_id=${userId}`)
}

export const getDocumentStatus = async (documentId: string): Promise<Document> => {
  const response = await api.get(`/status/${documentId}`)
  return response.data
}

export interface StreamEvent {
  type: 'thinking' | 'thinking_complete' | 'answer' | 'done' | 'error'
  text?: string
  message?: string
}

export const queryDocumentsStream = async (
  query: string,
  userId: string,
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/query/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        user_id: userId,
        mode: 'model-only'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Response body is null')
    }

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      
      // Keep incomplete line in buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamEvent
            onEvent(data)
          } catch (e) {
            console.error('Failed to parse SSE data:', e)
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream error:', error)
    if (onError) {
      onError(error as Error)
    }
  }
}

export default api
