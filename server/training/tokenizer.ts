/**
 * Persian Text Tokenizer
 * Handles Persian text tokenization for BERT models
 */

export class PersianTokenizer {
  private vocab: Map<string, number>;
  private reverseVocab: Map<number, string>;
  private maxLength: number;
  
  // Special tokens
  private readonly CLS_TOKEN = '[CLS]';
  private readonly SEP_TOKEN = '[SEP]';
  private readonly PAD_TOKEN = '[PAD]';
  private readonly UNK_TOKEN = '[UNK]';
  private readonly MASK_TOKEN = '[MASK]';
  
  constructor(maxLength: number = 512) {
    this.maxLength = maxLength;
    this.vocab = new Map();
    this.reverseVocab = new Map();
    this.initializeVocab();
  }
  
  /**
   * Initialize vocabulary with Persian characters and common tokens
   */
  private initializeVocab(): void {
    // Special tokens
    this.addToken(this.PAD_TOKEN, 0);
    this.addToken(this.UNK_TOKEN, 1);
    this.addToken(this.CLS_TOKEN, 2);
    this.addToken(this.SEP_TOKEN, 3);
    this.addToken(this.MASK_TOKEN, 4);
    
    // Persian alphabet
    const persianChars = 'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی';
    let tokenId = 5;
    
    // Add Persian characters
    for (const char of persianChars) {
      this.addToken(char, tokenId++);
    }
    
    // Add Arabic numerals
    for (let i = 0; i <= 9; i++) {
      this.addToken(i.toString(), tokenId++);
    }
    
    // Add Persian numerals
    const persianNumerals = '۰۱۲۳۴۵۶۷۸۹';
    for (const num of persianNumerals) {
      this.addToken(num, tokenId++);
    }
    
    // Common Persian words (simplified vocabulary)
    const commonWords = [
      'و', 'در', 'به', 'از', 'که', 'این', 'با', 'را', 'برای', 'است',
      'یک', 'آن', 'هم', 'می', 'یا', 'اما', 'اگر', 'بر', 'تا', 'هر',
      'قانون', 'ماده', 'حکم', 'دادگاه', 'قاضی', 'وکیل', 'حق', 'جرم',
      'مجازات', 'دعوی', 'خواهان', 'خوانده', 'رای', 'قرار', 'اجرا'
    ];
    
    for (const word of commonWords) {
      this.addToken(word, tokenId++);
    }
    
    // Add space and punctuation
    this.addToken(' ', tokenId++);
    this.addToken('.', tokenId++);
    this.addToken('،', tokenId++);
    this.addToken('؟', tokenId++);
    this.addToken('!', tokenId++);
    this.addToken('؛', tokenId++);
    this.addToken(':', tokenId++);
    this.addToken('(', tokenId++);
    this.addToken(')', tokenId++);
    this.addToken('«', tokenId++);
    this.addToken('»', tokenId++);
  }
  
  private addToken(token: string, id: number): void {
    this.vocab.set(token, id);
    this.reverseVocab.set(id, token);
  }
  
  /**
   * Tokenize Persian text
   */
  tokenize(text: string): string[] {
    // Normalize Persian text
    text = this.normalizeText(text);
    
    // Simple word-based tokenization
    const words = text.split(/\s+/);
    const tokens: string[] = [this.CLS_TOKEN];
    
    for (const word of words) {
      if (this.vocab.has(word)) {
        tokens.push(word);
      } else {
        // Character-level tokenization for unknown words
        for (const char of word) {
          if (this.vocab.has(char)) {
            tokens.push(char);
          } else {
            tokens.push(this.UNK_TOKEN);
          }
        }
      }
    }
    
    tokens.push(this.SEP_TOKEN);
    
    // Truncate if necessary
    if (tokens.length > this.maxLength) {
      tokens.length = this.maxLength - 1;
      tokens.push(this.SEP_TOKEN);
    }
    
    return tokens;
  }
  
  /**
   * Convert tokens to IDs
   */
  encode(text: string): number[] {
    const tokens = this.tokenize(text);
    const ids = tokens.map(token => this.vocab.get(token) || this.vocab.get(this.UNK_TOKEN)!);
    
    // Pad to max length
    while (ids.length < this.maxLength) {
      ids.push(this.vocab.get(this.PAD_TOKEN)!);
    }
    
    return ids.slice(0, this.maxLength);
  }
  
  /**
   * Convert IDs back to tokens
   */
  decode(ids: number[]): string {
    const tokens = ids
      .map(id => this.reverseVocab.get(id) || this.UNK_TOKEN)
      .filter(token => token !== this.PAD_TOKEN && token !== this.CLS_TOKEN && token !== this.SEP_TOKEN);
    
    return tokens.join(' ');
  }
  
  /**
   * Create attention mask
   */
  getAttentionMask(ids: number[]): number[] {
    return ids.map(id => id === this.vocab.get(this.PAD_TOKEN) ? 0 : 1);
  }
  
  /**
   * Normalize Persian text
   */
  private normalizeText(text: string): string {
    // Normalize Persian characters
    text = text
      .replace(/ك/g, 'ک')  // Arabic kaf to Persian kaf
      .replace(/ي/g, 'ی')  // Arabic yeh to Persian yeh
      .replace(/ى/g, 'ی')  // Alef maksura to Persian yeh
      .replace(/ۀ/g, 'ه')  // Heh with yeh to heh
      .replace(/ؤ/g, 'و')  // Waw with hamza to waw
      .replace(/إ/g, 'ا')  // Alef with hamza below to alef
      .replace(/أ/g, 'ا')  // Alef with hamza above to alef
      .replace(/آ/g, 'ا')  // Alef with madda to alef (simplified)
      .replace(/ء/g, '')   // Remove standalone hamza
      .replace(/\u200c/g, ' ') // Replace ZWNJ with space
      .trim();
    
    return text.toLowerCase();
  }
  
  /**
   * Get vocabulary size
   */
  getVocabSize(): number {
    return this.vocab.size;
  }
}

// Export singleton instance
export const persianTokenizer = new PersianTokenizer();