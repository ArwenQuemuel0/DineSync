const express = require('express');
const axios = require('axios');
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
// FIXED INGREDIENT MENU SOURCE
// =========================

const WEB_MENU_URL =
  process.env.WEB_MENU_URL ||
  process.env.LARAVEL_MENU_URL ||
  'https://dinesync.shop/api/menu';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

// =========================
// BASIC HELPERS
// =========================

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeInventoryType = (value) => {
  return normalizeText(value)
    .replace(/[-\s]+/g, '_');
};

const toNumberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
};

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const isAvailableTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes' ||
    normalizeText(value) === 'available'
  );
};

const isAvailableFalse = (value) => {
  return (
    value === false ||
    value === 0 ||
    value === '0' ||
    normalizeText(value) === 'false' ||
    normalizeText(value) === 'no' ||
    normalizeText(value) === 'unavailable' ||
    normalizeText(value) === 'sold out'
  );
};

const isBestSellerTrue = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    normalizeText(value) === 'true' ||
    normalizeText(value) === 'yes'
  );
};

const isChefOppaSpecialItem = (item) => {
  const category =
    normalizeText(item?.category);

  const inventoryType =
    normalizeInventoryType(
      item?.inventory_type
    );

  const name =
    normalizeText(item?.name);

  return (
    category === 'chef oppa special' ||
    inventoryType === 'custom' ||
    name.includes(
      'custom chef oppa special'
    )
  );
};

// =========================
// FLAVOR / MEAL HELPERS
// =========================

const normalizeFlavorTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) =>
        String(tag).trim()
      )
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

const normalizeMealType = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim();
};

const getFlavorTagSet = (item) => {
  return new Set(
    normalizeFlavorTags(
      item?.flavor_tags
    ).map(normalizeText)
  );
};

const getMealType = (item) => {
  return normalizeText(
    item?.meal_type
  );
};

const getCategory = (item) => {
  return normalizeText(
    item?.category
  );
};

// =========================
// INGREDIENT INVENTORY HELPERS
// =========================

const getMaxOrderQuantity = (item) => {
  if (!item) {
    return 0;
  }

  if (isChefOppaSpecialItem(item)) {
    return 1;
  }

  const maxQty =
    toNumberOrNull(
      item?.max_order_quantity ??
        item?.remaining_today ??
        item?.available_quantity
    );

  if (maxQty === null) {
    return 0;
  }

  return Math.max(0, maxQty);
};

const normalizeMenuItem = (item = {}) => {
  const custom =
    isChefOppaSpecialItem(item);

  const maxQty =
    custom
      ? 1
      : getMaxOrderQuantity(item);

  const available =
    custom
      ? !isAvailableFalse(item?.is_available)
      : isAvailableTrue(item?.is_available) &&
        maxQty > 0;

  const image =
    item?.image_url ||
    item?.image ||
    null;

  return {
    ...item,

    id:
      item?.id ??
      item?.menu_item_id,

    menu_item_id:
      item?.menu_item_id ??
      item?.id,

    name:
      item?.name || 'Menu Item',

    category:
      item?.category || null,

    description:
      item?.description || '',

    price:
      toNumber(item?.price),

    image,
    image_url:
      image,

    inventory_type:
      custom
        ? 'custom'
        : item?.inventory_type
          ? normalizeInventoryType(
              item.inventory_type
            )
          : 'ingredient',

    max_order_quantity:
      available ? maxQty : 0,

    remaining_today:
      available ? maxQty : 0,

    available_quantity:
      available ? maxQty : 0,

    is_available:
      available,

    stock_label:
      item?.stock_label ||
      (
        available
          ? custom
            ? 'Custom request available'
            : `${maxQty} order(s) available based on ingredient stock.`
          : null
      ),

    unavailable_reason:
      available
        ? null
        : (
            item?.unavailable_reason ||
            item?.stock_label ||
            'Unavailable based on ingredient stock.'
          ),

    flavor_tags:
      normalizeFlavorTags(
        item?.flavor_tags
      ),

    meal_type:
      normalizeMealType(
        item?.meal_type
      ),

    is_best_seller:
      item?.is_best_seller,
  };
};

const isIngredientAvailableMenuItem = (item) => {
  if (!item) {
    return false;
  }

  if (isChefOppaSpecialItem(item)) {
    return false;
  }

  const normalizedItem =
    normalizeMenuItem(item);

  return (
    normalizedItem.is_available === true &&
    getMaxOrderQuantity(normalizedItem) > 0
  );
};

const extractMenuItemsFromPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  if (
    payload &&
    payload.data &&
    Array.isArray(payload.data.data)
  ) {
    return payload.data.data;
  }

  return [];
};

const getMenuDebugSourceFromPayload = (payload) => {
  return (
    payload?.debug_source ||
    payload?.data?.debug_source ||
    payload?.data?.data?.debug_source ||
    null
  );
};

// =========================
// FETCH AVAILABLE MENU ITEMS
// =========================

const getAvailableMenuItems = async () => {
  const response =
    await axios.get(
      WEB_MENU_URL,
      {
        timeout: 20000,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        params: {
          _ts: Date.now(),
        },
      }
    );

  const debugSource =
    getMenuDebugSourceFromPayload(
      response.data
    );

  const rawItems =
    extractMenuItemsFromPayload(
      response.data
    );

  console.log(
    'AI MENU DEBUG SOURCE:',
    debugSource
  );

  console.log(
    'AI RAW MENU COUNT:',
    rawItems.length
  );

  if (
    debugSource &&
    debugSource !== EXPECTED_MENU_DEBUG_SOURCE
  ) {
    console.log(
      'WARNING: AI MENU DEBUG SOURCE IS NOT EXPECTED:',
      debugSource
    );
  }

  const availableItems =
    rawItems
      .map(normalizeMenuItem)
      .filter(
        isIngredientAvailableMenuItem
      );

  console.log(
    'AI AVAILABLE INGREDIENT MENU COUNT:',
    availableItems.length
  );

  return availableItems;
};

// =========================
// HEURISTIC FALLBACK PAIRING
// =========================

const getComplementaryMealTypes = (
  mealType
) => {
  const map = {
    set: [
      'drink',
      'side',
      'soup',
      'salad',
    ],
    main: [
      'drink',
      'side',
      'soup',
      'salad',
      'dessert',
    ],
    noodle: [
      'drink',
      'side',
      'snack',
    ],
    hotpot: [
      'side',
      'drink',
      'noodle',
    ],
    sushi: [
      'soup',
      'drink',
      'salad',
      'side',
    ],
    snack: [
      'drink',
      'main',
      'noodle',
    ],
    soup: [
      'main',
      'side',
      'sushi',
      'drink',
    ],
    drink: [
      'main',
      'snack',
      'noodle',
      'side',
    ],
    salad: [
      'main',
      'sushi',
      'drink',
    ],
    side: [
      'main',
      'noodle',
      'hotpot',
      'drink',
    ],
    dessert: [
      'main',
      'drink',
    ],
  };

  return map[mealType] || [
    'drink',
    'side',
    'main',
    'soup',
  ];
};

const getFlavorComplements = (
  tags = []
) => {
  const normalizedTags =
    tags.map(normalizeText);

  const complements = new Set();

  normalizedTags.forEach((tag) => {
    if (tag === 'spicy') {
      [
        'refreshing',
        'sweet',
        'mild',
        'creamy',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (
      tag === 'savory' ||
      tag === 'meaty' ||
      tag === 'umami'
    ) {
      [
        'refreshing',
        'salad',
        'soup',
        'mild',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (
      tag === 'fried' ||
      tag === 'crispy'
    ) {
      [
        'refreshing',
        'tangy',
        'mild',
        'sweet',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (
      tag === 'cheesy' ||
      tag === 'creamy'
    ) {
      [
        'spicy',
        'refreshing',
        'savory',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (tag === 'seafood') {
      [
        'mild',
        'refreshing',
        'tangy',
        'soup',
        'salad',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (tag === 'broth') {
      [
        'side',
        'crispy',
        'savory',
        'drink',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (tag === 'fermented') {
      [
        'mild',
        'drink',
        'refreshing',
        'savory',
      ].forEach((item) =>
        complements.add(item)
      );
    }

    if (tag === 'sweet') {
      [
        'savory',
        'crispy',
        'mild',
        'drink',
      ].forEach((item) =>
        complements.add(item)
      );
    }
  });

  return complements;
};

const buildFallbackRecommendations = ({
  selectedItem,
  cartItems = [],
  candidateItems = [],
}) => {
  const selected =
    normalizeMenuItem(
      selectedItem || {}
    );

  const selectedMealType =
    getMealType(selected);

  const selectedCategory =
    getCategory(selected);

  const selectedTags =
    normalizeFlavorTags(
      selected.flavor_tags
    );

  const selectedTagSet =
    getFlavorTagSet(selected);

  const complementaryMealTypes =
    new Set(
      getComplementaryMealTypes(
        selectedMealType
      )
    );

  const flavorComplements =
    getFlavorComplements(
      selectedTags
    );

  const cartMealTypes =
    new Set(
      cartItems
        .map(getMealType)
        .filter(Boolean)
    );

  const cartTags =
    new Set(
      cartItems
        .flatMap((cartItem) =>
          normalizeFlavorTags(
            cartItem.flavor_tags
          )
        )
        .map(normalizeText)
    );

  const scored =
    candidateItems.map((item) => {
      const itemMealType =
        getMealType(item);

      const itemCategory =
        getCategory(item);

      const itemTags =
        normalizeFlavorTags(
          item.flavor_tags
        ).map(normalizeText);

      let score = 0;

      let reason =
        'Pairs well with your selected dish.';

      if (
        complementaryMealTypes.has(
          itemMealType
        )
      ) {
        score += 12;
        reason =
          'Complements this dish as a good pairing.';
      }

      itemTags.forEach((tag) => {
        if (
          flavorComplements.has(tag)
        ) {
          score += 8;
          reason =
            'Balances the flavors of this dish.';
        }

        if (
          selectedTagSet.has(tag)
        ) {
          score += 3;
        }

        if (
          cartTags.has(tag)
        ) {
          score += 2;
        }
      });

      if (
        itemMealType &&
        cartMealTypes.has(itemMealType)
      ) {
        score += 2;
      }

      if (
        selectedCategory &&
        itemCategory &&
        selectedCategory !== itemCategory
      ) {
        score += 3;
      }

      if (
        selectedCategory &&
        itemCategory === selectedCategory
      ) {
        score -= 2;
      }

      if (
        isBestSellerTrue(
          item.is_best_seller
        )
      ) {
        score += 6;
        reason =
          'A popular choice that goes well with this meal.';
      }

      if (
        itemMealType === 'drink'
      ) {
        score += 4;
        reason =
          'A refreshing drink pairing for this meal.';
      }

      if (
        itemMealType === selectedMealType
      ) {
        score -= 4;
      }

      if (
        itemMealType === 'alcohol' &&
        selectedMealType !== 'alcohol'
      ) {
        score -= 100;
      }

      return {
        ...item,
        ai_score:
          score,
        reason,
      };
    });

  return scored
    .sort((a, b) => {
      if (b.ai_score !== a.ai_score) {
        return b.ai_score - a.ai_score;
      }

      return String(a.name || '')
        .localeCompare(
          String(b.name || '')
        );
    })
    .slice(0, 3);
};

const simplifyCandidateItem = (item) => {
  return {
    id:
      item.id,
    name:
      item.name,
    category:
      item.category,
    description:
      item.description || '',
    price:
      item.price,
    image:
      item.image || null,
    image_url:
      item.image_url ||
      item.image ||
      null,
    is_available:
      item.is_available,
    inventory_type:
      item.inventory_type,
    remaining_today:
      item.remaining_today,
    max_order_quantity:
      item.max_order_quantity,
    available_quantity:
      item.available_quantity,
    stock_label:
      item.stock_label,
    flavor_tags:
      normalizeFlavorTags(
        item.flavor_tags
      ),
    meal_type:
      normalizeMealType(
        item.meal_type
      ),
    is_best_seller:
      item.is_best_seller,
  };
};

const simplifyCartItem = (item) => {
  return {
    id:
      item.id ||
      item.menu_item_id,
    name:
      item.name,
    category:
      item.category,
    quantity:
      item.quantity,
    flavor_tags:
      normalizeFlavorTags(
        item.flavor_tags
      ),
    meal_type:
      normalizeMealType(
        item.meal_type
      ),
  };
};

const removeSelectedAndCartItems = ({
  availableMenuItems = [],
  selectedItem = null,
  cartItems = [],
}) => {
  const selectedId =
    Number(
      selectedItem?.id ||
      selectedItem?.menu_item_id
    );

  const cartIds =
    Array.isArray(cartItems)
      ? cartItems
          .map((item) =>
            Number(
              item.id ||
              item.menu_item_id
            )
          )
          .filter(Boolean)
      : [];

  return availableMenuItems.filter(
    (item) => {
      const itemId =
        Number(
          item.id ||
          item.menu_item_id
        );

      return (
        itemId !== selectedId &&
        !cartIds.includes(
          itemId
        )
      );
    }
  );
};

// =========================
// AI DISH RECOMMENDATIONS
// POST /api/ai/recommend-dishes
// =========================

router.post(
  '/recommend-dishes',
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const selectedItemFromBody =
        body.selected_item ||
        body.selectedItem ||
        null;

      const cartItemsFromBody =
        body.cart_items ||
        body.cartItems ||
        [];

      if (
        !selectedItemFromBody &&
        cartItemsFromBody.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Selected item or cart items are required.',
        });
      }

      const normalizedSelectedItem =
        selectedItemFromBody
          ? normalizeMenuItem(
              selectedItemFromBody
            )
          : null;

      const normalizedCartItems =
        Array.isArray(
          cartItemsFromBody
        )
          ? cartItemsFromBody.map(
              normalizeMenuItem
            )
          : [];

      const availableMenuItems =
        await getAvailableMenuItems();

      const candidateItems =
        removeSelectedAndCartItems({
          availableMenuItems,
          selectedItem:
            normalizedSelectedItem,
          cartItems:
            normalizedCartItems,
        });

      if (
        candidateItems.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
          source:
            'ingredient_menu',
          message:
            'No available menu items to recommend.',
        });
      }

      const fallbackRecommendations =
        buildFallbackRecommendations({
          selectedItem:
            normalizedSelectedItem,
          cartItems:
            normalizedCartItems,
          candidateItems,
        });

      if (
        !process.env.OPENAI_API_KEY
      ) {
        return res.json({
          success: true,
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'OPENAI_API_KEY missing. Used local pairing fallback.',
        });
      }

      const simplifiedCandidates =
        candidateItems.map(
          simplifyCandidateItem
        );

      const simplifiedCart =
        normalizedCartItems.map(
          simplifyCartItem
        );

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
- soup pairs well with main, side, drink, or sushi.
- spicy food pairs well with refreshing, sweet, mild, or creamy items.
- savory or meaty food pairs well with refreshing drinks, side dishes, salad, or soup.
- fried or crispy food pairs well with refreshing drinks, mild sides, or tangy items.
- cheesy or creamy food pairs well with spicy, refreshing, or savory items.
- seafood items pair well with mild, refreshing, tangy, soup, salad, or sushi items.
- broth dishes pair well with side dishes, crispy items, savory dishes, or drinks.
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

      let completion;

      try {
        completion =
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
                content:
                  prompt,
              },
            ],
            temperature: 0.6,
          });
      } catch (openAiError) {
        console.log(
          'OPENAI RECOMMEND ERROR:',
          openAiError?.response?.data ||
            openAiError?.message ||
            openAiError
        );

        return res.json({
          success: true,
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI request failed. Used local pairing fallback.',
        });
      }

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

        return res.json({
          success: true,
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI returned invalid JSON. Used local pairing fallback.',
        });
      }

      const recommendations =
        Array.isArray(
          parsed.recommendations
        )
          ? parsed.recommendations
          : [];

      const enrichedRecommendations =
        recommendations
          .map((rec) => {
            const matchedItem =
              candidateItems.find(
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

      if (
        enrichedRecommendations.length === 0
      ) {
        return res.json({
          success: true,
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI returned no valid menu matches. Used local pairing fallback.',
        });
      }

      return res.json({
        success: true,
        data:
          enrichedRecommendations,
        source:
          'openai',
      });
    } catch (error) {
      console.log(
        'AI RECOMMEND DISHES ERROR:',
        error?.response?.data ||
          error?.message ||
          error
      );

      try {
        const body =
          req.body || {};

        const selectedItemFromBody =
          body.selected_item ||
          body.selectedItem ||
          null;

        const cartItemsFromBody =
          body.cart_items ||
          body.cartItems ||
          [];

        const normalizedSelectedItem =
          selectedItemFromBody
            ? normalizeMenuItem(
                selectedItemFromBody
              )
            : null;

        const normalizedCartItems =
          Array.isArray(
            cartItemsFromBody
          )
            ? cartItemsFromBody.map(
                normalizeMenuItem
              )
            : [];

        const availableMenuItems =
          await getAvailableMenuItems();

        const candidateItems =
          removeSelectedAndCartItems({
            availableMenuItems,
            selectedItem:
              normalizedSelectedItem,
            cartItems:
              normalizedCartItems,
          });

        const fallbackRecommendations =
          buildFallbackRecommendations({
            selectedItem:
              normalizedSelectedItem,
            cartItems:
              normalizedCartItems,
            candidateItems,
          });

        return res.json({
          success: true,
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI failed. Used local pairing fallback.',
        });
      } catch (fallbackError) {
        console.log(
          'AI FALLBACK ERROR:',
          fallbackError?.response?.data ||
            fallbackError?.message ||
            fallbackError
        );

        return res.status(500).json({
          success: false,
          message:
            error.message ||
            'Failed to get dish recommendations.',
        });
      }
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
      const {
        itemName,
      } = req.body || {};

      if (!itemName) {
        return res.status(400).json({
          success: false,
          message:
            'itemName is required',
        });
      }

      const availableMenuItems =
        await getAvailableMenuItems();

      const selected =
        availableMenuItems.find(
          (item) =>
            normalizeText(item.name) ===
            normalizeText(itemName)
        ) || {
          name:
            itemName,
        };

      const availableItems =
        availableMenuItems.filter(
          (item) =>
            normalizeText(item.name) !==
            normalizeText(itemName)
        );

      const fallbackRecommendations =
        buildFallbackRecommendations({
          selectedItem:
            selected,
          cartItems:
            [],
          candidateItems:
            availableItems,
        });

      if (
        !process.env.OPENAI_API_KEY
      ) {
        return res.json({
          success: true,
          recommendations:
            fallbackRecommendations.map(
              (item) => item.name
            ),
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'OPENAI_API_KEY missing. Used local pairing fallback.',
        });
      }

      const prompt = `
Recommend exactly 3 food pairings for this Chef Oppa menu item:
${itemName}

Only choose from this available menu list:
${JSON.stringify(
  availableItems.map(
    simplifyCandidateItem
  ),
  null,
  2
)}

Rules:
- Return valid JSON only.
- Do not recommend unavailable items.
- Do not recommend the selected item.
- Use this format:
{
  "recommendations": [
    {
      "id": 1,
      "name": "Dish Name",
      "reason": "Short reason"
    }
  ]
}
`;

      let completion;

      try {
        completion =
          await client.chat.completions.create({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are a Korean restaurant food recommendation AI. Return valid JSON only.',
              },
              {
                role: 'user',
                content:
                  prompt,
              },
            ],
            temperature: 0.7,
          });
      } catch (openAiError) {
        console.log(
          'OPENAI PAIRING ERROR:',
          openAiError?.response?.data ||
            openAiError?.message ||
            openAiError
        );

        return res.json({
          success: true,
          recommendations:
            fallbackRecommendations.map(
              (item) => item.name
            ),
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI request failed. Used local pairing fallback.',
        });
      }

      const rawReply =
        completion.choices?.[0]
          ?.message?.content || '';

      let parsed;

      try {
        parsed =
          JSON.parse(rawReply);
      } catch (parseError) {
        console.log(
          'AI PAIRING RAW REPLY:',
          rawReply
        );

        return res.json({
          success: true,
          recommendations:
            fallbackRecommendations.map(
              (item) => item.name
            ),
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI returned invalid JSON. Used local pairing fallback.',
        });
      }

      const recommendations =
        Array.isArray(
          parsed.recommendations
        )
          ? parsed.recommendations
          : [];

      const enrichedRecommendations =
        recommendations
          .map((rec) => {
            const matchedItem =
              availableItems.find(
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
                'Pairs well with this dish.',
            };
          })
          .filter(Boolean)
          .slice(0, 3);

      if (
        enrichedRecommendations.length === 0
      ) {
        return res.json({
          success: true,
          recommendations:
            fallbackRecommendations.map(
              (item) => item.name
            ),
          data:
            fallbackRecommendations,
          source:
            'fallback',
          message:
            'AI returned no valid menu matches. Used local pairing fallback.',
        });
      }

      return res.json({
        success: true,
        recommendations:
          enrichedRecommendations.map(
            (item) => item.name
          ),
        data:
          enrichedRecommendations,
        source:
          'openai',
      });
    } catch (error) {
      console.log(
        'AI PAIRING ERROR:',
        error?.response?.data ||
          error?.message ||
          error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to recommend pairings.',
      });
    }
  }
);

module.exports = router;