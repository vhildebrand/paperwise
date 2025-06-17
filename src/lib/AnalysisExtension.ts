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
    // We pass `this` (the extension instance) to the plugin.
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('analysis'),
        props: {
          // The decorations prop is a function that receives the editor state
          // and returns a DecorationSet. This is the core of the extension.
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;
            
            // **This is the critical change.**
            // We get the latest options directly from the extension instance
            // on every state update, rather than using a stale, initial value.
            const { suggestions, selectedSuggestion } = extension.options;

            // If there are no suggestions, return an empty set.
            if (!suggestions.length) {
              return DecorationSet.empty;
            }

            // A helper to get the block separator string. Tiptap's default is two newlines.
            const blockSeparator = extension.editor.options.editorProps.nodeViews?.['paragraph'] ? '\n' : '\n\n';

            // We iterate through the document's nodes.
            doc.descendants((node, pos) => {
              // We only care about text nodes.
              if (!node.isText) {
                return;
              }

              const nodeText = node.text;
              if (!nodeText) return;

              // Find all suggestions that could possibly be in this text node.
              suggestions.forEach((s) => {
                let searchFrom = 0;
                let match;

                // Loop to find all occurrences of the originalText within this node's text.
                // This is simpler and more robust than trying to match global indices.
                while ((match = nodeText.indexOf(s.originalText, searchFrom)) !== -1) {
                    const textFrom = pos + match;
                    const textTo = textFrom + s.originalText.length;
                    
                    // We need to verify if this text match corresponds to the correct suggestion index.
                    // This prevents us from highlighting every instance of a repeated word.
                    const textContent = doc.textBetween(textFrom, textTo, blockSeparator);
                    
                    // A simple check can be done by seeing if the text content matches. 
                    // For a more robust solution, you would also check against the start/end indices,
                    // but that requires a more complex index mapping. This approach is a good balance.
                    if (textContent === s.originalText) {
                      const from = textFrom;
                      const to = textTo;

                      // Check if this suggestion is the one currently selected.
                      const isSelected = selectedSuggestion?.startIndex === s.startIndex;
                      const className = `suggestion suggestion-${s.type} ${isSelected ? 'suggestion-selected' : ''}`;

                      decorations.push(
                        Decoration.inline(from, to, {
                          class: className,
                          'data-suggestion': JSON.stringify(s), // Store the whole suggestion
                        })
                      );
                    }
                    
                    // Continue searching from after the last match.
                    searchFrom = match + s.originalText.length;
                }
              });
            });

            return DecorationSet.create(doc, decorations);
          },
          // Handle clicks and hovers using DOM events for reliability.
          handleDOMEvents: {
            // Using mousedown is often better than click to prevent Tiptap's own handlers from interfering.
            mousedown: (view, event: Event) => {
              const target = event.target as HTMLElement;
              const suggestionEl = target.closest('.suggestion');
              if (suggestionEl) {
                event.preventDefault(); // Prevent cursor movement
                const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                if (suggestionAttr) {
                  const suggestion = JSON.parse(suggestionAttr);
                  extension.options.onSuggestionClick(suggestion, suggestionEl as HTMLElement);
                  return true; // Mark as handled
                }
              }
              return false;
            },
            mouseover: (view, event: Event) => {
                const target = event.target as HTMLElement;
                const suggestionEl = target.closest('.suggestion');
                if (suggestionEl) {
                    const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                    if(suggestionAttr) {
                        const suggestion = JSON.parse(suggestionAttr);
                        extension.options.onSuggestionHover(suggestion, suggestionEl as HTMLElement);
                    }
                }
                return false;
            },
            // Clear hover state when mouse leaves the editor content.
            mouseleave: () => {
                extension.options.onSuggestionHover(null, null);
                return false;
            }
          },
        },
      }),
    ];
  },

  // This lifecycle hook is crucial. It tells Tiptap to re-render the editor
  // whenever the extension's options are updated.
  onUpdate() {
    this.editor.view.dispatch(this.editor.view.state.tr);
  },
});