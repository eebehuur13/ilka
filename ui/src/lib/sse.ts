export interface SSEMessage {
  type: string
  data: any
}

export class SSEConnection {
  private eventSource: EventSource | null = null
  private handlers: Map<string, (data: any) => void> = new Map()

  connect(url: string) {
    this.eventSource = new EventSource(url)
    
    this.eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data)
        const handler = this.handlers.get(message.type)
        if (handler) {
          handler(message.data)
        }
      } catch (error) {
        console.error('SSE parse error:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      this.close()
    }
  }

  on(type: string, handler: (data: any) => void) {
    this.handlers.set(type, handler)
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.handlers.clear()
  }
}
