import 'dotenv/config';
import { crawl } from './jobs/crawl.js';
import { extract } from './jobs/extract.js';
import { chunk, smartChunk } from './jobs/chunk.js';
import { embedJob } from './jobs/embed.js';
import { upsert } from './jobs/upsert.js';
import { pullTypo3Content, pullSingleTypo3Resource, deleteTypo3Resource } from './jobs/typo3-pull.js';

export interface IngestOptions {
  collection?: string;
  contentType?: 'article' | 'documentation' | 'code' | 'general';
  enableEmbedding?: boolean;
  chunkOptions?: {
    maxLength?: number;
    overlap?: number;
    preserveSentences?: boolean;
  };
  embedOptions?: {
    batchSize?: number;
    maxRetries?: number;
  };
}

async function ingest(url: string, project: string, options: IngestOptions = {}) {
  const {
    collection = 'pages',
    contentType = 'general',
    enableEmbedding = true,
    chunkOptions = {},
    embedOptions = {}
  } = options;

  console.log(`Starting ingest pipeline for: ${url}`);
  console.log(`Project: ${project}, Collection: ${collection}, Content Type: ${contentType}`);

  try {
    // Step 1: Crawl the URL
    console.log('Step 1: Crawling...');
    const crawlResult = await crawl(url);
    
    // Step 2: Extract content
    console.log('Step 2: Extracting content...');
    const doc = await extract(crawlResult.html, crawlResult.finalUrl || url);
    
    // Step 3: Create chunks
    console.log('Step 3: Creating chunks...');
    const chunks = smartChunk(doc.content, doc.id, contentType, chunkOptions);
    
    if (chunks.length === 0) {
      console.warn('No chunks created, skipping embedding and upsert');
      return;
    }
    
    // Step 4: Generate embeddings (if enabled)
    let embeddedChunks = [];
    if (enableEmbedding) {
      console.log('Step 4: Generating embeddings...');
      embeddedChunks = await embedJob(chunks, embedOptions);
      
      if (embeddedChunks.length === 0) {
        console.warn('No embeddings generated, proceeding without vector search capability');
      }
    } else {
      console.log('Step 4: Skipping embeddings (disabled)');
      // Convert chunks to embedded format without embeddings
      embeddedChunks = chunks.map(chunk => ({
        ...chunk,
        embedding: [],
        embeddingModel: 'none',
        embeddingDimension: 0
      }));
    }
    
    // Step 5: Upsert to API
    console.log('Step 5: Upserting to API...');
    const result = await upsert(project, collection, doc, embeddedChunks, {
      upsertChunks: enableEmbedding && embeddedChunks.length > 0
    });
    
    // Report results
    console.log('\n=== Ingest Results ===');
    console.log(`Document: ${result.document.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.document.error) {
      console.log(`Document Error: ${result.document.error}`);
    }
    
    if (enableEmbedding) {
      console.log(`Chunks: ${result.chunks.successful} successful, ${result.chunks.failed} failed`);
      if (result.chunks.errors.length > 0) {
        console.log('Chunk Errors:');
        result.chunks.errors.forEach(error => {
          console.log(`  - ${error.id}: ${error.error}`);
        });
      }
    }
    
    console.log(`\nIngest completed for: ${url}`);
    
  } catch (error) {
    console.error(`\nIngest failed for ${url}:`, error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
pixelcoda Search Worker - Ingest Pipeline

Commands:
  crawl <url> [project]           Crawl and index a single URL
  typo3-pull <typo3-url> [project] Pull all content from TYPO3-Headless API
  typo3-sync <typo3-url> [project] Sync single TYPO3 resource (from webhook)

Usage:
  npm run dev -- crawl <url> [project] [options]
  npm run dev -- typo3-pull <typo3-url> [project] [options]
  npm run dev -- typo3-sync <typo3-url> <type> <id> [project]

Global Options:
  --help, -h              Show this help
  --project <name>        Project ID (default: demo)

Crawl Options:
  --collection <name>     Collection name (default: pages)
  --content-type <type>   Content type: article, documentation, code, general (default: general)
  --no-embedding         Disable embedding generation
  --batch-size <n>       Embedding batch size (default: 10)
  --max-length <n>       Max chunk length (default: 800)
  --overlap <n>          Chunk overlap (default: 100)

TYPO3 Pull Options:
  --language <lang>       Language code (default: de)
  --types <types>         Content types to pull (default: pages,news)
  --batch-size <n>       API batch size (default: 50)
  --api-key <key>        TYPO3 API key (optional)

Examples:
  # Crawl single URL
  npm run dev -- crawl https://example.com demo

  # Pull all TYPO3 content
  npm run dev -- typo3-pull https://api.example.com typo3-site --language de --types pages,news

  # Sync single TYPO3 resource (webhook trigger)
  npm run dev -- typo3-sync https://api.example.com pages 123 typo3-site
    `);
    process.exit(0);
  }

  if (command === 'typo3-pull') {
    await handleTypo3Pull(args.slice(1));
  } else if (command === 'typo3-sync') {
    await handleTypo3Sync(args.slice(1));
  } else if (command === 'crawl' || !command.startsWith('typo3')) {
    await handleCrawl(command === 'crawl' ? args.slice(1) : args);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

async function handleTypo3Pull(args: string[]) {
  const typo3Url = args[0];
  const project = args[1] || 'demo';
  
  if (!typo3Url) {
    console.error('Error: TYPO3 URL is required');
    process.exit(1);
  }

  // Parse options
  const options = {
    baseUrl: typo3Url,
    language: 'de',
    types: ['pages', 'news'],
    batchSize: 50,
    apiKey: undefined as string | undefined
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--language':
        if (next) options.language = next;
        i++;
        break;
      case '--types':
        if (next) options.types = next.split(',');
        i++;
        break;
      case '--batch-size':
        if (next && !isNaN(parseInt(next))) {
          options.batchSize = parseInt(next);
        }
        i++;
        break;
      case '--api-key':
        if (next) options.apiKey = next;
        i++;
        break;
    }
  }

  try {
    const result = await pullTypo3Content(project, options);
    console.log('\n✅ TYPO3 pull completed successfully');
    console.log(`📊 Statistics:`, result);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TYPO3 pull failed:', error);
    process.exit(1);
  }
}

async function handleTypo3Sync(args: string[]) {
  const typo3Url = args[0];
  const type = args[1];
  const id = args[2];
  const project = args[3] || 'demo';
  
  if (!typo3Url || !type || !id) {
    console.error('Error: TYPO3 URL, type, and ID are required for sync');
    process.exit(1);
  }

  const options = {
    baseUrl: typo3Url,
    language: 'de',
    apiKey: process.env.TYPO3_API_KEY
  };

  try {
    await pullSingleTypo3Resource(project, type, id, options);
    console.log('\n✅ TYPO3 sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TYPO3 sync failed:', error);
    process.exit(1);
  }
}

async function handleCrawl(args: string[]) {
  const url = args[0];
  const project = args[1] || 'demo';
  
  if (!url) {
    console.error('Error: URL is required');
    process.exit(1);
  }

  // Parse options
  const options: IngestOptions = {
    collection: 'pages',
    contentType: 'general',
    enableEmbedding: true,
    chunkOptions: {},
    embedOptions: {}
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--collection':
        if (next) options.collection = next;
        i++;
        break;
      case '--content-type':
        if (next && ['article', 'documentation', 'code', 'general'].includes(next)) {
          options.contentType = next as any;
        }
        i++;
        break;
      case '--no-embedding':
        options.enableEmbedding = false;
        break;
      case '--batch-size':
        if (next && !isNaN(parseInt(next))) {
          options.embedOptions!.batchSize = parseInt(next);
        }
        i++;
        break;
      case '--max-length':
        if (next && !isNaN(parseInt(next))) {
          options.chunkOptions!.maxLength = parseInt(next);
        }
        i++;
        break;
      case '--overlap':
        if (next && !isNaN(parseInt(next))) {
          options.chunkOptions!.overlap = parseInt(next);
        }
        i++;
        break;
    }
  }

  try {
    await ingest(url, project, options);
    console.log('\n✅ Ingest pipeline completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Ingest pipeline failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
