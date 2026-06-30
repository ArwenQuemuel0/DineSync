const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const router = express.Router();

const MODEL =
  process.env.OPENAI_MODEL ||
  'gpt-4o-mini';

const WEB_MENU_URL =
  process.env.WEB_MENU_URL ||
  process.env.LARAVEL_MENU_URL ||
  'https://dinesync.shop/api/menu';

const EXPECTED_MENU_DEBUG_SOURCE =
  'WEB_MENU_INGREDIENT_AVAILABILITY_FIXED_2026';

const client =
  process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    : null;

// =========================
// HELPERS
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

const toNumber = (value) => {
  const numberValue =
    Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
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
    image_url: image,

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
    'AI AVAILABLE MENU COUNT:',
    availableItems.length
  );

  return availableItems;
};

const getFlavorTagSet = (item) => {
  return new Set(
    normalizeFlavorTags(
      item?.flavor_tags
    ).map(normalizeText)
  );
};

const getComplementaryMealTypes = (mealType) => {
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

const getFlavorComplements = (tags = []) => {
  const normalizedTags =
    tags.map(normalizeText);

  const complements =
    new Set();

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

const removeSelectedAndCartItems = ({
  availableMenuItems,
  selectedItem,
  cartItems = [],
}) => {
  const selectedId =
    selectedItem?.id ??
    selectedItem?.menu_item_id;

  const cartIds =
    new Set(
      cartItems
        .map((item) =>
          String(
            item?.id ??
              item?.menu_item_id ??
              ''
          )
        )
        .filter(Boolean)
    );

  return availableMenuItems.filter((item) => {
    const itemId =
      String(
        item?.id ??
          item?.menu_item_id ??
          ''
      );

    if (!itemId) {
      return false;
    }

    if (
      selectedId &&
      itemId === String(selectedId)
    ) {
      return false;
    }

    if (cartIds.has(itemId)) {
      return false;
    }

    return true;
  });
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

        if (cartTags.has(tag)) {
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

      if (itemMealType === 'drink') {
        score += 4;
        reason =
          'A refreshing drink pairing for this meal.';
      }

      if (
        itemMealType === selectedMealType
      ) {
        score -= 4;
      }

      return {
        ...item,
        score,
        reason,
      };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      reason:
        item.reason ||
        'Pairs well with your selected dish.',
    }));
};

const simplifyCandidateItem = (item) => {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    meal_type: item.meal_type,
    flavor_tags: item.flavor_tags,
    is_best_seller: item.is_best_seller,
    stock_label: item.stock_label,
    max_order_quantity:
      item.max_order_quantity,
  };
};

const getOpenAiRecommendations = async ({
  selectedItem,
  cartItems,
  candidateItems,
}) => {
  if (!client) {
    return null;
  }

  if (
    !candidateItems ||
    candidateItems.length === 0
  ) {
    return null;
  }

  const prompt = `
You are a food recommendation assistant for Chef Oppa Korean Restaurant.

Recommend exactly 3 menu items that pair well with the selected item.

Selected item:
${JSON.stringify(
  simplifyCandidateItem(selectedItem),
  null,
  2
)}

Current cart:
${JSON.stringify(
  cartItems.map(simplifyCandidateItem),
  null,
  2
)}

Available candidates:
${JSON.stringify(
  candidateItems.map(simplifyCandidateItem),
  null,
  2
)}

Rules:
- Recommend only from Available candidates.
- Do not recommend unavailable items.
- Do not recommend the selected item.
- Do not recommend duplicate items.
- Return valid JSON only.
- Use this exact format:
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

  const completion =
    await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You recommend Korean restaurant menu pairings. Return valid JSON only.',
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
  } catch (error) {
    console.log(
      'AI RAW REPLY:',
      rawReply
    );

    return null;
  }

  const recommendations =
    Array.isArray(
      parsed.recommendations
    )
      ? parsed.recommendations
      : [];

  const enriched =
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
          reason:
            rec.reason ||
            'Pairs well with your selected dish.',
        };
      })
      .filter(Boolean)
      .slice(0, 3);

  if (enriched.length === 0) {
    return null;
  }

  return enriched;
};

// =========================
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

      if (!selectedItemFromBody) {
        return res.status(400).json({
          success: false,
          message:
            'selected_item is required.',
        });
      }

      const normalizedSelectedItem =
        normalizeMenuItem(
          selectedItemFromBody
        );

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

      let aiRecommendations = null;

      try {
        aiRecommendations =
          await getOpenAiRecommendations({
            selectedItem:
              normalizedSelectedItem,
            cartItems:
              normalizedCartItems,
            candidateItems,
          });
      } catch (openAiError) {
        console.log(
          'OPENAI RECOMMEND ERROR:',
          openAiError?.response?.data ||
            openAiError?.message ||
            openAiError
        );
      }

      return res.json({
        success: true,
        data:
          aiRecommendations ||
          fallbackRecommendations,
        source:
          aiRecommendations
            ? 'openai'
            : 'fallback',
        message:
          aiRecommendations
            ? undefined
            : 'Used local pairing fallback.',
      });
    } catch (error) {
      console.log(
        'AI RECOMMEND DISHES ERROR:',
        error?.response?.data ||
          error?.message ||
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
// POST /api/ai/pairing
// old route compatibility
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
            'itemName is required.',
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
          id: null,
          name: itemName,
          meal_type: null,
          flavor_tags: [],
        };

      const candidateItems =
        availableMenuItems.filter(
          (item) =>
            normalizeText(item.name) !==
            normalizeText(itemName)
        );

      const fallbackRecommendations =
        buildFallbackRecommendations({
          selectedItem:
            selected,
          cartItems: [],
          candidateItems,
        });

      let aiRecommendations = null;

      try {
        aiRecommendations =
          await getOpenAiRecommendations({
            selectedItem:
              selected,
            cartItems: [],
            candidateItems,
          });
      } catch (openAiError) {
        console.log(
          'OPENAI PAIRING ERROR:',
          openAiError?.response?.data ||
            openAiError?.message ||
            openAiError
        );
      }

      const finalRecommendations =
        aiRecommendations ||
        fallbackRecommendations;

      return res.json({
        success: true,
        recommendations:
          finalRecommendations.map(
            (item) => item.name
          ),
        data:
          finalRecommendations,
        source:
          aiRecommendations
            ? 'openai'
            : 'fallback',
        message:
          aiRecommendations
            ? undefined
            : 'Used local pairing fallback.',
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