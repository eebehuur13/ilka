import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ChatArea } from '@/components/chat/ChatArea'
import { ChatInput } from '@/components/chat/ChatInput'
import { UploadModal } from '@/components/files/UploadModal'

export const AppLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        <ChatArea />
        <ChatInput />
      </div>

      <UploadModal />
    </div>
  )
}
