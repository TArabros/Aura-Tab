import type { AISettings, AIMessage } from '@/types';

// Local servers such as Ollama work without an API key
export function requiresApiKey(endpoint: string): boolean {
  try {
    const { hostname } = new URL(endpoint);
    return hostname !== 'localhost' && hostname !== '127.0.0.1';
  } catch {
    return true;
  }
}

export async function streamAIResponse(
  messages: AIMessage[],
  settings: AISettings,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!settings.apiKey && requiresApiKey(settings.apiEndpoint)) {
    onError('API key is not configured. Open AI Settings in this panel to set it up.');
    return;
  }

  const apiMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (settings.systemPrompt) {
    apiMessages.unshift({ role: 'system', content: settings.systemPrompt });
  }

  try {
    const response = await fetch(settings.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: apiMessages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      onError(errorMessage);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Failed to read response stream');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }
    onDone();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onDone();
      return;
    }
    onError(err instanceof Error ? err.message : 'Unknown error occurred');
  }
}
