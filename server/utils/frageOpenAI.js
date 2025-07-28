// server/utils/frageOpenAI.js

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemMessage = {
    role: "system",
    content: `Du bist ein professioneller medizinischer Assistent. Deine Aufgabe ist es, anhand der Symptome des Nutzers gezielte, empathische Rückfragen zu stellen.
  
  ⚠️ Stelle **maximal 2 kurze Rückfragen auf einmal**. Stelle **nicht mehrere Fragen in einem Satz**. Nutze klare, einfache Sprache.
  
  Sprich den Nutzer direkt an. Beispiel:
  "Seit wann haben Sie die Schmerzen?"
  "Wo genau spüren Sie den Schmerz – eher links oder rechts?"
  
  Führe das Gespräch Schritt für Schritt. Erst wenn du ausreichend Informationen hast, gibst du eine Empfehlung für den passenden Facharzt (z. B. Gastroenterologie, Neurologie etc.).
  
  Vermeide medizinische Fachbegriffe. Sei freundlich, ruhig und professionell.`
  };
  
  

  export async function frageOpenAI(verlauf) {
    const messages = [
      systemMessage, // korrekt referenziert
      ...verlauf,
    ];
  
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.4,
    });
  
    return response.choices[0].message.content;
  }
  

