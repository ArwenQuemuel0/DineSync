const express = require('express');

const router = express.Router();

const OpenAI = require('openai');

const client = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

const MODEL =
  process.env.OPENAI_MODEL ||
  'gpt-5.4-nano';

// =========================
// FOOD PAIRING AI
// =========================

router.post(
  '/pairing',
  async (req, res) => {
    try {
      const { itemName } =
        req.body;

      if (!itemName) {
        return res.status(400).json({
          success: false,

          message:
            'itemName is required',
        });
      }

      const completion =
        await client.chat.completions.create(
          {
            model: MODEL,

            messages: [
              {
                role: 'system',

                content:
                  `
You are a Korean restaurant food recommendation AI.

Recommend exactly 3 menu pairings for the selected food.

Rules:
- Short responses only
- Return only food names
- No numbering
- No explanations
- Separate each item with commas
                  `,
              },

              {
                role: 'user',

                content:
                  `Recommend food pairings for ${itemName}`,
              },
            ],

            temperature: 0.7,

            max_tokens: 60,
          }
        );

      const rawReply =
        completion.choices?.[0]
          ?.message?.content ||
        '';

      const recommendations =
        rawReply
          .split(',')
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      return res.json({
        success: true,

        recommendations,
      });
    } catch (error) {
      console.log(
        'AI ERROR:',
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message,
      });
    }
  }
);

module.exports = router;