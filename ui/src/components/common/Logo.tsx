export const Logo = ({ className = "w-6 h-6" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
        fill="currentColor"
        className="text-rose-500"
      />
      <path
        d="M12 8l-4 2.5v5l4 2.5 4-2.5v-5L12 8z"
        fill="currentColor"
        className="text-rose-300"
      />
    </svg>
  )
}
