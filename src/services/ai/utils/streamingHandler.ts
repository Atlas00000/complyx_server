import type { StreamChunk } from '../interfaces/AIProvider';

/**
 * Enhanced Streaming Handler
 * Supports token-level streaming, cancellation, and progress tracking
 */

export interface StreamProgress {
  tokensReceived: number;
  bytesReceived: number;
  startTime: number;
  lastUpdateTime: number;
  estimatedCompletion?: number;
}

export interface StreamController {
  cancel: () => void;
  isCancelled: () => boolean;
  getProgress: () => StreamProgress;
}

/**
 * Convert async iterable to Server-Sent Events format with token-level updates
 */
export async function* streamToSSE(
  stream: AsyncIterable<StreamChunk>,
  controller?: StreamController
): AsyncIterable<string> {
  const progress: StreamProgress = {
    tokensReceived: 0,
    bytesReceived: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  };

  try {
    for await (const chunk of stream) {
      // Check for cancellation
      if (controller?.isCancelled()) {
        yield `data: ${JSON.stringify({ content: '', done: true, cancelled: true })}\n\n`;
        break;
      }

      if (chunk.done) {
        yield `data: ${JSON.stringify({ content: '', done: true, cancelled: false })}\n\n`;
        break;
      }

      // Update progress tracking
      if (chunk.content) {
        progress.tokensReceived += estimateTokenCount(chunk.content);
        progress.bytesReceived += Buffer.byteLength(chunk.content, 'utf8');
        progress.lastUpdateTime = Date.now();

        // Update controller progress if available
        if (controller) {
          (controller as any).progress = progress;
        }
      }

      // Format as Server-Sent Events with progress
      const data = JSON.stringify({
        content: chunk.content,
        done: chunk.done,
        progress: {
          tokens: progress.tokensReceived,
          bytes: progress.bytesReceived,
          elapsed: progress.lastUpdateTime - progress.startTime,
        },
      });
      
      yield `data: ${data}\n\n`;
    }
  } catch (error) {
    // Handle stream errors
    const errorData = JSON.stringify({
      content: '',
      done: true,
      error: error instanceof Error ? error.message : 'Stream error',
    });
    yield `data: ${errorData}\n\n`;
  }
}

/**
 * Estimate token count (simple heuristic: ~4 characters per token)
 * This is a rough estimate - actual tokenization varies by model
 */
function estimateTokenCount(text: string): number {
  // Simple heuristic: approximately 4 characters per token
  // For more accuracy, use a tokenizer library
  return Math.ceil(text.length / 4);
}

/**
 * Create a stream controller for cancellation
 */
export function createStreamController(): StreamController {
  let cancelled = false;
  let progress: StreamProgress = {
    tokensReceived: 0,
    bytesReceived: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  };

  return {
    cancel: () => {
      cancelled = true;
    },
    isCancelled: () => cancelled,
    getProgress: () => ({ ...progress }),
  };
}

/**
 * Token-level streaming wrapper
 * Processes stream chunks at token level for fine-grained control
 */
export async function* tokenLevelStream(
  stream: AsyncIterable<StreamChunk>,
  options: {
    bufferTokens?: number; // Buffer N tokens before yielding (default: 1)
    onToken?: (token: string) => void; // Callback for each token
    onProgress?: (progress: StreamProgress) => void; // Progress callback
    controller?: StreamController; // Cancellation controller
  } = {}
): AsyncIterable<StreamChunk> {
  const {
    bufferTokens = 1,
    onToken,
    onProgress,
    controller,
  } = options;

  const progress: StreamProgress = {
    tokensReceived: 0,
    bytesReceived: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  };

  let tokenBuffer: string[] = [];
  let tokenCount = 0;

  try {
    for await (const chunk of stream) {
      // Check for cancellation
      if (controller?.isCancelled()) {
        yield { content: '', done: true };
        break;
      }

      if (chunk.done) {
        // Yield remaining buffered tokens
        if (tokenBuffer.length > 0) {
          yield { content: tokenBuffer.join(''), done: false };
          tokenBuffer = [];
        }
        yield { content: '', done: true };
        break;
      }

      if (chunk.content) {
        // Split content into tokens (simplified - splits by whitespace and punctuation)
        const tokens = tokenizeContent(chunk.content);

        for (const token of tokens) {
          tokenBuffer.push(token);
          tokenCount++;

          // Call token callback if provided
          if (onToken) {
            onToken(token);
          }

          // Update progress
          progress.tokensReceived++;
          progress.bytesReceived += Buffer.byteLength(token, 'utf8');
          progress.lastUpdateTime = Date.now();

          // Call progress callback if provided
          if (onProgress) {
            onProgress({ ...progress });
          }

          // Yield when buffer is full
          if (tokenBuffer.length >= bufferTokens) {
            yield { content: tokenBuffer.join(''), done: false };
            tokenBuffer = [];
          }
        }
      }
    }
  } catch (error) {
    // Yield remaining buffer on error
    if (tokenBuffer.length > 0) {
      yield { content: tokenBuffer.join(''), done: false };
    }
    throw error;
  }
}

/**
 * Simple tokenization (splits by whitespace and preserves punctuation)
 * For production, use a proper tokenizer library
 */
function tokenizeContent(content: string): string[] {
  // Simple tokenization: split by whitespace and punctuation boundaries
  // This is a simplified version - actual tokenization is more complex
  const tokens: string[] = [];
  let currentToken = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (/\s/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
    } else if (/[.,!?;:]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
    } else {
      currentToken += char;
    }
  }

  if (currentToken) {
    tokens.push(currentToken);
  }

  return tokens;
}

/**
 * Convert async iterable to readable stream for Express response
 * Enhanced version with token-level streaming and cancellation
 */
export async function* streamToResponse(
  stream: AsyncIterable<StreamChunk>,
  controller?: StreamController
): AsyncIterable<string> {
  yield* streamToSSE(stream, controller);
}

/**
 * Create a cancellable stream wrapper
 */
export function withCancellation<T>(
  stream: AsyncIterable<T>,
  controller: StreamController
): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for await (const item of stream) {
        if (controller.isCancelled()) {
          break;
        }
        yield item;
      }
    },
  };
}
