# PaperWise

A modern AI-powered academic writing platform designed for researchers, students, and academics. PaperWise combines intelligent AI assistance with powerful writing tools to enhance academic writing productivity and quality.

## 🚀 Features

### AI-Powered Writing Assistant
- **Real-time Analysis**: Get intelligent suggestions for grammar, style, and academic tone as you type
- **Multiple Suggestion Types**: Spelling, grammar, style, clarity, and tone improvements
- **Contextual Feedback**: AI analyzes your writing based on academic standards and provides contextual suggestions
- **Tone Control**: Adjust analysis based on your preferred writing tone (formal, casual, academic, business, creative, neutral)
- **Advanced Analysis Settings**: Customize formality level, target audience, and writing domain

### Rich Text Editor
- **Full-featured Editor**: Built with TipTap for a professional writing experience
- **Markdown Support**: Write with clean, distraction-free markdown syntax
- **LaTeX Integration**: Embed mathematical equations and scientific notation seamlessly
- **Table Support**: Create and edit tables with resizable columns
- **Formatting Tools**: Bold, italic, underline, strikethrough, headings, and more
- **Distraction-Free Mode**: Clean, minimalist interface designed for academic writing

### Document Management
- **Cloud Storage**: Save, edit, and organize your documents with automatic cloud sync
- **Document Dashboard**: Manage all your academic documents in one place
- **Auto-save**: Automatic saving with visual status indicators
- **Document Statistics**: Track word count, character count, reading time, and Flesch-Kincaid grade level
- **Version History**: Track changes and maintain version control

### Advanced Writing Tools
- **AI Rewrite**: Paraphrase, shorten, or expand text with AI assistance
- **Citation Generator**: Generate academic citations from DOIs and queries
- **LaTeX Generator**: Create mathematical equations from natural language descriptions
- **Spell Check**: Built-in spell checking with academic vocabulary support
- **Readability Analysis**: Get insights into your writing's readability and complexity

### Collaboration & Security
- **User Authentication**: Secure login and registration with email verification
- **Protected Routes**: Secure access to documents and features
- **Academic Security**: Enterprise-grade security with end-to-end encryption
- **Real-time Collaboration**: Work together with colleagues on research papers (coming soon)

## 🎯 Perfect for Academic Writing

PaperWise is specifically designed for:
- **Research Papers**: Write and format academic papers with proper citations and references
- **Thesis & Dissertations**: Manage large academic documents with structured chapters and sections
- **Lab Reports**: Create detailed scientific reports with data analysis and conclusions
- **Conference Papers**: Prepare submissions for academic conferences and journals

## 🛠 Technical Architecture

### Frontend
- **React 19** with TypeScript for type safety
- **TipTap Editor** for rich text editing
- **Tailwind CSS** for modern, responsive design
- **React Router** for navigation
- **Zustand** for state management

### Backend
- **Supabase Edge Functions** (Deno) for serverless backend
- **OpenAI GPT-4o-mini** with structured output for AI analysis
- **Supabase PostgreSQL** for document storage
- **Supabase Auth** for user authentication

### AI Features
- **Structured Output**: Fast and reliable JSON responses using OpenAI's structured output feature
- **Rate Limiting**: Intelligent rate limiting to manage API usage
- **Error Handling**: Comprehensive error handling and validation
- **Multiple AI Tasks**: Text analysis, rewriting, LaTeX generation, and citation generation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- OpenAI API key

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (in Supabase Edge Functions)
4. Deploy Supabase Edge Functions: `supabase functions deploy`
5. Start development server: `npm run dev`

### Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📁 Project Structure

```
paperwise/
├── src/
│   ├── components/          # React components
│   │   ├── EditorToolbar.tsx
│   │   ├── SuggestionsSidebar.tsx
│   │   ├── CitationModal.tsx
│   │   ├── LatexModal.tsx
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Landing.tsx
│   │   ├── Editor.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   └── Signup.tsx
│   ├── store/              # State management
│   ├── types/              # TypeScript type definitions
│   ├── lib/                # Utility functions
│   └── workers/            # Web workers
├── supabase/
│   └── functions/          # Edge functions
│       └── analyze-text/   # AI analysis function
└── public/                 # Static assets
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Key Dependencies
- **@tiptap/react** - Rich text editor
- **@aarkue/tiptap-math-extension** - LaTeX support
- **citation-js** - Citation generation
- **katex** - Math rendering
- **react-resizable-panels** - Resizable UI panels
- **sentence-tokenizer** - Text analysis
- **nspell** - Spell checking

## 🌟 Key Features in Detail

### AI Analysis System
The AI analysis system provides real-time writing suggestions using OpenAI's structured output feature:
- Analyzes text chunks for grammar, style, and clarity issues
- Provides contextual suggestions with explanations
- Supports multiple writing tones and academic domains
- Implements intelligent rate limiting and error handling

### Document Editor
The editor combines the power of TipTap with academic writing features:
- Real-time AI suggestions with visual indicators
- LaTeX equation support with KaTeX rendering
- Table creation and editing
- Citation insertion and management
- Auto-save with status indicators

### User Experience
- Clean, academic-focused design
- Responsive layout for all devices
- Intuitive navigation and document management
- Professional typography and spacing
- Accessibility features and keyboard shortcuts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Open an issue on GitHub
- Contact the development team

---

**PaperWise** - Transform your academic writing with AI-powered assistance.
