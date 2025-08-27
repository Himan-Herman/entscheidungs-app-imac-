import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function frageOpenAI(verlauf) {
  const systemMessage = {
    role: 'system',
    content: 'Du bist ein empathischer medizinischer KI-Assistent. Deine Aufgabe ist es, gezielte Rückfragen zu stellen, um die Symptome besser zu verstehen – ohne Diagnosen zu stellen. Sei freundlich, sachlich und hilfreich.'
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [systemMessage, ...verlauf],
    temperature: 0.4
  });
  let text = response.choices[0].message.content;

  
  text = text.replace(/\n/g, '<br/>');

  
  text = text.replace(/(Wasser trinken|viel trinken|Arzt aufsuchen|ärztlicher Rat|schonen Sie sich|Ruhe halten|Hausarzt|Kühlen|Wärme|entzündungshemmend|Beobachtung|Notaufnahme)/gi, '<strong>$1</strong>');

  return text;
}