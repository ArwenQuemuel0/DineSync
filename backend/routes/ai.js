const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL =
  process.env.OPENAI_MODEL ||
  'gpt-4o-mini';

// =========================
// HELPER: COMPUTE AVAILABLE QUANTITY
// Same idea as menu.js
// =========================

const computeAvailableQuantity =
  async (menuItem) => {
    const {
      data: recipeRows,
      error: recipeError,
    } = await supabase
      .from('menu_item_ingredients')
      .select('*')
      .eq(
        'menu_item_id',
        menuItem.id
      );

    if (
      recipeError ||
      !recipeRows ||
      recipeRows.length === 0
    ) {
      return {
        ...menuItem,
        available_quantity: null,
        is_available:
          menuItem.is_available !== false,
      };
    }

    let maxServings = Infinity;

    for (const recipe of recipeRows) {
      const ingredientId =
        recipe.ingredient_id;

      const quantityRequired =
        Number(
          recipe.quantity_required
        );

      if (
        !Number.isFinite(
          quantityRequired
        ) ||
        quantityRequired <= 0
      ) {
        maxServings = 0;
        break;
      }

      const {
        data: ingredientRow,
        error: ingredientError,
      } = await supabase
        .from('ingredients')
        .select('id, name, current_stock')
        .eq('id', ingredientId)
        .single();

      if (
        ingredientError ||
        !ingredientRow
      ) {
        maxServings = 0;
        break;
      }

      const currentStock =
        Number(
          ingredientRow.current_stock
        );

      if (
        !Number.isFinite(
          currentStock
        ) ||
        currentStock <= 0
      ) {
        maxServings = 0;
        break;
      }

      const possibleServings =
        Math.floor(
          currentStock /
            quantityRequired
        );

      if (
        possibleServings <
        maxServings
      ) {
        maxServings =
          possibleServings;
      }
    }

    if (
      !Number.isFinite(
        maxServings
      )
    ) {
      maxServings = 0;
    }

    const manuallyAvailable =
      menuItem.is_available !== false &&
      menuItem.is_available !== 0 &&
      menuItem.is_available !== 'false' &&
      menuItem.is_available !== '0';

    return {
      ...menuItem,
      available_quantity:
        maxServings,
      is_available:
        manuallyAvailable &&
        maxServings > 0,
    };
  };

// =========================
// HELPER: FETCH AVAILABLE MENU ITEMS
// =========================

const getAvailableMenuItems =
  async () => {
    const {
      data: menuItems,
      error,
    } = await supabase
      .from('menu_items')
      .select('*')
      .order('id', {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const enrichedItems =
      await Promise.all(
        (menuItems || []).map(
          async (item) =>
            await computeAvailableQuantity(
              item
            )
        )
      );

    return enrichedItems.filter(
      (item) =>
        item.is_available === true
    );
  };

// =========================
// AI DISH RECOMMENDATIONS
// POST /api/ai/recommend-dishes
// Recommended route for mobile
// =========================

router.post(
  '/recommend-dishes',
  async (req, res) => {
    try {
      const {
        selected_item,
        cart_items = [],
      } = req.body;

      if (
        !selected_item &&
        cart_items.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Selected item or cart items are required.',
        });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({
          success: false,
          message:
            'OPENAI_API_KEY is missing in backend .env.',
        });
      }

      if (
        !isConfigured ||
        !supabase
      ) {
        return res.status(500).json({
          success: false,
          message:
            'Supabase is not configured.',
        });
      }

      const availableMenuItems =
        await getAvailableMenuItems();

      const selectedId =
        Number(
          selected_item?.id ||
            selected_item?.menu_item_id
        );

      const cartIds =
        cart_items.map((item) =>
          Number(
            item.id ||
              item.menu_item_id
          )
        );

      const candidateItems =
        availableMenuItems.filter(
          (item) => {
            const itemId =
              Number(item.id);

            return (
              itemId !== selectedId &&
              !cartIds.includes(itemId)
            );
          }
        );

      if (
        candidateItems.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
          message:
            'No available menu items to recommend.',
        });
      }

      const simplifiedCandidates =
        candidateItems.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description:
            item.description || '',
          price: item.price,
        }));

      const simplifiedCart =
        cart_items.map((item) => ({
          id:
            item.id ||
            item.menu_item_id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
        }));

      const prompt = `
You are an AI food pairing assistant for Chef Oppa Korean Restaurant.

The restaurant uses custom menu categories such as:
- Authentic Ala Carte Meals
- Jeon Series
- Tteokbokki Series
- Dishes

Do not rely only on category names.
Infer good pairings based on dish name, category, description, and Korean food pairing logic.

Selected item:
${JSON.stringify(selected_item, null, 2)}

Current cart:
${JSON.stringify(simplifiedCart, null, 2)}

Available menu items:
${JSON.stringify(simplifiedCandidates, null, 2)}

Rules:
1. Recommend exactly 3 items if possible.
2. Only recommend items from the available menu items list.
3. Do not recommend the selected item.
4. Do not recommend items already in the cart.
5. Reasons must be short, simple, and customer-friendly.
6. Return valid JSON only. No markdown.

Return format:
{
  "recommendations": [
    {
      "id": 1,
      "name": "Dish Name",
      "reason": "Short reason why it pairs well."
    }
  ]
}
`;

      const completion =
        await client.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a restaurant food pairing AI. Return valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        });

      const rawReply =
        completion.choices?.[0]
          ?.message?.content || '';

      let parsed;

      try {
        parsed =
          JSON.parse(rawReply);
      } catch (parseError) {
        console.log(
          'AI RAW REPLY:',
          rawReply
        );

        return res.status(500).json({
          success: false,
          message:
            'AI returned invalid JSON.',
        });
      }

      const recommendations =
        parsed.recommendations || [];

      const enrichedRecommendations =
        recommendations
          .map((rec) => {
            const matchedItem =
              availableMenuItems.find(
                (item) =>
                  Number(item.id) ===
                  Number(rec.id)
              );

            if (!matchedItem) {
              return null;
            }

            return {
              ...matchedItem,
              reason:
                rec.reason ||
                'Pairs well with your selected dish.',
            };
          })
          .filter(Boolean)
          .slice(0, 3);

      return res.json({
        success: true,
        data: enrichedRecommendations,
      });
    } catch (error) {
      console.log(
        'AI RECOMMEND DISHES ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to get dish recommendations.',
      });
    }
  }
);

// =========================
// OLD FOOD PAIRING ROUTE
// POST /api/ai/pairing
// Kept for compatibility with old mobile code
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
        await client.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: 'system',
              content: `
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
          max_completion_tokens: 80,
        });

      const rawReply =
        completion.choices?.[0]
          ?.message?.content || '';

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
        'AI PAIRING ERROR:',
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