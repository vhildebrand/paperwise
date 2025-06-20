/// <reference lib="webworker" />
// 1. Import the factory function with a clear, unambiguous name.
import NSpellFactory from 'nspell';

// 2. Infer the instance type from the factory function's return value.
//    This correctly resolves to the `NSpell` interface from your .d.ts file.
type NSpellInstance = ReturnType<typeof NSpellFactory>;

let nspellInstance: NSpellInstance | null = null;
let initializationPromise: Promise<void> | null = null;

const initializeNSpell = (): Promise<void> => {
    if (!initializationPromise) {
        initializationPromise = new Promise(async (resolve, reject) => {
            try {
                const [aff, dic] = await Promise.all([
                    fetch('/en_US.aff').then(res => res.text()),
                    fetch('/en_US.dic').then(res => res.text())
                ]);

                // 3. Call it as a function (not a constructor) to create the instance.
                nspellInstance = NSpellFactory(aff, dic);

                postMessage({ type: 'INIT_COMPLETE' });
                resolve();
            } catch (error) {
                console.error('Error initializing nspell:', error);
                postMessage({ type: 'INIT_ERROR', error });
                reject(error);
            }
        });
    }
    return initializationPromise;
};

self.onmessage = async (event: MessageEvent<{ text: string }>) => {
    try {
        await initializeNSpell();

        if (!nspellInstance) {
            throw new Error('NSpell instance not available after initialization.');
        }

        const { text } = event.data;
        const words = text.match(/\b[a-zA-Z']+\b/g) || [];
        const misspellings = new Set<string>();

        for (const word of words) {
            if (!nspellInstance.correct(word)) {
                misspellings.add(word);
            }
        }

        const results = Array.from(misspellings).map(word => ({
            word,
            suggestions: nspellInstance!.suggest(word)
        }));

        postMessage({ type: 'SPELL_RESULT', results });

    } catch (error) {
        console.error('Error during spell check:', error);
        postMessage({ type: 'PROCESS_ERROR', error: error instanceof Error ? error.message : String(error) });
    }
};