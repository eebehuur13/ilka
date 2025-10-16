# Ilka UI

Modern web interface for the Ilka knowledge platform.

## Features

- ✅ Rose-themed color scheme
- ✅ Linear-style file management
- ✅ ChatGPT-style chat interface
- ✅ Real-time document processing status
- ✅ Progressive answer display with multiple methods
- ✅ File upload with drag & drop
- ✅ Mode toggle (Model-Only / File-Search)
- ✅ Responsive design

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file:

```
VITE_API_URL=http://localhost:8787
```

## Project Structure

```
src/
├── components/
│   ├── layout/          # Sidebar, Header, AppLayout
│   ├── chat/            # ChatArea, ChatMessage, ChatInput
│   ├── files/           # FileList, FileCard, UploadModal
│   ├── common/          # Logo, shared components
│   └── ui/              # shadcn/ui components
├── stores/              # Zustand stores
├── lib/                 # API client, utilities
├── types/               # TypeScript types
└── App.tsx              # Main app component
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Axios (API client)
- Lucide React (icons)
- shadcn/ui (component library)

## Backend Connection

Make sure the Ilka worker is running on `http://localhost:8787`:

```bash
cd ../
npm run dev
```

Then start the UI:

```bash
cd ui
npm run dev
```

The UI will be available at `http://localhost:5173`.
