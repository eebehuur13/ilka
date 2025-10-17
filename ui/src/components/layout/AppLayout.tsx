import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ChatArea } from '@/components/chat/ChatArea'
import { ChatInput } from '@/components/chat/ChatInput'
import { UploadModal } from '@/components/files/UploadModal'

export const AppLayout = () => {
  const [suggestedQuery, setSuggestedQuery] = useState<string>('')

  const handleRelatedTermClick = (term: string) => {
    setSuggestedQuery(term)
    // Reset after setting so it can be triggered again
    setTimeout(() => setSuggestedQuery(''), 100)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        <ChatArea onRelatedTermClick={handleRelatedTermClick} />
        <ChatInput suggestedQuery={suggestedQuery} />
      </div>

      <UploadModal />
    </div>
  )
}
