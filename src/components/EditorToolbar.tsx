// src/components/EditorToolbar.tsx
import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  IconBold, IconItalic, IconUnderline, IconList, IconListOrdered,
  IconH1, IconH2, IconBlockquote, IconCode, IconSaveStatus
} from '../assets/Icons';

interface Props {
  editor: Editor | null;
  analysisStatus: 'idle' | 'analyzing' | 'complete' | 'error';
}

const ToolbarButton = ({ onClick, disabled, title, isActive, children }: any) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="p-2 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-800 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-600 disabled:opacity-50 transition-colors"
        data-active={isActive}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-300 mx-2"></div>;

const EditorToolbar: React.FC<Props> = ({ editor, analysisStatus }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-2 z-20">
      <div className="flex items-center justify-between flex-wrap">
        <div className="flex items-center space-x-1 flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <IconBold />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <IconItalic />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.can().chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <IconUnderline />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <IconH1 />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <IconH2 />
          </ToolbarButton>

          <Divider />
          
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <IconList />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <IconListOrdered />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Blockquote"
          >
            <IconBlockquote />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            title="Code Block"
          >
            <IconCode />
          </ToolbarButton>
        </div>
        <div className="flex items-center text-xs text-gray-500">
            {analysisStatus === 'analyzing' && (
                <>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Analyzing...</span>
                </>
            )}
             {analysisStatus === 'complete' && (
                <span className="text-green-600">Analysis complete</span>
            )}
             {analysisStatus === 'error' && (
                <span className="text-red-600">Analysis error</span>
            )}
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;