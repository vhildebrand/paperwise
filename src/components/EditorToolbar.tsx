// src/components/EditorToolbar.tsx
import React from 'react';
import type { Editor } from '@tiptap/react';
import { 
  IconBold, IconItalic, IconUnderline, IconList, IconListOrdered, 
  IconH1, IconH2, IconBlockquote, IconCode 
} from '../assets/Icons'; // Assuming you add H1, H2, Blockquote, Code icons

interface Props {
  editor: Editor | null;
}

const EditorToolbar: React.FC<Props> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-2 sticky top-0 sm:top-[65px] z-10">
      <div className="flex items-center space-x-1 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          title="Bold (Ctrl+B)"
        >
          <IconBold />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          title="Italic (Ctrl+I)"
        >
          <IconItalic />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'is-active' : ''}
          title="Underline (Ctrl+U)"
        >
          <IconUnderline />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2"></div>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
          title="Heading 1"
        >
          <IconH1 /> {/* Replace with actual H1 Icon */}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          title="Heading 2"
        >
          <IconH2 /> {/* Replace with actual H2 Icon */}
        </button>
        <div className="w-px h-6 bg-gray-300 mx-2"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          title="Bullet List"
        >
          <IconList />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          title="Numbered List"
        >
          <IconListOrdered />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
          title="Blockquote"
        >
          <IconBlockquote /> {/* Replace with actual Blockquote Icon */}
        </button>
         <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
          title="Code Block"
        >
          <IconCode /> {/* Replace with actual Code Icon */}
        </button>
      </div>
    </div>
  );
};

// Simple styling for toolbar buttons. Add this to your CSS.
/*
button.is-active {
  background-color: #e0e7ff; // bg-indigo-100
  color: #4338ca; // text-indigo-700
}
*/

export default EditorToolbar;