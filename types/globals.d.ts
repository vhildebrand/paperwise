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

declare module 'citation-js' {
  interface CitationFormatOptions {
    format?: 'text' | 'html' | 'json';
    template?: 'apa' | 'vancouver' | 'harvard' | 'mla' | 'chicago' | string;
    lang?: string;
    type?: 'string' | 'html' | 'json';
  }

  interface CitationData {
    id?: string;
    type?: string;
    title?: string;
    author?: Array<{
      family?: string;
      given?: string;
      literal?: string;
    }>;
    'container-title'?: string;
    volume?: string;
    issue?: string;
    page?: string;
    'page-first'?: string;
    issued?: {
      'date-parts'?: number[][];
    };
    accessed?: {
      'date-parts'?: number[][];
    };
    DOI?: string;
    URL?: string;
    publisher?: string;
    'publisher-place'?: string;
    [key: string]: any;
  }

  class Cite {
    constructor(input?: string | CitationData | CitationData[]);
    
    format(type: 'citation' | 'bibliography', options?: CitationFormatOptions): string;
    format(type: 'string', options?: CitationFormatOptions): string;
    format(type: 'html', options?: CitationFormatOptions): string;
    format(type: 'json', options?: CitationFormatOptions): string;
    
    get(): CitationData[];
    add(input: string | CitationData | CitationData[]): this;
    set(input: string | CitationData | CitationData[]): this;
    reset(): this;
    
    // Utility methods
    static parse(input: string, type?: string): CitationData[];
    static parseAsync(input: string, type?: string): Promise<CitationData[]>;
  }

  export = Cite;
}


