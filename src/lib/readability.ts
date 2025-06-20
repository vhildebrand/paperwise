/**
 * Readability calculation utilities
 */

export interface ReadabilityScores {
  fleschKincaid: number;
  fleschReadingEase: number;
  gunningFog: number;
  colemanLiau: number;
}

/**
 * Calculate Flesch-Kincaid Grade Level
 * Formula: 0.39 × (total words ÷ total sentences) + 11.8 × (total syllables ÷ total words) - 15.59
 */
export function calculateFleschKincaid(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const syllables = countSyllables(text);

  if (sentences === 0 || words === 0) return 0;

  const score = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate Flesch Reading Ease
 * Formula: 206.835 - 1.015 × (total words ÷ total sentences) - 84.6 × (total syllables ÷ total words)
 */
export function calculateFleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const syllables = countSyllables(text);

  if (sentences === 0 || words === 0) return 0;

  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate Gunning Fog Index
 * Formula: 0.4 × [(words ÷ sentences) + 100 × (complex words ÷ words)]
 */
export function calculateGunningFog(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const complexWords = countComplexWords(text);

  if (sentences === 0 || words === 0) return 0;

  const score = 0.4 * ((words / sentences) + 100 * (complexWords / words));
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate Coleman-Liau Index
 * Formula: 0.0588 × L - 0.296 × S - 15.8
 * Where L = average number of letters per 100 words, S = average number of sentences per 100 words
 */
export function calculateColemanLiau(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const letters = text.replace(/\s+/g, '').length;

  if (sentences === 0 || words === 0) return 0;

  const L = (letters / words) * 100;
  const S = (sentences / words) * 100;

  const score = 0.0588 * L - 0.296 * S - 15.8;
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate all readability scores
 */
export function calculateReadabilityScores(text: string): ReadabilityScores {
  return {
    fleschKincaid: calculateFleschKincaid(text),
    fleschReadingEase: calculateFleschReadingEase(text),
    gunningFog: calculateGunningFog(text),
    colemanLiau: calculateColemanLiau(text)
  };
}

/**
 * Count syllables in text (simplified algorithm)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  let totalSyllables = 0;

  for (const word of words) {
    totalSyllables += countWordSyllables(word);
  }

  return totalSyllables;
}

/**
 * Count syllables in a single word
 */
function countWordSyllables(word: string): number {
  // Remove non-alphabetic characters
  word = word.replace(/[^a-z]/g, '');
  
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g) || [];
  let syllables = vowelGroups.length;

  // Adjust for common patterns
  if (word.endsWith('e') && syllables > 1) {
    syllables--;
  }

  // Ensure at least 1 syllable
  return Math.max(1, syllables);
}

/**
 * Count complex words (words with 3+ syllables)
 */
function countComplexWords(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  let complexWords = 0;

  for (const word of words) {
    if (countWordSyllables(word) >= 3) {
      complexWords++;
    }
  }

  return complexWords;
}

/**
 * Get readability level description for Flesch-Kincaid score
 */
export function getReadabilityLevel(score: number): { level: string; description: string; color: string } {
  if (score <= 6) {
    return { level: 'Elementary', description: 'Very easy to read', color: 'text-green-600' };
  } else if (score <= 8) {
    return { level: 'Middle School', description: 'Easy to read', color: 'text-blue-600' };
  } else if (score <= 10) {
    return { level: 'High School', description: 'Moderately easy', color: 'text-yellow-600' };
  } else if (score <= 12) {
    return { level: 'College', description: 'Moderately difficult', color: 'text-orange-600' };
  } else if (score <= 16) {
    return { level: 'University', description: 'Difficult', color: 'text-red-600' };
  } else {
    return { level: 'Graduate', description: 'Very difficult', color: 'text-purple-600' };
  }
} 