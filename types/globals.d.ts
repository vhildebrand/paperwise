// dictionary-en-us fix
declare module 'dictionary-en-us' {
  const dictionary: any;
  export default dictionary;
}

// augment vfile-message with spellcheck-specific props
declare module 'vfile-message' {
  interface VFileMessage {
    actual?: string;
    expected?: string[];
    place?: {
      start?: { offset?: number };
      end?: { offset?: number };
    };
  }
}
  

declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): this;
  }

  interface NSpellDictionary {
    dic: Buffer | string;
    aff: Buffer | string;
  }

  function nspell(aff: Buffer | string | NSpellDictionary, dic?: Buffer | string): NSpell;

  export = nspell;
}