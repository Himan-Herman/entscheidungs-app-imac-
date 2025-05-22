import fetch from 'node-fetch';

export async function frageOllama(prompt) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        model: 'qwen:4b',
      prompt: prompt,
      stream: false
    })
  });

  const data = await response.json();
  return data.response;
}