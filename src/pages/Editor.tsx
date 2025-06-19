// pages/Editor.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import type { AnalysisSuggestion, DocumentStats, AnalysisStatus } from '../types/analysis';
import type { Database } from '../types/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import History from '@tiptap/extension-history';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import 'katex/dist/katex.min.css';
import { Panel, PanelGroup } from 'react-resizable-panels';

import { IconSaveStatus, IconArrowLeft } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import SuggestionsSidebar from '../components/SuggestionsSidebar';
import './Editor.css';

import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node } from 'prosemirror-model';

type Document = Database['public']['Tables']['documents']['Row'];

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const Editor: React.FC = () => {
  const { user } = useAuthStore();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [suggestions, setSuggestions] = useState<AnalysisSuggestion[]>([]);
  const [grammarSuggestions, setGrammarSuggestions] = useState<AnalysisSuggestion[]>([]); // For LLM
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle'); //
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedTone, setSelectedTone] = useState('formal');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0, readingTime: 0 });
  const [decorations, setDecorations] = useState(DecorationSet.empty);

  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // DEBOUNCED AUTOSAVE FUNCTION
  const debouncedSave = useCallback(debounce(async (content: string) => {
    if (!documentId) return;
    setSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;
      setSaveStatus('saved');
      setLastSaveTime(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveStatus('error');
    }
  }, 2000), [documentId]);

  // TIPTAP EDITOR
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Using the History extension instead
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      Strike,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      History,
      MathExtension,
    ],
    content: '',
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      const doc = editor.state.doc;
      const words = text.split(/\s+/).filter(Boolean).length;
      const characters = text.length;
      const readingTime = Math.ceil(words / 200);
      setDocumentStats({ words, characters, readingTime });
      debouncedSave(html);
      debouncedGrammarCheck(text);
      //debouncedSpellCheck(text, doc);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto',
        spellcheck: 'false',
      },
      decorations: () => decorations,
    },
  });

  // SPELL CHECK FUNCTION
  const processSpellCheckResults = useCallback((results: any[], doc: Node) => {
    console.log('Processing spell check results:', results);
    const newSuggestions: AnalysisSuggestion[] = [];
    const newDecorations: Decoration[] = [];

    // Create a map of misspelled words for quick lookup
    const misspelledWords = new Map(results.map(r => [r.word.toLowerCase(), r.suggestions]));

    doc.descendants((node, pos) => {
        if (!node.isText) {
            return;
        }

        const text = node.text || '';
        const words = text.match(/\b[a-zA-Z']+\b/g) || [];
        
        let currentPos = pos;
        for (const word of words) {
            const wordStart = text.indexOf(word, currentPos - pos);
            if (wordStart === -1) continue;
            
            const startIndex = pos + wordStart;
            const endIndex = startIndex + word.length;
            
            // Check if this word is misspelled
            if (misspelledWords.has(word.toLowerCase())) {
                const suggestions = misspelledWords.get(word.toLowerCase()) || [];
                
                // Create a suggestion for the sidebar
                newSuggestions.push({
                    type: 'spelling',
                    originalText: word,
                    suggestion: suggestions[0] || word,
                    explanation: `Possible spelling mistake. Suggestions: ${suggestions.join(', ')}`,
                    startIndex,
                    endIndex,
                    chunkId: `${startIndex}-${endIndex}`
                });

                // Create a decoration for inline highlighting
                newDecorations.push(
                    Decoration.inline(startIndex, endIndex, {
                        class: 'suggestion suggestion-spelling',
                    })
                );
            }
            
            currentPos = pos + wordStart + word.length;
        }
    });
    
    console.log('Created suggestions:', newSuggestions.length, 'decorations:', newDecorations.length);
    
    // Only update spelling suggestions, preserve grammar suggestions
    setSuggestions(newSuggestions);
    
    // Update decorations - combine with existing grammar decorations
    if(editor) {
      updateDecorations(newDecorations, 'spelling');
    }

  }, [editor]);

  // --- NEW: Function to process LLM response ---
  const processGrammarResults = useCallback((originalText: string, correctedTextWithTags: string) => {
    console.log('=== GRAMMAR PROCESSING DEBUG ===');
    console.log('Original text:', originalText);
    console.log('Corrected text with tags:', correctedTextWithTags);
    
    if (!correctedTextWithTags) {
      console.log('No corrected text provided, returning early');
      return;
    }

    const newSuggestions: AnalysisSuggestion[] = [];
    const newDecorations: Decoration[] = [];
    
    // Parse del/ins tags directly from the LLM response
    const delInsRegex = /<del>(.*?)<\/del><ins>(.*?)<\/ins>/g;
    let match;
    
    // Build a mapping of corrected text positions to original text positions
    let correctedToOriginalMap: number[] = [];
    let correctedIndex = 0;
    let originalIndex = 0;
    let correctedTextWithoutTags = '';
    
    // First pass: build the position mapping
    let lastIndex = 0;
    while ((match = delInsRegex.exec(correctedTextWithTags)) !== null) {
      const [fullMatch, deletedText, insertedText] = match;
      
      // Add the text before this del/ins pair
      const beforeMatch = correctedTextWithTags.substring(lastIndex, match.index);
      correctedTextWithoutTags += beforeMatch;
      
      // Map positions for the text before the del/ins pair
      for (let i = 0; i < beforeMatch.length; i++) {
        correctedToOriginalMap[correctedIndex + i] = originalIndex + i;
      }
      
      correctedIndex += beforeMatch.length;
      originalIndex += beforeMatch.length;
      
      // For the del/ins pair, we map the insertion position to the deletion position
      for (let i = 0; i < insertedText.length; i++) {
        correctedToOriginalMap[correctedIndex + i] = originalIndex;
      }
      
      correctedIndex += insertedText.length;
      originalIndex += deletedText.length; // Skip the deleted text in original
      
      lastIndex = match.index + fullMatch.length;
    }
    
    // Add any remaining text after the last del/ins pair
    const remainingText = correctedTextWithTags.substring(lastIndex);
    correctedTextWithoutTags += remainingText;
    for (let i = 0; i < remainingText.length; i++) {
      correctedToOriginalMap[correctedIndex + i] = originalIndex + i;
    }
    
    console.log('Corrected text without tags:', correctedTextWithoutTags);
    console.log('Position mapping:', correctedToOriginalMap);
    
    // Second pass: find del/ins pairs and calculate correct positions
    delInsRegex.lastIndex = 0; // Reset regex
    lastIndex = 0;
    correctedIndex = 0;
    
    while ((match = delInsRegex.exec(correctedTextWithTags)) !== null) {
      const [fullMatch, deletedText, insertedText] = match;
      console.log(`Found del/ins pair: "${deletedText}" -> "${insertedText}"`);
      
      // Calculate the position in the corrected text (without tags)
      const beforeMatch = correctedTextWithTags.substring(lastIndex, match.index);
      const correctedPosition = correctedIndex + beforeMatch.length;
      
      // Map to original text position
      const originalPosition = correctedToOriginalMap[correctedPosition];
      
      console.log(`Corrected position: ${correctedPosition}, mapped to original position: ${originalPosition}`);
      console.log(`Original text at this position: "${originalText.substring(originalPosition, originalPosition + deletedText.length)}"`);
      
      // Verify this matches what we expect to replace
      if (originalText.substring(originalPosition, originalPosition + deletedText.length) === deletedText) {
        const suggestion: AnalysisSuggestion = {
          type: 'grammar',
          originalText: deletedText,
          suggestion: insertedText,
          explanation: 'AI-powered grammar & style suggestion.',
          startIndex: originalPosition,
          endIndex: originalPosition + deletedText.length,
          chunkId: `gram-${originalPosition}`
        };
        console.log('Created suggestion:', suggestion);
        newSuggestions.push(suggestion);
        
        // Create decoration for grammar suggestions
        newDecorations.push(
          Decoration.inline(originalPosition, originalPosition + deletedText.length, {
            class: 'suggestion suggestion-grammar',
          })
        );
      } else {
        console.log('Position mismatch - skipping this suggestion');
      }
      
      correctedIndex += beforeMatch.length + insertedText.length;
      lastIndex = match.index + fullMatch.length;
    }
    
    console.log('Final suggestions created:', newSuggestions.length);
    console.log('Final decorations created:', newDecorations.length);
    console.log('All suggestions:', newSuggestions);
    console.log('=== END GRAMMAR PROCESSING DEBUG ===');
    
    setGrammarSuggestions(newSuggestions);
    
    // Update decorations - combine with existing spelling decorations
    if(editor) {
      updateDecorations(newDecorations, 'grammar');
    }
  }, [editor]);

  // Unified decoration management
  const updateDecorations = useCallback((newDecorations: Decoration[], type: 'spelling' | 'grammar') => {
    if (!editor) return;
    
    const doc = editor.state.doc;
    const existingDecorations = decorations.find(0, doc.content.size);
    
    // Filter out existing decorations of the same type
    const filteredExisting = existingDecorations.filter(dec => {
      const className = dec.spec?.class || '';
      if (type === 'spelling') {
        return !className.includes('suggestion-spelling');
      } else {
        return !className.includes('suggestion-grammar');
      }
    });
    
    // Combine filtered existing decorations with new ones
    const allDecorations = [...filteredExisting, ...newDecorations];
    setDecorations(DecorationSet.create(doc, allDecorations));
  }, [editor, decorations]);

   // --- NEW: Debounced function to call our Edge Function ---
   const debouncedGrammarCheck = useCallback(debounce(async (text: string) => {
    console.log('=== GRAMMAR CHECK DEBUG ===');
    console.log('Input text:', text);
    console.log('Selected tone:', selectedTone);
    
    if (text.trim().length < 20) { // Don't analyze very short texts
        console.log('Text too short, skipping analysis');
        setAnalysisStatus('idle');
        return;
    }

    setAnalysisStatus('analyzing'); //
    try {
        console.log('Calling edge function...');
        const { data, error } = await supabase.functions.invoke('analyze-text', {
            body: { text, tone: selectedTone },
        });

        console.log('Edge function response - data:', data);
        console.log('Edge function response - error:', error);

        if (error) throw error;
        
        console.log('Processing grammar results with correctedText:', data.correctedText);
        processGrammarResults(text, data.correctedText);
        setAnalysisStatus('complete'); //
    } catch (error) {
        console.error('Error fetching grammar analysis:', error);
        setAnalysisStatus('error'); //
    }
    console.log('=== END GRAMMAR CHECK DEBUG ===');
  }, 2500), [selectedTone, processGrammarResults]);

  

  // DEBOUNCED SPELL CHECK FUNCTION
  const debouncedSpellCheck = useCallback(debounce((text: string, doc: Node) => {
      // Commented out since we're using AI-powered grammar suggestions
      // if (spellCheckWorkerRef.current) {
      //     spellCheckWorkerRef.current.postMessage({ text });
      // }
  }, 1000), []);


  
  // Initialize worker
  useEffect(() => {
    // Commented out spellcheck worker since we're using AI-powered grammar suggestions
    // spellCheckWorkerRef.current = new Worker(new URL('../workers/spellcheck.worker.ts', import.meta.url), { type: 'module' });
    
    // spellCheckWorkerRef.current.onmessage = (event) => {
    //     const { type, results, error } = event.data;
    //     if (type === 'INIT_COMPLETE') {
    //         console.log('Spell checker worker initialized successfully');
    //     } else if (type === 'INIT_ERROR') {
    //         console.error('Spell checker worker initialization failed:', error);
    //     } else if (type === 'SPELL_RESULT' && editor) {
    //         processSpellCheckResults(results, editor.state.doc);
    //     } else if (type === 'PROCESS_ERROR') {
    //         console.error('Spell checker processing error:', error);
    //     }
    // };
    
    // spellCheckWorkerRef.current.onerror = (error) => {
    //     console.error('Spell checker worker error:', error);
    // };
    
    return () => {
        // spellCheckWorkerRef.current?.terminate();
    };
  }, [editor, processSpellCheckResults]);


  const allSuggestions = useMemo(() => {
    // Combine nspell suggestions with LLM suggestions
    const combined = [...suggestions, ...grammarSuggestions];
    console.log('=== ALL SUGGESTIONS DEBUG ===');
    console.log('Spelling suggestions:', suggestions);
    console.log('Grammar suggestions:', grammarSuggestions);
    console.log('Combined suggestions:', combined);
    console.log('=== END ALL SUGGESTIONS DEBUG ===');
    return combined;
  }, [suggestions, grammarSuggestions]);

  // Function to update suggestion positions after content changes
  const updateSuggestionPositions = useCallback((
    suggestions: AnalysisSuggestion[], 
    changeStart: number, 
    changeEnd: number, 
    newContent: string
  ): AnalysisSuggestion[] => {
    const changeLength = changeEnd - changeStart;
    const newLength = newContent.length;
    const lengthDifference = newLength - changeLength;
    
    console.log('=== UPDATING SUGGESTION POSITIONS ===');
    console.log('Change start:', changeStart, 'end:', changeEnd, 'length:', changeLength);
    console.log('New content length:', newLength, 'difference:', lengthDifference);
    
    return suggestions.map(suggestion => {
      let newStartIndex = suggestion.startIndex;
      let newEndIndex = suggestion.endIndex;
      
      // If this suggestion comes after the change, shift its position
      if (suggestion.startIndex > changeEnd) {
        newStartIndex = suggestion.startIndex + lengthDifference;
        newEndIndex = suggestion.endIndex + lengthDifference;
        console.log(`Suggestion after change: ${suggestion.originalText} -> ${newStartIndex}-${newEndIndex}`);
      }
      // If this suggestion overlaps with the change, we need to handle it carefully
      else if (suggestion.startIndex < changeEnd && suggestion.endIndex > changeStart) {
        // This suggestion overlaps with the accepted change - we should probably remove it
        console.log(`Suggestion overlaps with change: ${suggestion.originalText} - will be removed`);
        return null;
      }
      // If this suggestion is before the change, no adjustment needed
      else {
        console.log(`Suggestion before change: ${suggestion.originalText} - no adjustment needed`);
      }
      
      return {
        ...suggestion,
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        chunkId: `${suggestion.type}-${newStartIndex}`
      };
    }).filter(Boolean) as AnalysisSuggestion[];
  }, []);

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => { //
    if (!editor) return;
    const { startIndex, endIndex, suggestion } = suggestionToAccept;

    console.log('=== ACCEPTING SUGGESTION DEBUG ===');
    console.log('Suggestion:', suggestionToAccept);
    console.log('Original text at position:', editor.state.doc.textBetween(startIndex, endIndex));

    // Get the text around the suggestion to determine spacing
    const beforeText = editor.state.doc.textBetween(Math.max(0, startIndex - 1), startIndex);
    const afterText = editor.state.doc.textBetween(endIndex, Math.min(editor.state.doc.content.size, endIndex + 1));
    
    console.log('Text before:', `"${beforeText}"`);
    console.log('Text after:', `"${afterText}"`);

    // Determine if we need to add spaces
    let finalSuggestion = suggestion;
    
    // Check if we need a space before the suggestion
    const needsSpaceBefore = beforeText.length > 0 && 
      !beforeText.match(/\s$/) && 
      !suggestion.match(/^[.,!?;:]/) &&
      !beforeText.match(/[.,!?;:]$/);
    
    // Check if we need a space after the suggestion  
    const needsSpaceAfter = afterText.length > 0 && 
      !afterText.match(/^\s/) && 
      !suggestion.match(/[.,!?;:]$/) &&
      !afterText.match(/^[.,!?;:]/);
    
    if (needsSpaceBefore) {
      finalSuggestion = ' ' + finalSuggestion;
      console.log('Adding space before suggestion');
    }
    
    if (needsSpaceAfter) {
      finalSuggestion = finalSuggestion + ' ';
      console.log('Adding space after suggestion');
    }
    
    console.log('Final suggestion to insert:', `"${finalSuggestion}"`);
    console.log('=== END ACCEPTING SUGGESTION DEBUG ===');

    // Apply the change
    editor.chain()
        .focus()
        .insertContentAt({ from: startIndex, to: endIndex }, finalSuggestion)
        .run();
    
    // Update positions of remaining suggestions
    const updatedSpellingSuggestions = updateSuggestionPositions(
      suggestions.filter(s => s.startIndex !== suggestionToAccept.startIndex),
      startIndex,
      endIndex,
      finalSuggestion
    );
    
    const updatedGrammarSuggestions = updateSuggestionPositions(
      grammarSuggestions.filter(s => s.startIndex !== suggestionToAccept.startIndex),
      startIndex,
      endIndex,
      finalSuggestion
    );
    
    // Update the suggestion lists with corrected positions
    if (suggestionToAccept.type === 'spelling') {
      setSuggestions(updatedSpellingSuggestions);
    } else {
      setGrammarSuggestions(updatedGrammarSuggestions);
    }
    
    setSelectedSuggestion(null);
  };


  // HANDLE DISMISS SUGGESTION
  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
    console.log('=== DISMISSING SUGGESTION DEBUG ===');
    console.log('Dismissing suggestion:', suggestionToDismiss);
    
    // Remove the dismissed suggestion and update positions of remaining suggestions
    if (suggestionToDismiss.type === 'spelling') {
      const updatedSuggestions = updateSuggestionPositions(
        suggestions.filter(s => s.startIndex !== suggestionToDismiss.startIndex),
        suggestionToDismiss.startIndex,
        suggestionToDismiss.endIndex,
        suggestionToDismiss.originalText // No change in content, just removing the suggestion
      );
      setSuggestions(updatedSuggestions);
    } else {
      const updatedSuggestions = updateSuggestionPositions(
        grammarSuggestions.filter(s => s.startIndex !== suggestionToDismiss.startIndex),
        suggestionToDismiss.startIndex,
        suggestionToDismiss.endIndex,
        suggestionToDismiss.originalText // No change in content, just removing the suggestion
      );
      setGrammarSuggestions(updatedSuggestions);
    }
    
    console.log('=== END DISMISSING SUGGESTION DEBUG ===');
    setSelectedSuggestion(null);
  };


  // HANDLE NAVIGATE SUGGESTIONS
  const handleNavigateSuggestions = (direction: 'prev' | 'next') => {
    if (!allSuggestions.length) return;
    const currentIndex = selectedSuggestion
      ? allSuggestions.findIndex(s => s.startIndex === selectedSuggestion.startIndex)
      : -1;
    let newIndex = direction === 'prev'
      ? (currentIndex - 1 + allSuggestions.length) % allSuggestions.length
      : (currentIndex + 1) % allSuggestions.length;
    setSelectedSuggestion(allSuggestions[newIndex]);
  };



  // HANDLE AI REWRITE
  const handleAIRewrite = (action: 'paraphrase' | 'shorten' | 'expand') => {
    console.log(`AI Rewrite triggered with action: ${action} and tone: ${selectedTone}`);
  };



  // FETCH DOCUMENT
  useEffect(() => {
    if (!user || !editor) return;
    const fetchDocument = async () => {
      if (!documentId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();
        if (error) throw error;
        if (data) {
          setDocumentData(data);
          setEditedTitle(data.title);
          if (editor.isEditable) {
            editor.commands.setContent(data.content || '', false);
            const initialText = editor.getText();
            if (initialText) {
              //debouncedAnalysis(initialText);
              // debouncedSpellCheck(initialText, editor.state.doc); // Commented out since we're using AI-powered suggestions
            }
            // Focus the editor after content is loaded
            setTimeout(() => {
              editor.commands.focus();
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, navigate, user, editor]);


  // FOCUS EDITOR WHEN IT'S READY
  useEffect(() => {
    if (editor && !loading && documentData) {
      setTimeout(() => {
        editor.commands.focus();
      }, 200);
    }
  }, [editor, loading, documentData]);


  // UPDATE TITLE
  const updateTitle = async () => {
    if (!documentId || !editedTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('documents')
        .update({ title: editedTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', documentId);
      if (error) throw error;
      setDocumentData(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!documentData) return <div className="flex items-center justify-center h-screen"><p>Document not found.</p></div>;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={75} minSize={50}>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
              <div className='max-w-4xl mx-auto flex items-center justify-between'>
                <div className="flex items-center space-x-4">
                  <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100" title="Back to Dashboard">
                    <IconArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={updateTitle}
                      onKeyDown={(e) => e.key === 'Enter' && updateTitle()}
                      className="text-2xl font-bold p-1 -m-1 border-b-2 border-blue-500 outline-none"
                      autoFocus
                    />
                  ) : (
                    <h1 onClick={() => setIsEditingTitle(true)} className="text-2xl font-bold cursor-pointer">{documentData.title}</h1>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{saveStatus}</span>
                    <IconSaveStatus status={saveStatus} />
                  </div>
                  {lastSaveTime && <span className="text-xs text-gray-400">Last saved: {lastSaveTime.toLocaleTimeString()}</span>}
                </div>
              </div>
            </div>

            
            {editor && (
              <EditorToolbar
                editor={editor}
                analysisStatus={analysisStatus}
                selectedTone={selectedTone}
                onToneChange={setSelectedTone}
                onAIRewrite={(action) => handleAIRewrite(action!)}
              />
            )}
            

            <div className="flex-1 p-6 overflow-y-auto" ref={editorRef}>
              <div 
                className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full cursor-text"
                onClick={() => {
                  if (editor) {
                    editor.commands.focus();
                  }
                }}
                tabIndex={-1}
                role="textbox"
                aria-label="Document editor"
              >
                {editor && (
                  <EditorContent 
                    editor={editor} 
                    key={editor.isEditable ? 'editable' : 'not-editable'}
                  />
                )}
              </div>
            </div>
          </div>
        </Panel>
        
        <SuggestionsSidebar
          suggestions={allSuggestions} // Pass the combined list
          selectedSuggestion={selectedSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onSelect={setSelectedSuggestion}
          analysisStatus={analysisStatus}
          isVisible={sidebarVisible}
          onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
          documentStats={documentStats}
    />
      </PanelGroup>

    </div>
  );
};

export default Editor;