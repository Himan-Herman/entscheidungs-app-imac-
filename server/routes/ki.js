import express from 'express';
import { frageQwen } from '../qwenClient.js';

const router = express.Router();

// Rückfragen-Logik mit erweiterten Schlüsselwörtern
const rueckfragenLogik = {
  kopfschmerzen: {
    schlüsselwörter: [
      'kopfschmerzen',
      'kopfweh',
      'mein kopf tut weh',
      'kopf tut weh',
      'druck im kopf',
      'schmerz im kopf',
      'seit gestern kopfschmerzen',
      'kopf schmerzt'
    ],
    fragen: [
      'Seit wann bestehen die Kopfschmerzen?',
      'Wie stark sind sie auf einer Skala von 1–10?',
      'Gibt es Begleitsymptome wie Übelkeit, Sehstörungen oder Lichtempfindlichkeit?'
    ]
  },
  bauchschmerzen: {
    schlüsselwörter: [
      'bauchschmerzen',
      'schmerzen im bauch',
      'mein bauch tut weh',
      'bauch tut weh',
      'magenprobleme',
      'bauchweh'
    ],
    fragen: [
      'Wo genau im Bauch spüren Sie den Schmerz?',
      'Treten die Schmerzen nach dem Essen auf?',
      'Gibt es Fieber, Durchfall oder Übelkeit?'
    ]
  }
  // 👉 Du kannst weitere Symptome leicht ergänzen
};

router.post('/', async (req, res) => {
  const { verlauf } = req.body;

  if (!verlauf || !Array.isArray(verlauf)) {
    return res.status(400).json({ error: 'Verlauf fehlt oder ist ungültig' });
  }

  try {
    const letzteFrage = verlauf[verlauf.length - 1]?.content?.toLowerCase() || '';
    let antwort = '';

    const symptom = Object.entries(rueckfragenLogik).find(([_, value]) =>
      value.schlüsselwörter.some(wort => letzteFrage.includes(wort))
    );

    if (symptom) {
      const fragen = symptom[1].fragen;
      antwort = fragen.join('\n');
    } else {
      antwort = await frageQwen(verlauf);
    }

    res.json({ antwort });
  } catch (error) {
    console.error('KI-Fehler:', error);
    res.status(500).json({ error: 'KI-Antwort fehlgeschlagen' });
  }
});

export default router;
