// server/utils/frageOpenAI.js

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
Du bist ein medizinischer KI-Assistent. Du hilfst dem Nutzer dabei, seine Symptome zu beschreiben.
🔸 Stelle pro Antwort **nur eine gezielte Rückfrage**, z. B. zum Ort, zur Dauer, zur Stärke.
🔸 Stelle keine Diagnosen.
🔸 Erst wenn du genug weißt, gibst du eine Empfehlung, zu welchem Facharzt man gehen sollte.
Beispiel für Empfehlungen: Hausarzt, Dermatologe, Neurologe, Orthopäde usw.
`;

export async function frageOpenAI(verlauf) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...verlauf,
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.4,
  });

  return response.choices[0].message.content;
}
