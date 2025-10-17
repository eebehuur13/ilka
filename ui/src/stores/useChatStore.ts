import { create } from 'zustand'
import type { ChatMessage, Conversation, ChatMode, QueryOptions } from '@/types'

interface ChatStore {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: ChatMessage[]
  mode: ChatMode
  reasoning: boolean
  isProcessing: boolean
  queryOptions: QueryOptions
  
  setMode: (mode: ChatMode) => void
  setReasoning: (reasoning: boolean) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setIsProcessing: (processing: boolean) => void
  setQueryOptions: (options: QueryOptions) => void
  clearMessages: () => void
  createConversation: (title?: string) => string
  loadConversation: (id: string) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  mode: 'file-search',
  reasoning: false,
  isProcessing: false,
  queryOptions: {},
  
  setMode: (mode) => set({ mode }),
  
  setReasoning: (reasoning) => set({ reasoning }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    )
  })),
  
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  
  setQueryOptions: (options) => set({ queryOptions: options }),
  
  clearMessages: () => set({ messages: [], currentConversationId: null }),
  
  createConversation: (title = 'New Chat') => {
    const id = `conv-${Date.now()}`
    const conversation: Conversation = {
      id,
      title,
      messages: [],
      created_at: new Date(),
      updated_at: new Date()
    }
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      messages: []
    }))
    return id
  },
  
  loadConversation: (id) => {
    const conv = get().conversations.find(c => c.id === id)
    if (conv) {
      set({
        currentConversationId: id,
        messages: conv.messages
      })
    }
  }
}))
