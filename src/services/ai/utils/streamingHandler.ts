import type { StreamChunk } from '../interfaces/AIProvider';

/**
 * Convert async iterable to Server-Sent Events format
 */
export async function* streamToSSE(
  stream: AsyncIterable<StreamChunk>
): AsyncIterable<string> {
  for await (const chunk of stream) {
    if (chunk.done) {
      yield `data: [DONE]\n\n`;
      break;
    }
    
    // Format as Server-Sent Events
    const data = JSON.stringify({ content: chunk.content, done: chunk.done });
    yield `data: ${data}\n\n`;
  }
}

/**
 * Convert async iterable to readable stream for Express response
 * Note: This is a simplified version - streaming is handled via SSE format
 */
export async function* streamToResponse(
  stream: AsyncIterable<StreamChunk>
): AsyncIterable<string> {
  yield* streamToSSE(stream);
}
