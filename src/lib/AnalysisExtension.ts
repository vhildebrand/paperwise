// src/lib/AnalysisExtension.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface AnalysisSuggestion {
  type: 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
  ruleName?: string;
}

export interface AnalysisExtensionOptions {
  suggestions: AnalysisSuggestion[];
  onSuggestionClick: (suggestion: AnalysisSuggestion, element: HTMLElement) => void;
  onSuggestionHover: (suggestion: AnalysisSuggestion | null, element: HTMLElement | null) => void;
  selectedSuggestion: AnalysisSuggestion | null;
}

export const AnalysisExtension = Extension.create<AnalysisExtensionOptions>({
  name: 'analysis',

  addOptions() {
    return {
      suggestions: [],
      onSuggestionClick: () => {},
      onSuggestionHover: () => {},
      selectedSuggestion: null,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('analysis'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;
            
            const { suggestions, selectedSuggestion } = extension.options;

            if (!suggestions.length) {
              return DecorationSet.empty;
            }

            // Helper function to convert character index to ProseMirror position
            const charToPos = (charIndex: number): number => {
              let pos = 0;
              let charCount = 0;
              
              doc.descendants((node, nodePos) => {
                if (node.isText) {
                  const nodeLength = node.text?.length || 0;
                  if (charCount <= charIndex && charIndex < charCount + nodeLength) {
                    pos = nodePos + (charIndex - charCount);
                    return false; // Stop traversal
                  }
                  charCount += nodeLength;
                }
                return true;
              });
              
              return pos;
            };

            // Process each suggestion
            suggestions.forEach((suggestion) => {
              try {
                // Convert character indices to ProseMirror positions
                const from = charToPos(suggestion.startIndex);
                const to = charToPos(suggestion.endIndex);
                
                console.log(`Processing suggestion:`, {
                  type: suggestion.type,
                  originalText: suggestion.originalText,
                  startIndex: suggestion.startIndex,
                  endIndex: suggestion.endIndex,
                  from,
                  to,
                  docSize: doc.content.size
                });
                
                // Validate positions
                if (from >= 0 && to > from && to <= doc.content.size) {
                  // Check if this suggestion is selected
                  const isSelected = selectedSuggestion && 
                    selectedSuggestion.startIndex === suggestion.startIndex &&
                    selectedSuggestion.endIndex === suggestion.endIndex;
                  
                  const className = `suggestion suggestion-${suggestion.type} ${isSelected ? 'suggestion-selected' : ''}`;

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: className,
                      'data-suggestion': JSON.stringify(suggestion),
                    })
                  );
                  
                  console.log(`Created decoration for:`, suggestion.originalText, `at positions ${from}-${to}`);
                } else {
                  console.warn(`Invalid positions for suggestion:`, suggestion.originalText, `from: ${from}, to: ${to}`);
                }
              } catch (error) {
                console.warn('Error processing suggestion:', suggestion, error);
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          
          handleDOMEvents: {
            mousedown: (view, event: Event) => {
              const target = event.target as HTMLElement;
              const suggestionEl = target.closest('.suggestion');
              if (suggestionEl) {
                event.preventDefault();
                event.stopPropagation();
                const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                if (suggestionAttr) {
                  try {
                    const suggestion = JSON.parse(suggestionAttr);
                    extension.options.onSuggestionClick(suggestion, suggestionEl as HTMLElement);
                    return true;
                  } catch (error) {
                    console.warn('Error parsing suggestion data:', error);
                  }
                }
              }
              return false;
            },
            
            mouseover: (view, event: Event) => {
              const target = event.target as HTMLElement;
              const suggestionEl = target.closest('.suggestion');
              if (suggestionEl) {
                const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                if (suggestionAttr) {
                  try {
                    const suggestion = JSON.parse(suggestionAttr);
                    extension.options.onSuggestionHover(suggestion, suggestionEl as HTMLElement);
                  } catch (error) {
                    console.warn('Error parsing suggestion data on hover:', error);
                  }
                }
              }
              return false;
            },
            
            mouseleave: () => {
              extension.options.onSuggestionHover(null, null);
              return false;
            }
          },
        },
      }),
    ];
  },

  onUpdate() {
    // Force re-render when options change
    this.editor.view.dispatch(this.editor.view.state.tr);
  },
});