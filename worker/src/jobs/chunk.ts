export interface ChunkOptions {
  maxLength?: number;
  overlap?: number;
  preserveSentences?: boolean;
  minChunkLength?: number;
}

export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  wordCount: number;
  sentenceCount: number;
}

export function chunk(text: string, documentId: string, options: ChunkOptions = {}): TextChunk[] {
  const {
    maxLength = 800,
    overlap = 100,
    preserveSentences = true,
    minChunkLength = 50
  } = options;

  if (!text || text.length < minChunkLength) {
    return [];
  }

  console.log(`Chunking document: ${documentId} (${text.length} chars, max: ${maxLength}, overlap: ${overlap})`);

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxLength, text.length);
    
    // If we're not at the end and preserveSentences is enabled, try to end at sentence boundary
    if (preserveSentences && endIndex < text.length) {
      // Look for sentence endings within the last 20% of the chunk
      const searchStart = Math.max(startIndex + Math.floor(maxLength * 0.8), startIndex + minChunkLength);
      const sentenceEnd = findSentenceEnd(text, searchStart, endIndex);
      
      if (sentenceEnd > searchStart) {
        endIndex = sentenceEnd;
      } else {
        // If no sentence boundary found, try to break at word boundary
        const wordEnd = findWordBoundary(text, endIndex);
        if (wordEnd > startIndex + minChunkLength) {
          endIndex = wordEnd;
        }
      }
    }

    const chunkText = text.slice(startIndex, endIndex).trim();
    
    if (chunkText.length >= minChunkLength) {
      const wordCount = chunkText.split(/\s+/).filter(word => word.length > 0).length;
      const sentenceCount = (chunkText.match(/[.!?]+/g) || []).length;

      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        text: chunkText,
        startIndex,
        endIndex,
        wordCount,
        sentenceCount
      });

      chunkIndex++;
    }

    // Calculate next start position with overlap
    const nextStart = Math.max(endIndex - overlap, startIndex + 1);
    
    // Prevent infinite loop
    if (nextStart <= startIndex) {
      break;
    }
    
    startIndex = nextStart;
  }

  console.log(`Created ${chunks.length} chunks from document: ${documentId}`);
  
  return chunks;
}

// Helper function to find sentence ending
function findSentenceEnd(text: string, start: number, end: number): number {
  const sentenceEnders = /[.!?]+\s/g;
  let match;
  let lastEnd = -1;

  sentenceEnders.lastIndex = start;
  
  while ((match = sentenceEnders.exec(text)) !== null && match.index < end) {
    lastEnd = match.index + match[0].length;
  }

  return lastEnd > start ? lastEnd : -1;
}

// Helper function to find word boundary
function findWordBoundary(text: string, position: number): number {
  // Look backwards for a space
  for (let i = position; i >= Math.max(0, position - 50); i--) {
    if (/\s/.test(text[i])) {
      return i;
    }
  }
  return position;
}

// Smart chunking for different content types
export function smartChunk(
  text: string, 
  documentId: string, 
  contentType: 'article' | 'documentation' | 'code' | 'general' = 'general',
  options: ChunkOptions = {}
): TextChunk[] {
  const baseOptions = { ...options };

  // Adjust parameters based on content type
  switch (contentType) {
    case 'article':
      baseOptions.maxLength = 1000;
      baseOptions.overlap = 150;
      baseOptions.preserveSentences = true;
      break;
    case 'documentation':
      baseOptions.maxLength = 600;
      baseOptions.overlap = 100;
      baseOptions.preserveSentences = true;
      break;
    case 'code':
      baseOptions.maxLength = 500;
      baseOptions.overlap = 50;
      baseOptions.preserveSentences = false;
      break;
    default:
      baseOptions.maxLength = 800;
      baseOptions.overlap = 100;
      baseOptions.preserveSentences = true;
  }

  return chunk(text, documentId, baseOptions);
}
