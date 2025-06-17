import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { unified } from 'unified';
import retextEnglish from 'retext-english';
import retextSpell from 'retext-spell';
import dictionary from 'dictionary-en-us';               // now recognised

const spellCheckProcessor = unified()
  .use(retextEnglish)
  .use(retextSpell, dictionary);                          // no need for `{ dictionary }`

const spellCheckPlugin = () => new Plugin({
  key: new PluginKey('spellcheck'),
  state: {
    init: () => DecorationSet.empty,
    apply: (tr, oldSet) => {
      // Only run spell check on completed words, not during typing
      if (!tr.docChanged || tr.steps.length === 0) return oldSet;
      
      // Check if this is just a simple text insertion (not a complex edit)
      const lastStep = tr.steps[tr.steps.length - 1];
      if (!lastStep || !('from' in lastStep) || !('to' in lastStep)) {
        return oldSet;
      }

      const decorations: Decoration[] = [];

      try {
        tr.doc.descendants((node, pos) => {
          if (!node.isText) return;

          const text = node.textContent;
          if (!text || text.length < 3) return; // Skip very short text

          try {
            const file = spellCheckProcessor.processSync(text);

            file.messages.forEach((msg: any) => {
              const from = pos + (msg.place?.start?.offset ?? 0);
              const to = pos + (msg.place?.end?.offset ?? 0);

              if (to <= from || to > tr.doc.content.size) return;

              decorations.push(
                Decoration.inline(from, to, {
                  class: 'spell-error',
                  title: `Suggestions: ${(msg.expected ?? []).join(', ')}`,
                })
              );
            });
          } catch (error) {
            // Silently handle spell check errors
            console.warn('Spell check error for text:', error);
          }
        });
      } catch (error) {
        console.warn('Spell check processing error:', error);
        return oldSet;
      }

      return DecorationSet.create(tr.doc, decorations);
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
});

export const SpellCheckExtension = Extension.create({
  name: 'spellCheck',
  addProseMirrorPlugins() {
    return [spellCheckPlugin()];
  },
});
