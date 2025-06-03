import fetch from 'node-fetch';

export async function frageQwen(verlauf) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen:4b',
      stream: false,
      prompt: verlauf.map(v => `${v.role === 'user' ? 'User' : 'Assistant'}: ${v.content}`).join('\n') + '\nAssistant:',
    })
  });

  const result = await response.json();
  return result.response || '[Fehler bei der Antwort]';
}
