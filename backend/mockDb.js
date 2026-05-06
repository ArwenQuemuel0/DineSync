const menuItems = [
  { id: 1, name: 'Unlimited Samgyupsal - Pork', category: 'Unlimited Sets', price: 599.00, description: 'Unlimited pork belly, side dishes, and rice.' },
  { id: 2, name: 'Unlimited Samgyupsal - Beef & Pork', category: 'Unlimited Sets', price: 799.00, description: 'Unlimited premium beef, pork belly, side dishes, and rice.' },
  { id: 3, name: 'Bibimbap', category: 'A La Carte', price: 250.00, description: 'Mixed rice with meat and assorted vegetables.' },
  { id: 4, name: 'Kimchi Jjigae', category: 'A La Carte', price: 280.00, description: 'Spicy kimchi stew with pork.' },
  { id: 5, name: 'Soju', category: 'Drinks', price: 150.00, description: 'Korean distilled spirit.' },
  { id: 6, name: 'Iced Tea', category: 'Drinks', price: 60.00, description: 'House blend iced tea.' }
];

const orders = [];
const payments = [];

module.exports = {
  menuItems,
  orders,
  payments
};
