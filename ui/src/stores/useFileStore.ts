import { create } from 'zustand'
import type { Document } from '@/types'

interface FileStore {
  documents: Document[]
  isUploading: boolean
  uploadProgress: number
  
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
  setUploadProgress: (progress: number) => void
  setIsUploading: (uploading: boolean) => void
}

export const useFileStore = create<FileStore>((set) => ({
  documents: [],
  isUploading: false,
  uploadProgress: 0,
  
  addDocument: (doc) => set((state) => ({
    documents: [doc, ...state.documents]
  })),
  
  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map(doc =>
      doc.id === id ? { ...doc, ...updates } : doc
    )
  })),
  
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter(doc => doc.id !== id)
  })),
  
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),
}))
