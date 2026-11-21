export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  link?: { path: string; label: string };
}

export const questions: readonly FaqEntry[] = [
  {
    id: 'delivery',
    question: 'How long does delivery take?',
    answer:
      'Delivery depends on your pincode. Check the estimate on the product page and review it at checkout.',
    link: { path: '/policies/shipping', label: 'Shipping policy' },
  },
  {
    id: 'cod',
    question: 'Can I pay with Cash on Delivery?',
    answer:
      'Enter your pincode on the product page to check COD availability. Checkout shows any COD and delivery fees before you order.',
  },
  {
    id: 'returns',
    question: 'How do returns work?',
    answer:
      'If your order arrives damaged or the wrong item was sent, keep the packaging and contact support with your order number.',
    link: { path: '/policies/returns', label: 'Returns policy' },
  },
  {
    id: 'battery',
    question: 'What should I know about RC batteries and safety?',
    answer:
      'Check the listing for battery requirements and the recommended age. Use the specified charger, follow the manufacturer’s instructions, and supervise children during use.',
  },
  {
    id: 'tracking',
    question: 'Where can I track or cancel my order?',
    answer:
      'Use the tracking link on the confirmation page. For guest orders, use the browser where you placed the order. You can cancel while the order is placed or confirmed.',
    link: { path: '/orders', label: 'Order history' },
  },
  {
    id: 'scale',
    question: 'What does the model scale mean?',
    answer:
      'At 1:64, a measurement on the model is one sixty-fourth of the original. Check the product page for listed dimensions.',
  },
  {
    id: 'restock',
    question: 'How do I get a restock alert?',
    answer:
      'Select “Notify me when back in stock” on a sold-out model. You’ll see a notice when you return in the same browser after it has restocked.',
  },
];

const homeQuestionIds = new Set(['delivery', 'cod', 'returns', 'battery', 'tracking']);
export const homeQuestions = questions.filter(({ id }) => homeQuestionIds.has(id));
