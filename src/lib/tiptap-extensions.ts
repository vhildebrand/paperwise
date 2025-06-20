import { Paragraph } from '@tiptap/extension-paragraph'
import { nanoid } from 'nanoid'
import { Plugin } from 'prosemirror-state'
import { Node } from 'prosemirror-model'
import { Extension } from '@tiptap/core'

export const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      'data-paragraph-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-paragraph-id'),
        renderHTML: (attributes) => {
          return { 'data-paragraph-id': attributes['data-paragraph-id'] }
        },
      },
    }
  },
})

function IdGeneratorPlugin() {
  return new Plugin({
    appendTransaction: (transactions, oldState, newState) => {
      if (!transactions.some((tr) => tr.docChanged)) {
        return
      }

      const { tr } = newState
      const paragraphsWithoutIds: { node: Node; pos: number }[] = []

      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && !node.attrs['data-paragraph-id']) {
          paragraphsWithoutIds.push({ node, pos })
        }
      })

      if (paragraphsWithoutIds.length > 0) {
        paragraphsWithoutIds.forEach(({ pos }) => {
          tr.setNodeMarkup(pos, undefined, {
            ...newState.doc.nodeAt(pos)?.attrs,
            'data-paragraph-id': nanoid(),
          })
        })
        return tr
      }

      return
    },
  })
}

export const ParagraphIdGenerator = Extension.create({
  name: 'paragraphIdGenerator',

  addProseMirrorPlugins() {
    return [IdGeneratorPlugin()]
  },
}) 