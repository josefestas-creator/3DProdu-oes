import { Product, Review } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Vaso Orgânico v1',
    price: 24.90,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHEY-ELatEUP4Op3XUdOsr8nF9qOv7FM1bYM9rdwITm9oNtwCS0Z7xSJ8rllVClzPV__5-Z_o8J0qLpJniL7tpqAldIE14X5lFoxy_1R31I8x2FjDeJdcZVCrhwnJ0Y6yfR9pnifEMx1-avzcVCe72uRG_Iy41mY0DO1_QUYOdYTpsrV_NQVHUxTjqdhyGo8rJOV8edRAz9sWpwYHHUpRulN9xV2zS8hWVQzgmkQwQVBcVtb5XozW1KBSLIofIylJangyDBV9GSW4',
    category: 'Decoração',
    description: 'Peça decorativa com design orgânico, impressa em PLA biodegradável de alta qualidade.',
    rating: 4.8,
    reviewCount: 124,
    triptychImages: [
      'https://picsum.photos/seed/vase1/800/1000',
      'https://picsum.photos/seed/vase2/800/1000',
      'https://picsum.photos/seed/vase3/800/1000'
    ]
  },
  {
    id: '2',
    name: 'Suporte Articulado',
    price: 18.50,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGKKth3QjAI7jyFp_5_ViIzNVH_90OvVLVO5BpkZLzZbXbWIAc4iy-y_9lzNiyoK7fq5Qga0A7bGrNMjDnLYPIxoTwT4HvabXdn7CZH7qQ8jYvfAHd8a3Jpp96gD3ePuQGh5c5_WS58vkGOxRUZgrsEW4ZosUXuaajIQc7ZJPBJHDORduKZGbdXcaFNH4pjQbwchNcrdXYE_yzSpcZp7_98pI49kAZ9j9mkhXzf_m59oPI6QJMpWIbISvlgEaVBp-uzvdxbLqNS88',
    category: 'Utilitário',
    description: 'Suporte versátil e resistente para dispositivos móveis, com múltiplos ângulos de ajuste.',
    rating: 4.5,
    reviewCount: 89,
    triptychImages: [
      'https://picsum.photos/seed/support1/800/1000',
      'https://picsum.photos/seed/support2/800/1000',
      'https://picsum.photos/seed/support3/800/1000'
    ]
  },
  {
    id: '3',
    name: 'Organizador Hexa',
    price: 12.00,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7iea9eW_-hu3OvkWNK6zw4HAPXZH50cnSsz0EEtcIM9DaEO52Z4O5-v_2IFU9_cgXv_WgqVhLKIyp4Ec_BUmByig_a-pYOE9kMniJteH4slFCke6N-96QP9Zp0vCWuDdbW8JcycL7tsPeeVMoBIUMA86t3YFFNWAdahJs2LKnnUgV01JN_Q_O1ZsJh71SfUmxqLPGA7MMxiFjO5Em7T2uPA2tBP7zWg11UX5YXzea6_133NoAkI-liDeWjTgfU9pMc1qILJaWI6c',
    category: 'Escritório',
    description: 'Organizador modular em formato hexagonal, perfeito para manter a sua secretária impecável.',
    rating: 4.9,
    reviewCount: 56,
    triptychImages: [
      'https://picsum.photos/seed/organizer1/800/1000',
      'https://picsum.photos/seed/organizer2/800/1000',
      'https://picsum.photos/seed/organizer3/800/1000'
    ]
  },
  {
    id: '4',
    name: 'Luminária Low Poly',
    price: 35.00,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaVpAmOZSBB1CdUtQtcjHqzpnOp8J18SpoRcK9VYxRSO2NlQmzWPglekftYpWGDMXlqAkyzVn33Ne9xLEzrt26I3ffA6XoDvoHUgupK8BeW-v-g-Q4dKAdldrlOTn-2gU7Af0PigHLyUWgkJeuo_l6A2_5POL8AK2rDZ7tE_976QKn5Io2D7Ncj852se6iRRAvCsSamq24G6a0iTVjR5VqQGRNpwDrQG3Xg00GlIAuLqtuevQgClvg57kFSfEVeOukcq0uIvH5jC0',
    category: 'Iluminação',
    description: 'Luminária de mesa com design minimalista low poly, cria um ambiente acolhedor e moderno.',
    rating: 4.7,
    reviewCount: 210,
    triptychImages: [
      'https://picsum.photos/seed/lamp1/800/1000',
      'https://picsum.photos/seed/lamp2/800/1000',
      'https://picsum.photos/seed/lamp3/800/1000'
    ]
  }
];

export const REVIEWS: Review[] = [
  { id: '1', rating: 5, date: '15/03/2026' },
  { id: '2', rating: 4, date: '10/03/2026' },
  { id: '3', rating: 5, date: '05/03/2026' },
  { id: '4', rating: 5, date: '01/03/2026' }
];
