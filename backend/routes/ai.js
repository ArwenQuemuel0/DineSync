const express = require('express');
const OpenAI = require('openai');

const router = express.Router();

const {
  supabase,
  isConfigured,
} = require('../supabaseClient');

const {
  computeMaxServingsFromRecipes,
  enrichMenuItemInventory,
} = require('../utils/inventoryServings');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL =
  process.env.OPENAI_MODEL ||
  'gpt-4o-mini';

// =========================
// HELPER: NORMALIZE FLAVOR TAGS
// =========================

const normalizeFlavorTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

// =========================
// HELPER: NORMALIZE MEAL TYPE
// =========================

const normalizeMealType = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim();
};

// =========================
// HELPER: NORMALIZE MENU ITEM
// =========================

const normalizeMenuItem = (item) => {
  return {
    ...item,

    flavor_tags: normalizeFlavorTags(
      item?.flavor_tags
    ),

    meal_type: normalizeMealType(
      item?.meal_type
    ),
  };
};

// =========================
// HELPER: COMPUTE AVAILABLE QUANTITY
// Same idea as menu.js
// =========================

const computeAvailableQuantity =
  async (menuItem) => {
    const maxOrderQuantity =
      await computeMaxServingsFromRecipes(
        supabase,
        menuItem.id
      );

    if (maxOrderQuantity <= 0) {
      return normalizeMenuItem({
        ...menuItem,
        available_quantity: 0,
        max_order_quantity: 0,
        stock_label:
          menuItem.stock_label ||
          'Out of stock',
        is_available: false,
      });
    }

    return normalizeMenuItem({
      ...menuItem,
      ...enrichMenuItemInventory(
        menuItem,
        maxOrderQuantity
      ),
    });
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

      const normalizedSelectedItem =
        selected_item
          ? normalizeMenuItem(selected_item)
          : null;

      const normalizedCartItems =
        cart_items.map(normalizeMenuItem);

      const availableMenuItems =
        await getAvailableMenuItems();

      const selectedId =
        Number(
          normalizedSelectedItem?.id ||
            normalizedSelectedItem?.menu_item_id
        );

      const cartIds =
        normalizedCartItems.map((item) =>
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
          image: item.image || null,
          image_url: item.image_url || item.image || null,
          is_available: item.is_available,
          available_quantity:
            item.available_quantity,
          flavor_tags:
            normalizeFlavorTags(
              item.flavor_tags
            ),
          meal_type:
            normalizeMealType(
              item.meal_type
            ),
        }));

      const simplifiedCart =
        normalizedCartItems.map((item) => ({
          id:
            item.id ||
            item.menu_item_id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          flavor_tags:
            normalizeFlavorTags(
              item.flavor_tags
            ),
          meal_type:
            normalizeMealType(
              item.meal_type
            ),
        }));

      const prompt = `
You are an AI food pairing assistant for Chef Oppa Korean Restaurant.

Use flavor_tags and meal_type as the main basis for pairing dishes.
Also consider dish name, category, description, and Korean food pairing logic.

Allowed flavor tags:
spicy, sweet, savory, mild, sour, creamy, refreshing, salty, crispy, cheesy, rich, smoky, umami, tangy, fried, grilled, seafood, meaty, broth, fermented

Allowed meal types:
set, main, side, drink, dessert, snack, soup, hotpot, noodle, sushi, salad, extra, alcohol

Selected item:
${JSON.stringify(normalizedSelectedItem, null, 2)}

Current cart:
${JSON.stringify(simplifiedCart, null, 2)}

Available menu items:
${JSON.stringify(simplifiedCandidates, null, 2)}

Pairing guide:
- main pairs well with drink, side, soup, salad, or dessert.
- noodle pairs well with drink, side, or snack.
- hotpot pairs well with side, drink, or noodle.
- sushi pairs well with soup, drink, salad, or side.
- snack pairs well with drink, main, or noodle.
- soup pairs well with main, side, or sushi.
- spicy food pairs well with refreshing, sweet, mild, or creamy items.
- savory or meaty food pairs well with refreshing drinks, side dishes, salad, or soup.
- fried or crispy food pairs well with refreshing drinks, mild sides, or tangy items.
- cheesy or creamy food pairs well with spicy, refreshing, or savory items.
- seafood items pair well with mild, refreshing, tangy, soup, salad, or sushi items.
- Avoid recommending too many items with the same meal_type as the selected item unless it makes sense.
- Do not recommend alcohol unless the selected item or cart already includes alcohol.

Rules:
1. Recommend exactly 3 items if possible.
2. Only recommend items from the available menu items list.
3. Do not recommend the selected item.
4. Do not recommend items already in the cart.
5. Do not recommend unavailable items.
6. Use flavor_tags and meal_type in your pairing decision.
7. Reasons must be short, simple, and customer-friendly.
8. Return valid JSON only. No markdown.

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
          temperature: 0.6,
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
              flavor_tags:
                normalizeFlavorTags(
                  matchedItem.flavor_tags
                ),
              meal_type:
                normalizeMealType(
                  matchedItem.meal_type
                ),
              image_url:
                matchedItem.image_url ||
                matchedItem.image ||
                null,
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