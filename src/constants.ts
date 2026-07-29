import { Product, Review } from './types';

export const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Suporte de Headphones Cyberpunk 3D',
    price: 24.90,
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
    category: 'Gaming & Tech',
    description: 'Suporte ergonómico e futurista impresso em 3D de alta precisão com passagem oculta de cabos, estrutura reforçada em PETG e base antiderrapante.',
    rating: 4.9,
    reviewCount: 28,
    order: 1,
    triptychImages: [
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'prod-2',
    name: 'Vaso Geométrico Minimalista Spiral',
    price: 18.50,
    imageUrl: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80',
    category: 'Decoração',
    description: 'Vaso decorativo impresso em polímero PLA ecológico com padrão helicoidal moderno. Ideal para flores secas, suculentas e ambientes contemporâneos.',
    rating: 4.8,
    reviewCount: 42,
    order: 2,
    triptychImages: [
      'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'prod-3',
    name: 'Dragão Articulado Flexi Crystal',
    price: 19.90,
    imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
    category: 'Exclusivos',
    description: 'Dragão mitológico totalmente articulado impresso em peça única sem costuras. Movimento fluido, ótimo para alívio de stress e colecionismo.',
    rating: 5.0,
    reviewCount: 65,
    order: 3,
    triptychImages: [
      'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80'
    ]
  },
  {
    id: 'prod-4',
    name: 'Organizador de Cabos Modular Desktop',
    price: 12.90,
    imageUrl: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=800&q=80',
    category: 'Utilidades',
    description: 'Sistema magnético de fixação para cabos de secretária. Mantém os cabos USB-C, Lightning e alimentação sempre organizados e acessíveis.',
    rating: 4.7,
    reviewCount: 19,
    order: 4
  },
  {
    id: 'prod-5',
    name: 'Suporte Ajustável para Telemóvel & Tablet',
    price: 14.50,
    imageUrl: 'https://images.unsplash.com/photo-1586776977607-310e9c725c37?auto=format&fit=crop&w=800&q=80',
    category: 'Utilidades',
    description: 'Suporte universal reclinável com borracha antiderrapante. Perfeito para chamadas de vídeo, leitura e streaming na secretária ou mesa de cabeceira.',
    rating: 4.9,
    reviewCount: 31,
    order: 5
  },
  {
    id: 'prod-6',
    name: 'Lâmpada Litofania Personalizada 3D',
    price: 34.90,
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
    category: 'Personalizados',
    description: 'A sua foto de família ou evento gravada em espessuras 3D de alta precisão. Quando a lâmpada LED se acende, a foto ganha vida em tons suaves.',
    rating: 5.0,
    reviewCount: 54,
    order: 6
  },
  {
    id: 'prod-7',
    name: 'Caixa Secreta Puzzle 3D Cryptex',
    price: 29.90,
    imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
    category: 'Exclusivos',
    description: 'Cofre cilíndrico com código rotativo de 4 letras alterável. Excelente para guardar joias, vales de oferta ou surpreender alguém num aniversário.',
    rating: 4.9,
    reviewCount: 22,
    order: 7
  },
  {
    id: 'prod-8',
    name: 'Base de Comando PS5 / Xbox Neon Edition',
    price: 16.90,
    imageUrl: 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&w=800&q=80',
    category: 'Gaming & Tech',
    description: 'Expositor para comando de consola com textura em relevo e design de duplo suporte. Compatível com DualSense, Xbox Wireless e Pro Controller.',
    rating: 4.8,
    reviewCount: 38,
    order: 8
  }
];

export const REVIEWS: Review[] = [
  { id: '1', rating: 5, date: '15/03/2026' },
  { id: '2', rating: 4, date: '10/03/2026' },
  { id: '3', rating: 5, date: '05/03/2026' },
  { id: '4', rating: 5, date: '01/03/2026' }
];
