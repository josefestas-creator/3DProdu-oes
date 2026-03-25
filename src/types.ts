export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  description: string;
  rating: number;
  reviewCount: number;
  images360?: string[]; // Array of images for 360 view
  triptychImages?: string[]; // Array of 3 images for triptych view
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Review {
  id: string;
  rating: number;
  date: string;
}

export type ViewState = 'landing' | 'login' | 'register' | 'profile' | 'shop' | 'cart' | 'product_detail' | 'reviews' | 'admin' | 'forgot_password';
