export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  /**
   * Send a chat message and get a response
   */
  chat(messages: Message[]): Promise<ChatResponse>;

  /**
   * Send a chat message and get a streaming response
   */
  streamChat(messages: Message[]): AsyncIterable<StreamChunk>;

  /**
   * Get the model name being used
   */
  getModel(): string;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Get provider name
   */
  getName(): string;
}
