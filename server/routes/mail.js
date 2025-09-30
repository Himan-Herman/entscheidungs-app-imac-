import express from 'express';
import { ServerClient } from 'postmark';

const router = express.Router();
const client = new ServerClient(process.env.POSTMARK_API_TOKEN);

router.post('/send-test', async (req, res) => {
  try {
    const r = await client.sendEmail({
      From: 'no-reply@medscout.app',
      To: 'DEINE_TESTMAIL@…',        // z.B. deine Gmail
      Subject: 'MedScout Test',
      TextBody: 'Hallo vom Postmark API-Client!',
      MessageStream: 'outbound'      // Standard-Transactional
    });
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
