import { Zap } from 'lucide-react'

export const Logo = ({ className = "w-6 h-6" }: { className?: string }) => {
  return <Zap className={`text-rose-500 ${className}`} />
}
