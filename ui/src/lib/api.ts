import axios from 'axios'
import type { Document, QueryOptions } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const uploadDocument = async (fileName: string, content: string, userId: string): Promise<Document> => {
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

export default api
