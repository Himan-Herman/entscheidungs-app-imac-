import fetch from 'node-fetch';

export async function frageOllama(verlauf) {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen:4b',
      messages: verlauf,
      stream: false
    })
  });

  const data = await response.json();
  return data.message.content;
}
