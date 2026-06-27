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
// DAILY INVENTORY SETTINGS
// =========================

const VALID_NORMAL_INVENTORY_TYPES = [
  'per_order',
  'per_head',
];

const MANILA_UTC_OFFSET_HOURS = 8;

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

const hasInventoryType = (item) => {
  return (
    item?.inventory_type !== null &&
    item?.inventory_type !== undefined &&
    String(item.inventory_type).trim() !== ''
  );
};

const hasDailyLimit = (item) => {
  return (
    item?.daily_limit !== null &&
    item?.daily_limit !== undefined &&
    String(item.daily_limit).trim() !== ''
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

const normalizeMenuItem = (item) => {
  return {
    ...item,

    flavor_tags:
      normalizeFlavorTags(
        item?.flavor_tags
      ),

    meal_type:
      normalizeMealType(
        item?.meal_type
      ),

    image_url:
      item?.image_url ||
      item?.image ||
      null,
  };
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
// MANILA TODAY RANGE
// =========================

const getManilaTodayUtcRange = () => {
  const now =
    new Date();

  const manilaNow =
    new Date(
      now.getTime() +
      MANILA_UTC_OFFSET_HOURS *
      60 *
      60 *
      1000
    );

  const year =
    manilaNow.getUTCFullYear();

  const month =
    manilaNow.getUTCMonth();

  const day =
    manilaNow.getUTCDate();

  const startUtc =
    new Date(
      Date.UTC(
        year,
        month,
        day,
        -MANILA_UTC_OFFSET_HOURS,
        0,
        0,
        0
      )
    );

  const endUtc =
    new Date(
      startUtc.getTime() +
      24 * 60 * 60 * 1000
    );

  return {
    startIso:
      startUtc.toISOString(),
    endIso:
      endUtc.toISOString(),
  };
};

// =========================
// SOLD TODAY HELPERS
// =========================

const getSoldTodayMap = async () => {
  const {
    startIso,
    endIso,
  } = getManilaTodayUtcRange();

  const {
    data: orders,
    error: ordersError,
  } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .gte('created_at', startIso)
    .lt('created_at', endIso);

  if (ordersError) {
    console.log(
      'AI SOLD TODAY ORDERS ERROR:',
      ordersError
    );

    return {};
  }

  const validOrderIds =
    (orders || [])
      .filter((order) => {
        const status =
          normalizeText(order.status);

        return ![
          'cancelled',
          'canceled',
          'failed',
          'voided',
        ].includes(status);
      })
      .map((order) => order.id)
      .filter(Boolean);

  if (validOrderIds.length === 0) {
    return {};
  }

  const {
    data: orderItems,
    error: orderItemsError,
  } = await supabase
    .from('order_items')
    .select('order_id, menu_item_id, quantity')
    .in('order_id', validOrderIds);

  if (orderItemsError) {
    console.log(
      'AI SOLD TODAY ORDER ITEMS ERROR:',
      orderItemsError
    );

    return {};
  }

  const soldTodayMap = {};

  (orderItems || []).forEach((item) => {
    const menuItemId =
      item.menu_item_id;

    const quantity =
      Number(item.quantity) || 0;

    if (!menuItemId) {
      return;
    }

    if (!soldTodayMap[menuItemId]) {
      soldTodayMap[menuItemId] = 0;
    }

    soldTodayMap[menuItemId] += quantity;
  });

  return soldTodayMap;
};

// =========================
// DAILY INVENTORY ENRICHMENT
// No old ingredient/recipe validation here.
// Daily Menu Inventory controls mobile visibility.
// =========================

const enrichDailyInventoryItem = (
  item,
  soldTodayMap = {}
) => {
  const normalizedItem =
    normalizeMenuItem(item);

  const isCustom =
    isChefOppaSpecialItem(
      normalizedItem
    );

  if (isCustom) {
    const customAvailable =
      isAvailableTrue(
        normalizedItem.is_available
      );

    return {
      ...normalizedItem,
      inventory_type:
        'custom',
      daily_limit:
        null,
      sold_today:
        0,
      remaining_today:
        customAvailable ? 1 : 0,
      max_order_quantity:
        customAvailable ? 1 : 0,
      available_quantity:
        customAvailable ? 1 : 0,
      is_available:
        customAvailable,
      stock_label:
        customAvailable
          ? 'Custom request available'
          : 'Unavailable',
    };
  }

  const inventoryType =
    normalizeInventoryType(
      normalizedItem.inventory_type
    );

  const dailyLimit =
    toNumberOrNull(
      normalizedItem.daily_limit
    );

  const available =
    isAvailableTrue(
      normalizedItem.is_available
    );

  const validDailyInventory =
    available &&
    hasInventoryType(normalizedItem) &&
    VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    ) &&
    hasDailyLimit(normalizedItem) &&
    dailyLimit !== null;

  if (!validDailyInventory) {
    return {
      ...normalizedItem,
      sold_today:
        Number(
          soldTodayMap[normalizedItem.id] || 0
        ),
      remaining_today:
        0,
      max_order_quantity:
        0,
      available_quantity:
        0,
      is_available:
        false,
      stock_label:
        'Not enabled in Daily Menu Inventory',
    };
  }

  const soldToday =
    Number(
      soldTodayMap[normalizedItem.id] || 0
    );

  const remainingToday =
    Math.max(
      0,
      dailyLimit - soldToday
    );

  const maxOrderQuantity =
    remainingToday;

  return {
    ...normalizedItem,
    inventory_type:
      inventoryType,
    daily_limit:
      dailyLimit,
    sold_today:
      soldToday,
    remaining_today:
      remainingToday,
    max_order_quantity:
      maxOrderQuantity,
    available_quantity:
      maxOrderQuantity,
    is_available:
      remainingToday > 0,
    stock_label:
      remainingToday > 0
        ? `${remainingToday} orders left today`
        : 'Sold out today',
  };
};

const isMobileVisibleMenuItem = (item) => {
  if (!item) {
    return false;
  }

  if (
    !isAvailableTrue(
      item.is_available
    )
  ) {
    return false;
  }

  if (
    isChefOppaSpecialItem(item)
  ) {
    return false;
  }

  const inventoryType =
    normalizeInventoryType(
      item.inventory_type
    );

  if (
    !VALID_NORMAL_INVENTORY_TYPES.includes(
      inventoryType
    )
  ) {
    return false;
  }

  const dailyLimit =
    toNumberOrNull(
      item.daily_limit
    );

  const remainingToday =
    toNumber(
      item.remaining_today
    );

  const maxOrderQuantity =
    toNumber(
      item.max_order_quantity
    );

  return (
    dailyLimit !== null &&
    (
      remainingToday > 0 ||
      maxOrderQuantity > 0
    )
  );
};

// =========================
// FETCH AVAILABLE MENU ITEMS
// =========================

const getAvailableMenuItems = async () => {
  const soldTodayMap =
    await getSoldTodayMap();

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

  return (menuItems || [])
    .map((item) =>
      enrichDailyInventoryItem(
        item,
        soldTodayMap
      )
    )
    .filter(
      isMobileVisibleMenuItem
    );
};

// =========================
// HEURISTIC FALLBACK PAIRING
// Used if OpenAI fails, returns invalid JSON,
// or there is no OPENAI_API_KEY.
// This keeps "Must try pairings!" from disappearing.
// =========================

const getComplementaryMealTypes = (
  mealType
) => {
  const map = {
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
    id: item.id,
    name: item.name,
    category: item.category,
    description:
      item.description || '',
    price: item.price,
    image:
      item.image || null,
    image_url:
      item.image_url ||
      item.image ||
      null,
    is_available:
      item.is_available,
    daily_limit:
      item.daily_limit,
    remaining_today:
      item.remaining_today,
    max_order_quantity:
      item.max_order_quantity,
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

// =========================
// AI DISH RECOMMENDATIONS
// POST /api/ai/recommend-dishes
// Recommended route for mobile
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

      const selectedId =
        Number(
          normalizedSelectedItem?.id ||
          normalizedSelectedItem?.menu_item_id
        );

      const cartIds =
        normalizedCartItems
          .map((item) =>
            Number(
              item.id ||
              item.menu_item_id
            )
          )
          .filter(Boolean);

      const candidateItems =
        availableMenuItems.filter(
          (item) => {
            const itemId =
              Number(item.id);

            return (
              itemId !== selectedId &&
              !cartIds.includes(
                itemId
              )
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
        error
      );

      try {
        if (
          !isConfigured ||
          !supabase
        ) {
          throw error;
        }

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

        const selectedId =
          Number(
            normalizedSelectedItem?.id ||
            normalizedSelectedItem?.menu_item_id
          );

        const cartIds =
          normalizedCartItems
            .map((item) =>
              Number(
                item.id ||
                item.menu_item_id
              )
            )
            .filter(Boolean);

        const candidateItems =
          availableMenuItems.filter(
            (item) => {
              const itemId =
                Number(item.id);

              return (
                itemId !== selectedId &&
                !cartIds.includes(
                  itemId
                )
              );
            }
          );

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
      } = req.body;

      if (!itemName) {
        return res.status(400).json({
          success: false,
          message:
            'itemName is required',
        });
      }

      const {
        data: menuItems,
        error,
      } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', {
          ascending: true,
        });

      if (
        !error &&
        Array.isArray(menuItems)
      ) {
        const soldTodayMap =
          await getSoldTodayMap();

        const selected =
          (menuItems || []).find(
            (item) =>
              normalizeText(item.name) ===
              normalizeText(itemName)
          );

        const availableItems =
          (menuItems || [])
            .map((item) =>
              enrichDailyInventoryItem(
                item,
                soldTodayMap
              )
            )
            .filter(
              isMobileVisibleMenuItem
            )
            .filter(
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
        });
      }

      if (
        !process.env.OPENAI_API_KEY
      ) {
        return res.status(500).json({
          success: false,
          message:
            'OPENAI_API_KEY is missing in backend .env.',
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