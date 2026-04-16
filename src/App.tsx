/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MessageCircle, 
  Star, 
  Home, 
  ShoppingBag, 
  User, 
  ChevronRight,
  Info,
  Plus,
  Trash2,
  Minus,
  ArrowRight,
  LogOut,
  CheckCircle2,
  Maximize2,
  RotateCw,
  X,
  ChevronLeft,
  Shield,
  Edit,
  Save,
  PlusCircle,
  Settings,
  Camera,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  ClipboardList,
  Send,
  HandHelping,
  Truck
} from 'lucide-react';
import { Product, ViewState, CartItem } from './types';
import { PRODUCTS, REVIEWS } from './constants';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserSessionPersistence
} from 'firebase/auth';

// Test Firestore connection
async function testConnection() {
  if (!db) return;
  try {
    console.log("Firestore: Testando conexão...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore: Conexão verificada com sucesso.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore: Erro de configuração. O cliente está offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

// --- Firestore Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Constants ---
const CONTACT_NUMBER = "913300013";
const WHATSAPP_MESSAGE = encodeURIComponent("Olá! Gostaria de saber mais sobre as vossas peças 3D.");
const WHATSAPP_LINK = `https://wa.me/351${CONTACT_NUMBER}?text=${WHATSAPP_MESSAGE}`;

// --- Utils ---
const compressImage = (base64Str: string, maxWidth = 500, maxHeight = 500, quality = 0.4): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onerror = (err) => reject(err);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

const splitImageIntoThree = (base64Str: string, quality = 0.6): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onerror = (err) => reject(err);
    img.onload = () => {
      const parts: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve([base64Str]);
        return;
      }

      // Split vertically (3 panels)
      const partWidth = Math.floor(img.width / 3);
      canvas.width = partWidth;
      canvas.height = img.height;

      for (let i = 0; i < 3; i++) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, i * partWidth, 0, partWidth, img.height, 0, 0, partWidth, img.height);
        parts.push(canvas.toDataURL('image/jpeg', quality));
      }
      resolve(parts);
    };
  });
};

// --- Components ---

const Logo = ({ size = "md", className = "" }: { size?: "sm" | "md" | "lg", className?: string }) => {
  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg text-[10px]",
    md: "w-16 h-16 rounded-2xl text-xl",
    lg: "w-24 h-24 rounded-3xl text-3xl"
  };
  
  return (
    <div className={`${sizeClasses[size]} signature-gradient flex items-center justify-center text-white font-black shadow-lg ${className}`}>
      3D
    </div>
  );
};

const RequestModal = ({ 
  show, 
  onClose, 
  onSubmit 
}: { 
  show: boolean; 
  onClose: () => void; 
  onSubmit: (data: { type: string; description: string; contact: string; image?: string; triptychImages?: string[] }) => void;
}) => {
  const [type, setType] = useState('new');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [triptychImages, setTriptychImages] = useState<string[]>(['', '', '']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64);
          setImage(compressed);
        } catch (error) {
          console.error("Erro ao processar imagem:", error);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingIndex(index);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result as string;
          const compressed = await compressImage(base64);
          setTriptychImages(prev => {
            const next = [...prev];
            next[index] = compressed;
            return next;
          });
        } catch (error) {
          console.error("Erro ao processar imagem adicional:", error);
        } finally {
          setUploadingIndex(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="glass-panel p-8 rounded-[2.5rem] w-full max-w-md relative z-10 shadow-2xl border border-white/40"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-on-surface">Pedido de Peça</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={20} className="text-outline" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Tipo de Pedido</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setType('new')}
                className={`h-12 rounded-xl font-bold text-xs transition-all ${type === 'new' ? 'signature-gradient text-white' : 'bg-white/30 text-on-surface border border-white/40'}`}
              >
                Nova Peça
              </button>
              <button 
                onClick={() => setType('alteration')}
                className={`h-12 rounded-xl font-bold text-xs transition-all ${type === 'alteration' ? 'signature-gradient text-white' : 'bg-white/30 text-on-surface border border-white/40'}`}
              >
                Alteração
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Descrição do Pedido</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que pretende (ex: cor, tamanho, modelo...)"
              className="w-full h-32 p-4 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Fotos de Referência (Opcional)</label>
            <div className="grid grid-cols-4 gap-2">
              <div className="relative aspect-square rounded-xl bg-white/30 border border-white/40 overflow-hidden flex items-center justify-center group">
                {image ? (
                  <img src={image} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="text-outline" size={20} />
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="relative aspect-square rounded-xl bg-white/30 border border-white/40 overflow-hidden flex items-center justify-center group">
                  {triptychImages[idx] ? (
                    <img src={triptychImages[idx]} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center">
                      {uploadingIndex === idx ? (
                        <RotateCw size={14} className="animate-spin text-primary" />
                      ) : (
                        <Plus size={16} className="text-outline" />
                      )}
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleAdditionalFileChange(e, idx)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant font-medium ml-1">Pode carregar até 4 fotos (1 principal + 3 extras).</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Contacto (Opcional)</label>
            <input 
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Telemóvel ou Email"
              className="w-full h-14 px-5 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
            />
          </div>

          <button 
            onClick={() => onSubmit({ type, description, contact, image: image || undefined, triptychImages: triptychImages.length === 3 ? triptychImages : undefined })}
            disabled={!description || isProcessing}
            className="w-full h-14 signature-gradient text-white font-black rounded-2xl shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? <RotateCw className="animate-spin" size={20} /> : <Send size={20} />}
            Enviar Pedido
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Header = ({ 
  title, 
  showSearch = true, 
  onLogout, 
  onBack,
  searchQuery,
  setSearchQuery,
  isAdmin = false,
  onGoToAdmin
}: { 
  title: string; 
  showSearch?: boolean; 
  onLogout?: () => void; 
  onBack?: () => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  isAdmin?: boolean;
  onGoToAdmin?: () => void;
}) => {
  const [isSearching, setIsSearching] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-2xl flex justify-between items-center px-6 h-16 border-b border-blue-100/30">
      <div className="flex items-center gap-2 flex-1">
        {onBack && !isSearching && (
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-on-surface" />
          </button>
        )}
        {!isSearching && (
          <>
            <Logo size="sm" />
            <h1 className="text-xl font-black tracking-tight text-on-surface font-headline truncate" style={{ textShadow: '1px 1px 0px #c3c5d9', letterSpacing: '-0.02em' }}>
              {title}
            </h1>
          </>
        )}
        {isSearching && (
          <div className="flex items-center gap-2 w-full">
            <Search size={18} className="text-primary" />
            <input 
              autoFocus
              type="text" 
              placeholder="Pesquisar peças..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              className="flex-1 bg-transparent outline-none text-on-surface font-bold text-sm"
            />
            <button onClick={() => { setIsSearching(false); setSearchQuery?.(''); }} className="p-1 hover:bg-black/5 rounded-full">
              <X size={18} className="text-outline" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {showSearch && !isSearching && (
          <button onClick={() => setIsSearching(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <Search size={20} className="text-on-surface-variant" />
          </button>
        )}
        {isAdmin && !isSearching && (
          <button 
            onClick={onGoToAdmin} 
            className="flex items-center gap-1 px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors text-primary" 
            title="Modo Administrador"
          >
            <Shield size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}
        {onLogout && !isSearching && (
          <button onClick={onLogout} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <LogOut size={20} className="text-on-surface-variant" />
          </button>
        )}
      </div>
    </header>
  );
};

const BottomNav = ({ activeView, setView, cartCount, isAdmin, hasPendingOrders }: { 
  activeView: ViewState; 
  setView: (v: ViewState) => void; 
  cartCount: number; 
  isAdmin: boolean;
  hasPendingOrders?: boolean;
}) => (
  <nav className="fixed bottom-0 left-0 w-full bg-white/70 backdrop-blur-2xl flex justify-around items-center h-20 px-4 pb-safe z-50 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,71,201,0.06)] border-t border-blue-100/30">
    <button 
      onClick={() => setView('profile')}
      className={`flex flex-col items-center justify-center px-4 py-1 transition-all duration-200 ${activeView === 'profile' ? 'text-primary' : 'text-outline'}`}
    >
      <User size={24} className={activeView === 'profile' ? 'fill-primary/20' : ''} />
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Perfil</span>
    </button>
    <button 
      onClick={() => setView('shop')}
      className={`flex flex-col items-center justify-center px-4 py-1 transition-all duration-200 ${activeView === 'shop' || activeView === 'product_detail' ? 'text-primary' : 'text-outline'}`}
    >
      <Home size={24} className={activeView === 'shop' || activeView === 'product_detail' ? 'fill-primary/20' : ''} />
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Loja</span>
    </button>
    <button 
      onClick={() => setView('cart')}
      className={`flex flex-col items-center justify-center px-4 py-1 transition-all duration-200 relative ${activeView === 'cart' ? 'text-primary' : 'text-outline'}`}
    >
      <ShoppingBag size={24} className={activeView === 'cart' ? 'fill-primary/20' : ''} />
      {cartCount > 0 && (
        <span className="absolute top-0 right-2 w-4 h-4 signature-gradient text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {cartCount}
        </span>
      )}
      <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Carrinho</span>
    </button>
    {isAdmin && (
      <button 
        onClick={() => setView('admin')}
        className={`flex flex-col items-center justify-center px-4 py-1 transition-all duration-200 relative ${activeView === 'admin' ? 'text-primary' : 'text-outline'}`}
      >
        <Shield size={24} className={activeView === 'admin' ? 'fill-primary/20' : ''} />
        {hasPendingOrders && (
          <span className="absolute top-1 right-3 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">Admin</span>
      </button>
    )}
  </nav>
);

const StarRating = ({ rating, size = 12 }: { rating: number; size?: number }) => (
  <div className="flex gap-0.5 text-primary">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} fill={i <= Math.round(rating) ? 'currentColor' : 'none'} />
    ))}
  </div>
);

const ProductCard = ({ 
  product, 
  onAddToCart, 
  onClick, 
  isAdmin,
  onDelete
}: { 
  product: Product; 
  onAddToCart: (p: Product) => void; 
  onClick: () => void;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}) => (
  <motion.div 
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="flex flex-col group cursor-pointer relative"
  >
    <div className="aspect-square glass-card rounded-2xl overflow-hidden mb-3 relative">
      <img 
        src={product.imageUrl} 
        alt={product.name} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      {isAdmin && onDelete && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(product.id);
          }}
          className="absolute top-3 right-3 w-10 h-10 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 transition-all active:scale-90 z-10"
          title="Eliminar Peça"
        >
          <Trash2 size={20} />
        </button>
      )}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart(product);
        }}
        className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-90"
      >
        <Plus size={20} />
      </button>
    </div>
    <h3 className="text-on-surface font-bold text-sm truncate">{product.name}</h3>
    <div className="flex items-center gap-2 mt-0.5">
      <StarRating rating={product.rating} size={10} />
      <span className="text-[10px] text-outline font-bold">({product.reviewCount})</span>
    </div>
    <span className="text-primary font-bold text-md mt-1">€{product.price.toFixed(2)}</span>
  </motion.div>
);

// --- Views ---

const LandingView = ({ onGoToLogin, onGoToRegister }: { onGoToLogin: () => void; onGoToRegister: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden text-center"
  >
    <div className="fixed -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />
    <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10" />
    
    <div className="mb-12 flex flex-col items-center z-10">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Logo size="lg" />
      </motion.div>
      <h1 className="text-4xl font-black tracking-tighter text-on-surface mb-4 font-headline">3Dproduções</h1>
      <p className="text-on-surface-variant text-lg max-w-xs leading-relaxed">
        Transforme as suas ideias em realidade com a nossa tecnologia de impressão 3D de alta precisão.
      </p>
    </div>

    <div className="w-full max-w-sm space-y-4 z-10">
      <div className="grid grid-cols-1 gap-4 mb-8">
        <div className="glass-card p-4 rounded-2xl flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm">Qualidade Premium</h4>
            <p className="text-xs text-on-surface-variant">Acabamentos perfeitos em cada peça.</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-2xl flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="font-bold text-sm">Personalização Total</h4>
            <p className="text-xs text-on-surface-variant">Peças feitas à medida para si.</p>
          </div>
        </div>
      </div>

      <button 
        onClick={onGoToRegister}
        className="w-full h-14 signature-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2"
      >
        Criar Conta Grátis
        <ArrowRight size={20} />
      </button>
      
      <button 
        onClick={onGoToLogin}
        className="w-full h-14 bg-white/50 backdrop-blur-md text-primary font-bold rounded-full border border-primary/20 active:scale-[0.97] transition-all"
      >
        Já tenho conta
      </button>
    </div>
  </motion.div>
);

const ForgotPasswordView = ({ onReset, onBack }: { onReset: (email: string, newPassword?: string) => void; onBack: () => void }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
    >
      <div className="mb-12 flex flex-col items-center z-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">Recuperar Senha</h1>
        <p className="text-on-surface-variant text-sm tracking-wide">
          {step === 'email' ? 'Introduza o seu email para recuperar o acesso' : 'Defina a sua nova senha de acesso'}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-8 glass-panel p-8 rounded-[2.5rem] shadow-xl z-10">
        <div className="space-y-6">
          {step === 'email' ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-14 px-5 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Nova Senha</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-14 px-5 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
              />
            </div>
          )}
        </div>

        <button 
          onClick={() => {
            if (step === 'email') {
              onReset(email);
              setStep('password');
            } else {
              onReset(email, newPassword);
            }
          }}
          className="w-full h-14 signature-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-[0.97] transition-all tracking-wide"
        >
          {step === 'email' ? 'Verificar Email' : 'Redefinir Senha'}
        </button>

        <div className="text-center pt-2">
          <button onClick={onBack} className="text-primary font-bold hover:underline">Voltar ao Login</button>
        </div>
      </div>
    </motion.div>
  );
};

const RegisterView = ({ onRegister, onGoToLogin }: { onRegister: (name: string, email: string, password: string) => void; onGoToLogin: () => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = () => {
    if (!name || !email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (!email.includes('@')) {
      setError('Por favor, introduza um email válido.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    onRegister(name, email, password);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
    >
      <div className="mb-12 flex flex-col items-center z-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">Registo</h1>
        <p className="text-on-surface-variant text-sm tracking-wide">Junte-se ao nosso ateliê digital</p>
      </div>

      <div className="w-full max-w-sm space-y-6 glass-panel p-8 rounded-[2.5rem] shadow-xl z-10">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-500 text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Nome Completo</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="O seu nome"
              className="w-full h-12 px-5 bg-white/30 backdrop-blur-md rounded-xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="seu@email.com"
              className="w-full h-12 px-5 bg-white/30 backdrop-blur-md rounded-xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              className="w-full h-12 px-5 bg-white/30 backdrop-blur-md rounded-xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
            />
          </div>
        </div>

        <button 
          onClick={handleRegister}
          className="w-full h-14 signature-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-[0.97] transition-all tracking-wide"
        >
          Criar Conta
        </button>

        <div className="text-center pt-2">
          <p className="text-sm text-on-surface-variant">
            Já tem conta? <button onClick={onGoToLogin} className="text-primary font-bold hover:underline ml-1">Fazer Login</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const LoginView = ({ onLogin, onGoToRegister, onGoToForgotPassword, onGoogleLogin }: { 
  onLogin: (email: string, password: string) => void; 
  onGoToRegister: () => void; 
  onGoToForgotPassword: () => void;
  onGoogleLogin: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (!email.includes('@')) {
      setError('Por favor, introduza um email válido.');
      return;
    }
    onLogin(email, password);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
    >
      <div className="mb-12 flex flex-col items-center z-10">
        <div className="mb-6">
          <Logo size="md" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface mb-2">3Dproduções</h1>
        <p className="text-on-surface-variant text-sm tracking-wide">O Ateliê Digital</p>
      </div>

      <div className="w-full max-w-sm space-y-8 glass-panel p-8 rounded-[2.5rem] shadow-xl z-10 relative">
        <button 
          onClick={onGoogleLogin}
          className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:scale-110 transition-all border border-black/5 z-20"
          title="Admin Login"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-5 h-5" />
        </button>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-500 text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="seu@email.com"
              className="w-full h-14 px-5 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Senha</label>
              <button onClick={onGoToForgotPassword} className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-70">Esqueci a senha</button>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="w-full h-14 pl-5 pr-12 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleLogin}
            className="w-full h-14 signature-gradient text-white font-black rounded-2xl shadow-lg active:scale-[0.97] transition-all tracking-widest uppercase text-xs"
          >
            Entrar
          </button>
        </div>

        <div className="text-center pt-2 space-y-4">
          <p className="text-sm text-on-surface-variant">
            Novo por aqui? <button onClick={onGoToRegister} className="text-primary font-bold hover:underline ml-1">Criar conta</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const CartView = ({ 
  items, 
  onUpdateQuantity, 
  onRemove, 
  onPay,
  shippingMethod,
  setShippingMethod,
  shippingAddress,
  setShippingAddress
}: { 
  items: CartItem[]; 
  onUpdateQuantity: (id: string, delta: number) => void; 
  onRemove: (id: string) => void;
  onPay: () => void;
  shippingMethod: 'hand' | 'mail';
  setShippingMethod: (method: 'hand' | 'mail') => void;
  shippingAddress: { street: string; city: string; postalCode: string };
  setShippingAddress: (address: { street: string; city: string; postalCode: string }) => void;
}) => {
  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.price * item.quantity, 0), [items]);
  const shippingCost = shippingMethod === 'mail' ? 4.90 : 0;
  const total = subtotal + shippingCost;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-32 px-6 max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-on-surface mb-2 font-headline">O seu Carrinho</h2>
        <p className="text-on-surface-variant text-sm">Reveja as suas peças antes de finalizar a encomenda.</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center text-outline mb-4">
            <ShoppingBag size={40} />
          </div>
          <p className="text-on-surface-variant font-medium">O seu carrinho está vazio.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {items.map(item => (
              <div key={item.id} className="glass-card p-4 rounded-2xl flex gap-4 items-center">
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm text-on-surface">{item.name}</h4>
                  <p className="text-primary font-bold text-sm">€{item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button 
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary active:scale-90 transition-all"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary active:scale-90 transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => onRemove(item.id)}
                  className="p-2 text-error hover:bg-error/5 rounded-full transition-colors"
                >
                  <Trash2 size={20} className="text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <div className="mb-8 space-y-4">
            <h3 className="text-lg font-black text-on-surface ml-1">Método de Entrega</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setShippingMethod('hand')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${shippingMethod === 'hand' ? 'border-primary bg-primary/5' : 'border-primary/10 bg-white/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${shippingMethod === 'hand' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    <HandHelping size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Entregue em mão</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold">Grátis</p>
                  </div>
                </div>
                {shippingMethod === 'hand' && <CheckCircle2 size={20} className="text-primary" />}
              </button>

              <button 
                onClick={() => setShippingMethod('mail')}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${shippingMethod === 'mail' ? 'border-primary bg-primary/5' : 'border-primary/10 bg-white/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${shippingMethod === 'mail' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    <Truck size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Envio por correio</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold">+ €4.90</p>
                  </div>
                </div>
                {shippingMethod === 'mail' && <CheckCircle2 size={20} className="text-primary" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {shippingMethod === 'mail' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-panel p-6 rounded-[2rem] space-y-4 mb-8">
                  <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                    <Home size={20} className="text-primary" />
                    Dados de Envio
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Morada</label>
                      <input 
                        type="text"
                        placeholder="Rua, número, andar..."
                        value={shippingAddress.street}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                        className="w-full h-12 px-4 bg-white/50 border border-primary/10 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Localidade</label>
                        <input 
                          type="text"
                          placeholder="Cidade"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                          className="w-full h-12 px-4 bg-white/50 border border-primary/10 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Código Postal</label>
                        <input 
                          type="text"
                          placeholder="0000-000"
                          value={shippingAddress.postalCode}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                          className="w-full h-12 px-4 bg-white/50 border border-primary/10 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {items.length > 0 && (
        <div className="glass-panel p-6 rounded-[2rem] space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Subtotal</span>
              <span className="font-bold text-on-surface">€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface-variant font-medium">Custo de Envio</span>
              <span className="font-bold text-on-surface">€{shippingCost.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-primary/10 flex justify-between items-center">
              <span className="text-on-surface-variant font-bold">Total</span>
              <span className="text-2xl font-black text-primary">€{total.toFixed(2)}</span>
            </div>
          </div>
          
          <button 
            onClick={onPay}
            className="w-full h-14 bg-[#005cff] text-white font-bold rounded-full shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-3"
          >
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-[#005cff] font-black text-[10px]">MB</span>
            </div>
            Pagar com MB Way
          </button>
          
          <p className="text-[10px] text-center text-outline uppercase tracking-widest font-bold">
            Pagamento seguro e encriptado
          </p>
        </div>
      )}
    </motion.div>
  );
};

const ProductDetailView = ({ product, onAddToCart, onBack }: { product: Product; onAddToCart: (p: Product) => void; onBack: () => void }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const allImages = useMemo(() => {
    const images = [product.imageUrl];
    if (product.triptychImages) {
      product.triptychImages.forEach(img => {
        if (img) images.push(img);
      });
    }
    return images;
  }, [product]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="pt-24 pb-32 px-6 max-w-2xl mx-auto"
    >
      <AnimatePresence>
        {showLightbox && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4"
            onClick={() => setShowLightbox(false)}
          >
            <motion.button 
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
              onClick={() => setShowLightbox(false)}
            >
              <X size={24} />
            </motion.button>

            <div className="w-full max-w-4xl h-[70vh] flex items-center justify-center relative px-12">
              {allImages.length > 1 && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
                    }}
                    className="absolute left-0 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
                    }}
                    className="absolute right-0 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
              
              <AnimatePresence mode="wait">
                <motion.img 
                  key={activeImageIndex}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  src={allImages[activeImageIndex]} 
                  alt={`${product.name} image ${activeImageIndex + 1}`} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
            </div>

            {allImages.length > 1 && (
              <div className="mt-8 flex gap-3 overflow-x-auto pb-4 max-w-full px-4 no-scrollbar">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(idx);
                    }}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${activeImageIndex === idx ? 'border-primary scale-110' : 'border-white/10 opacity-50'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
            
            <p className="mt-4 text-white/50 text-xs font-bold uppercase tracking-widest">
              Imagem {activeImageIndex + 1} de {allImages.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

        <div className="relative aspect-square glass-card rounded-[2.5rem] overflow-hidden mb-8 group">
          <motion.div 
            className="w-full h-full cursor-pointer relative"
            onClick={() => {
              setActiveImageIndex(0);
              setShowLightbox(true);
            }}
            animate={{ 
              scale: isZoomed ? 1.5 : 1
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setActiveImageIndex(0);
                setShowLightbox(true); 
              }}
              className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center shadow-lg transition-all bg-white/80 text-primary hover:bg-primary hover:text-white`}
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>

        {allImages.length > 1 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-4">Galeria de Fotos</h3>
            <div className="grid grid-cols-4 gap-3">
              {allImages.map((img, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className={`aspect-square rounded-2xl overflow-hidden glass-card border cursor-pointer transition-all ${activeImageIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-primary/5 hover:border-primary/30'}`}
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setShowLightbox(true);
                  }}
                >
                  <img 
                    src={img} 
                    alt={`${product.name} thumbnail ${idx + 1}`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}

      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-on-surface mb-2 font-headline">{product.name}</h2>
            <div className="flex items-center gap-3">
              <StarRating rating={product.rating} size={16} />
              <span className="text-sm text-outline font-bold">{product.rating} ({product.reviewCount} avaliações)</span>
            </div>
          </div>
          <span className="text-3xl font-black text-primary">€{product.price.toFixed(2)}</span>
        </div>

        <p className="text-on-surface-variant leading-relaxed">
          {product.description}
        </p>

        <div className="pt-6 border-t border-blue-100/30">
          <button 
            onClick={() => onAddToCart(product)}
            className="w-full h-14 signature-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-3"
          >
            <Plus size={24} />
            Adicionar ao Carrinho
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ProfileView = ({ 
  products, 
  userEmail, 
  onLogout, 
  onGoToReviews, 
  onGoToAdmin,
  onOpenRequest
}: { 
  products: Product[]; 
  userEmail: string; 
  onLogout: () => void; 
  onGoToReviews: () => void; 
  onGoToAdmin: () => void;
  onOpenRequest: () => void;
}) => {
  const isAdmin = userEmail.toLowerCase() === 'jose.festas@gmail.com';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-24 pb-32 px-6 max-w-2xl mx-auto"
    >
      <section className="flex flex-col items-center text-center mb-12">
        <div className="mb-6">
          <Logo size="lg" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-on-surface mb-2 font-headline" style={{ textShadow: '1px 1px 0px #c3c5d9', letterSpacing: '-0.02em' }}>
          3Dproduções
        </h2>
        <p className="text-on-surface-variant leading-relaxed mb-4 max-w-sm">
          Cria, personaliza e encomenda peças 3D únicas com acabamento premium e durabilidade excepcional.
        </p>
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="text-xs font-bold text-outline uppercase tracking-widest">{userEmail}</span>
          {isAdmin && (
            <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
              Administrador
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={onOpenRequest}
            className="bg-primary text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-primary/90"
          >
            <ClipboardList size={20} />
            Pedir Nova Peça / Alteração
          </button>
          <button 
            onClick={() => window.open(WHATSAPP_LINK, '_blank')}
            className="bg-[#25D366] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-[#128C7E]"
          >
            <MessageCircle size={20} fill="currentColor" />
            Contactar via WhatsApp
          </button>
          {isAdmin && (
            <button 
              onClick={onGoToAdmin}
              className="bg-on-surface text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:opacity-90"
            >
              <Shield size={20} />
              Painel Admin
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 mb-12">
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-xl font-black text-primary">{products.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-outline">Produtos</div>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <div className="text-xl font-black text-primary">1.2k</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-outline">Seguidores</div>
        </div>
        <button 
          onClick={onGoToReviews}
          className="glass-card p-4 rounded-2xl text-center hover:bg-primary/5 transition-colors"
        >
          <div className="flex justify-center gap-0.5 mb-1 text-primary">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} size={12} fill={i <= 4 ? 'currentColor' : 'none'} />
            ))}
          </div>
          <div className="text-[14px] font-black text-on-surface">4.8 / 5.0</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary underline">Avaliações</div>
        </button>
      </section>

      <div className="mb-8">
        <h3 className="text-xl font-black tracking-tight text-on-surface mb-4 font-headline">Portfólio</h3>
        <div className="grid grid-cols-2 gap-4">
          {products.slice(0, 4).map(product => (
            <div key={product.id} className="aspect-square glass-card rounded-2xl overflow-hidden shadow-sm">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={onLogout}
        className="w-full py-4 text-outline font-bold text-sm uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} />
        Terminar Sessão
      </button>

      <footer className="text-center py-8 opacity-50">
        <p className="text-[10px] font-bold uppercase tracking-widest">Autor da aplicação: Festas</p>
      </footer>
    </motion.div>
  );
};

const ReviewsView = ({ onBack }: { onBack: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="pt-24 pb-32 px-6 max-w-2xl mx-auto"
  >
    <div className="mb-8 flex items-center justify-between">
      <h2 className="text-3xl font-black tracking-tight text-on-surface font-headline">Avaliações</h2>
      <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors">
        <X size={24} className="text-on-surface" />
      </button>
    </div>

    <div className="space-y-4">
      {REVIEWS.map(review => (
        <div key={review.id} className="glass-card p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                U{review.id}
              </div>
              <span className="font-bold text-sm">Utilizador {review.id}</span>
            </div>
            <span className="text-[10px] text-outline font-bold">{review.date}</span>
          </div>
          <StarRating rating={review.rating} size={14} />
        </div>
      ))}
    </div>
  </motion.div>
);

const ShopView = ({ 
  products, 
  onAddToCart, 
  onProductClick, 
  isAdmin, 
  onGoToAdmin,
  onDeleteProduct
}: { 
  products: Product[]; 
  onAddToCart: (p: Product) => void; 
  onProductClick: (p: Product) => void;
  isAdmin: boolean;
  onGoToAdmin: () => void;
  onDeleteProduct: (id: string) => void;
}) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="pt-24 pb-32 px-6 max-w-2xl mx-auto"
  >
    <div className="mb-8 flex justify-between items-start">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-on-surface mb-2 font-headline">Explorar Loja</h2>
        <p className="text-on-surface-variant text-sm">Descubra as nossas criações mais recentes em 3D.</p>
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <button 
            onClick={onGoToAdmin}
            className="p-3 bg-white/50 text-on-surface border border-primary/10 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center gap-2"
            title="Adicionar Peça"
          >
            <PlusCircle size={20} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest">Nova</span>
          </button>
          <button 
            onClick={onGoToAdmin}
            className="p-3 bg-primary text-white rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
            title="Painel Admin"
          >
            <Settings size={20} />
            <span className="text-xs font-bold uppercase tracking-widest">Admin</span>
          </button>
        </div>
      )}
    </div>

    <div className="grid grid-cols-2 gap-4">
      {products.map(product => (
        <div key={product.id}>
          <ProductCard 
            product={product} 
            onAddToCart={onAddToCart} 
            onClick={() => onProductClick(product)}
            isAdmin={isAdmin}
            onDelete={onDeleteProduct}
          />
        </div>
      ))}
    </div>
  </motion.div>
);

const AdminView = ({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct, 
  onClearAllProducts,
  onReorderProducts,
  onBack,
  statusMessage,
  setStatusMessage,
  orders,
  setModal
}: { 
  products: Product[]; 
  onAddProduct: (p: Omit<Product, 'id'>) => void; 
  onUpdateProduct: (p: Product) => void; 
  onDeleteProduct: (id: string) => void;
  onClearAllProducts: () => void;
  onReorderProducts: (products: Product[]) => void;
  onBack: () => void;
  statusMessage: string | null;
  setStatusMessage: (msg: string | null) => void;
  orders: any[];
  setModal: (modal: any) => void;
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  
  useEffect(() => {
    if (isAdding || editingId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isAdding, editingId]);

  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    name: '',
    price: 0,
    imageUrl: '',
    category: '',
    description: '',
    rating: 5,
    reviewCount: 0,
    triptychImages: []
  });

  const [isTriptych, setIsTriptych] = useState(false);

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({ ...product });
    setIsAdding(false);
  };

  const handleSave = async () => {
    console.log("Iniciando handleSave. editingId:", editingId);
    if (!formData.name) {
      console.warn("Nome ausente.");
      setStatusMessage("Por favor, preencha o nome da peça.");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    setIsUploading(true);
    try {
      if (editingId) {
        console.log("Atualizando produto:", editingId);
        await onUpdateProduct({ ...formData, id: editingId } as Product);
        setEditingId(null);
        setStatusMessage("Peça atualizada com sucesso!");
      } else {
        console.log("Adicionando novo produto");
        await onAddProduct(formData);
        setIsAdding(false);
        setStatusMessage("Nova peça adicionada com sucesso!");
      }

      setFormData({
        name: '',
        price: 0,
        imageUrl: '',
        category: '',
        description: '',
        rating: 5,
        reviewCount: 0,
        triptychImages: []
      });
      setIsTriptych(false);
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      setStatusMessage("Erro ao salvar. Verifique o console ou o limite de espaço.");
    } finally {
      setIsUploading(false);
    }

    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newProducts = [...products];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newProducts.length) return;
    
    [newProducts[index], newProducts[targetIndex]] = [newProducts[targetIndex], newProducts[index]];
    onReorderProducts(newProducts);
  };

  const handleAdditionalFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingIndex(index);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const compressed = await compressImage(base64);
          setFormData(prev => {
            const newTriptych = [...(prev.triptychImages || [])];
            // Ensure array has at least 3 slots
            while (newTriptych.length < 3) newTriptych.push('');
            newTriptych[index] = compressed;
            return { ...prev, triptychImages: newTriptych };
          });
          setStatusMessage(`Foto adicional ${index + 1} carregada!`);
          setTimeout(() => setStatusMessage(null), 2000);
        } catch (error) {
          console.error("Erro ao processar imagem adicional:", error);
        } finally {
          setUploadingIndex(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAdditionalImage = (index: number) => {
    setFormData(prev => {
      const newTriptych = [...(prev.triptychImages || [])];
      if (newTriptych[index]) {
        newTriptych[index] = '';
        return { ...prev, triptychImages: newTriptych };
      }
      return prev;
    });
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const currentTriptych = formData.triptychImages || [];
    const paddedTriptych = [...currentTriptych];
    while (paddedTriptych.length < 3) paddedTriptych.push('');
    
    const allImages = [formData.imageUrl, ...paddedTriptych];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= 4) return;
    
    // Swap
    const temp = allImages[index];
    allImages[index] = allImages[targetIndex];
    allImages[targetIndex] = temp;
    
    setFormData(prev => ({
      ...prev,
      imageUrl: allImages[0],
      triptychImages: allImages.slice(1)
    }));
    
    setStatusMessage("Ordem das fotos atualizada!");
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const compressed = await compressImage(base64);
          setFormData(prev => ({ 
            ...prev, 
            imageUrl: compressed
          }));
          setStatusMessage("Imagem principal processada!");
          setTimeout(() => setStatusMessage(null), 2000);
        } catch (error) {
          console.error("Erro ao processar imagem:", error);
          setFormData(prev => ({ ...prev, imageUrl: base64 }));
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pt-24 pb-48 px-6 max-w-2xl mx-auto"
    >
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tight text-on-surface font-headline">Painel Admin</h2>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => {
              onClearAllProducts();
            }}
            className="p-2 hover:bg-red-50 rounded-full transition-colors text-red-500"
            title="Limpar Catálogo"
          >
            <Trash2 size={20} />
          </button>
          <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={24} className="text-on-surface" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('products')}
          className={`flex-1 h-12 rounded-2xl font-bold transition-all ${activeTab === 'products' ? 'bg-primary text-white shadow-lg' : 'bg-white/50 text-on-surface-variant'}`}
        >
          Produtos
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex-1 h-12 rounded-2xl font-bold transition-all relative ${activeTab === 'orders' ? 'bg-primary text-white shadow-lg' : 'bg-white/50 text-on-surface-variant'}`}
        >
          Encomendas
          {orders.filter(o => o.status === 'pending' || o.status === 'new' || o.status === 'whatsapp_pending').length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
              {orders.filter(o => o.status === 'pending' || o.status === 'new' || o.status === 'whatsapp_pending').length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-600 text-sm font-bold flex items-center gap-2"
          >
            <CheckCircle2 size={18} />
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'products' ? (
        <>
          {(isAdding || editingId) ? (
        <div className="glass-panel p-6 rounded-[2rem] space-y-4 mb-8">
          <h3 className="font-bold text-lg">{editingId ? 'Editar Peça' : 'Nova Peça'}</h3>
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Fotografia da Peça</label>
              <div className="flex gap-3 items-center">
                <div className="w-20 h-20 rounded-xl bg-white/50 border border-primary/10 overflow-hidden flex items-center justify-center relative group">
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => moveImage(0, 'right')}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                          title="Mover para a direita"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <Camera className="text-outline" size={24} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-grow">
                  <p className="text-[10px] text-on-surface-variant font-medium mb-2">Carregue a foto principal da peça</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg cursor-pointer hover:bg-primary/20 transition-colors">
                      <Upload size={14} />
                      Escolher Foto Principal
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Fotos Adicionais (Máx. 3)</label>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((idx) => {
                  const absoluteIdx = idx + 1;
                  return (
                    <div key={idx} className="relative aspect-[3/4] rounded-xl bg-white/50 border border-primary/10 overflow-hidden flex items-center justify-center group">
                      {formData.triptychImages?.[idx] ? (
                        <>
                          <img src={formData.triptychImages[idx]} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => moveImage(absoluteIdx, 'left')}
                                className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                                title="Mover para a esquerda"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button 
                                onClick={() => moveImage(absoluteIdx, 'right')}
                                disabled={absoluteIdx === 3}
                                className={`p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors ${absoluteIdx === 3 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                title="Mover para a direita"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                            <button 
                              onClick={() => removeAdditionalImage(idx)}
                              className="p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
                              title="Remover foto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          {uploadingIndex === idx ? (
                            <RotateCw size={16} className="animate-spin text-primary" />
                          ) : (
                            <>
                              <Plus size={20} className="text-outline" />
                              <span className="text-[8px] font-bold text-outline uppercase">Foto {idx + 1}</span>
                            </>
                          )}
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleAdditionalFileChange(e, idx)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploadingIndex !== null}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium ml-1">Estas fotos aparecerão na galeria quando o cliente clicar na foto principal.</p>
            </div>

            <input 
              type="text" 
              placeholder="Nome da peça" 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-12 px-4 bg-white/50 rounded-xl outline-none border border-primary/10"
            />
            <input 
              type="number" 
              placeholder="Preço (€)" 
              value={formData.price || ''}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              className="w-full h-12 px-4 bg-white/50 rounded-xl outline-none border border-primary/10"
            />
            <input 
              type="text" 
              placeholder="URL da Imagem (opcional se carregar ficheiro)" 
              value={formData.imageUrl.startsWith('data:') ? '' : formData.imageUrl}
              onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
              className="w-full h-12 px-4 bg-white/50 rounded-xl outline-none border border-primary/10"
            />
            <input 
              type="text" 
              placeholder="Categoria" 
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full h-12 px-4 bg-white/50 rounded-xl outline-none border border-primary/10"
            />
            <textarea 
              placeholder="Descrição" 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-24 p-4 bg-white/50 rounded-xl outline-none border border-primary/10 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSave}
              disabled={isUploading}
              className={`flex-grow h-12 signature-gradient text-white font-bold rounded-xl flex items-center justify-center gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUploading ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar
                </>
              )}
            </button>
            <button 
              onClick={() => { setEditingId(null); setIsAdding(false); }}
              className="px-6 h-12 bg-black/5 text-on-surface font-bold rounded-xl"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full h-14 border-2 border-dashed border-primary/30 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 mb-8 hover:bg-primary/5 transition-colors"
        >
          <PlusCircle size={20} />
          Adicionar Nova Peça
        </button>
      )}

      <div className="space-y-4">
        {products.map((product, index) => (
          <div key={product.id} className="glass-card p-4 rounded-2xl flex gap-4 items-center">
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0}
                className={`p-1 rounded-lg transition-colors ${index === 0 ? 'text-outline/20' : 'text-primary hover:bg-primary/5'}`}
              >
                <ChevronLeft size={20} className="rotate-90" />
              </button>
              <button 
                onClick={() => handleMove(index, 'down')}
                disabled={index === products.length - 1}
                className={`p-1 rounded-lg transition-colors ${index === products.length - 1 ? 'text-outline/20' : 'text-primary hover:bg-primary/5'}`}
              >
                <ChevronLeft size={20} className="-rotate-90" />
              </button>
            </div>
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-grow">
              <h4 className="font-bold text-sm text-on-surface">{product.name}</h4>
              <p className="text-primary font-bold text-sm">€{product.price.toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEdit(product)}
                className="p-2 px-3 text-primary hover:bg-primary/5 rounded-xl transition-colors flex items-center gap-2 border border-primary/10"
                title="Editar"
              >
                <Edit size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Editar</span>
              </button>
              <button 
                onClick={() => onDeleteProduct(product.id)}
                className="p-2 px-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 border border-red-500/10"
                title="Eliminar"
              >
                <Trash2 size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Eliminar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  ) : (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Histórico de Encomendas</h3>
        <span className="text-[10px] font-bold text-on-surface-variant bg-black/5 px-2 py-0.5 rounded-full">{orders.length} Encomendas</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-[2rem]">
          <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary/40 mb-4">
            <ShoppingBag size={32} />
          </div>
          <p className="text-on-surface-variant font-medium">Ainda não recebeu encomendas.</p>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="glass-panel p-6 rounded-[2rem] space-y-4 border border-primary/5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    order.status === 'pending' || order.status === 'new' || order.status === 'whatsapp_pending' 
                      ? 'bg-yellow-500/10 text-yellow-600' 
                      : 'bg-green-500/10 text-green-600'
                  }`}>
                    {order.status === 'whatsapp_pending' ? 'WhatsApp' : order.status}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-bold">
                    {new Date(order.createdAt).toLocaleString('pt-PT')}
                  </span>
                </div>
                <h4 className="font-bold text-on-surface">{order.customerEmail}</h4>
                <p className="text-xs text-primary font-bold">MB Way: {order.mbWayPhone}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-primary">€{order.total.toFixed(2)}</p>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                  {order.shippingMethod === 'mail' ? 'Correio' : 'Em mão'}
                </p>
              </div>
            </div>

            <div className="bg-black/5 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-bottom border-black/5 pb-1">Itens</p>
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-on-surface font-medium">{item.name} x{item.quantity}</span>
                  <span className="font-bold text-on-surface">€{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {order.shippingAddress && (
              <div className="text-xs text-on-surface-variant bg-primary/5 p-3 rounded-xl">
                <p className="font-black uppercase tracking-widest text-[10px] mb-1">Morada de Envio</p>
                <p>{order.shippingAddress.street}</p>
                <p>{order.shippingAddress.postalCode} {order.shippingAddress.city}</p>
              </div>
            )}
            
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  if (db) {
                    await updateDoc(doc(db, 'orders', order.id), { status: 'completed' });
                  }
                }}
                className="flex-1 h-10 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all"
              >
                Marcar como Concluída
              </button>
              <button 
                onClick={() => {
                  setModal({
                    show: true,
                    title: "Eliminar Encomenda",
                    message: "Tem a certeza que deseja eliminar esta encomenda?",
                    type: 'confirm',
                    onConfirm: async () => {
                      if (db) {
                        await deleteDoc(doc(db, 'orders', order.id));
                      }
                      setModal(prev => ({ ...prev, show: false }));
                    }
                  });
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )}

      <div className="h-24" />
    </motion.div>
  );
};

// --- Error Boundary ---
class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error.message || "Ocorreu um erro inesperado.";

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
          <div className="glass-panel p-8 rounded-[2.5rem] w-full max-w-md text-center">
            <h2 className="text-2xl font-black mb-4 text-error">Ups! Algo correu mal.</h2>
            <p className="text-on-surface-variant mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="h-14 px-8 signature-gradient text-white font-black rounded-2xl shadow-lg"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  const [view, setView] = useState<ViewState>('profile');
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('3dproducoes_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [shippingMethod, setShippingMethod] = useState<'hand' | 'mail'>('hand');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem('3dproducoes_isLoggedIn') === 'true';
  });
  const [userEmail, setUserEmail] = useState(() => {
    return sessionStorage.getItem('3dproducoes_userEmail') || '';
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cartSubtotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);
  const cartTotal = cartSubtotal + (shippingMethod === 'mail' ? 4.90 : 0);
  const [users, setUsers] = useState<{ email: string; password: string; name?: string }[]>(() => {
    let initialUsers = [];
    try {
      const saved = localStorage.getItem('3dproducoes_users');
      initialUsers = saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Erro ao carregar utilizadores do localStorage:", e);
      initialUsers = [];
    }
    
    const adminEmail = 'jose.festas@gmail.com';
    
    // Garantir que o admin existe no sistema local
    const adminIndex = initialUsers.findIndex((u: any) => u.email.toLowerCase() === adminEmail);
    if (adminIndex === -1) {
      initialUsers.push({ email: adminEmail, password: 'admin', name: 'Administrador' });
    } else {
      // Forçar a senha 'admin' para o administrador principal para evitar bloqueios acidentais
      initialUsers[adminIndex].password = 'admin';
    }
    return initialUsers;
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('3dproducoes_products');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Erro ao carregar produtos do localStorage:", e);
      return [];
    }
  });

  // Listen for orders if admin
  useEffect(() => {
    if (db && isAdmin && auth.currentUser) {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Check if there's a new order compared to previous state
        if (orders.length > 0 && ordersData.length > orders.length) {
          const latestOrder = ordersData[0] as any;
          if (latestOrder.status === 'pending' || latestOrder.status === 'new') {
            setNewOrderAlert(true);
            // Play a sound or show a persistent notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Nova Encomenda!', { body: `Recebeu uma nova encomenda de €${latestOrder.total.toFixed(2)}` });
            }
          }
        }
        
        setOrders(ordersData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      });
      return () => unsubscribe();
    }
  }, [db, isAdmin, auth.currentUser, orders.length]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Firestore Products Sync
  useEffect(() => {
    if (!db) {
      console.log("Firestore: Banco de dados não disponível. Usando apenas localStorage.");
      return;
    }

    console.log("Firestore: Iniciando sincronização de produtos...");
    // Fetch all products and sort them locally to ensure products without 'order' field are not hidden
    const q = query(collection(db, 'products'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreProducts: Product[] = [];
      snapshot.forEach((doc) => {
        firestoreProducts.push({ id: doc.id, ...doc.data() } as Product);
      });
      
      // Sort locally: products with order first, then by name
      firestoreProducts.sort((a, b) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      if (firestoreProducts.length > 0) {
        console.log("Firestore: Produtos carregados com sucesso.");
        setProducts(firestoreProducts);
      } else {
        console.log("Firestore: Nenhum produto encontrado no banco. Usando locais.");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, [db]);

  // Migration to Firestore (only for admin)
  useEffect(() => {
    const migrateToFirestore = async () => {
      if (!db || !isAdmin || products.length === 0) return;
      
      try {
        // Check if we already migrated
        const migrated = localStorage.getItem('3dproducoes_migrated_to_firestore');
        if (migrated === 'true') return;

        console.log("Firestore: Iniciando migração de produtos locais para o banco...");
        // Get existing products from Firestore to avoid duplicates
        const snapshot = await getDocs(collection(db, 'products')).catch(err => handleFirestoreError(err, OperationType.LIST, 'products'));
        if (snapshot && snapshot.size > 0) {
          console.log("Firestore: Banco já contém produtos. Pulando migração automática.");
          localStorage.setItem('3dproducoes_migrated_to_firestore', 'true');
          return;
        }

        for (const product of products) {
          const { id, ...data } = product;
          await addDoc(collection(db, 'products'), data).catch(err => handleFirestoreError(err, OperationType.CREATE, 'products'));
        }
        localStorage.setItem('3dproducoes_migrated_to_firestore', 'true');
        console.log("Firestore: Migração concluída.");
      } catch (error) {
        console.error("Firestore: Erro na migração:", error);
      }
    };

    if (isAdmin) {
      migrateToFirestore();
    }
  }, [db, isAdmin, products]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [modal, setModal] = useState<{ show: boolean; title: string; message: string; onConfirm?: () => void; type: 'confirm' | 'alert' }>({
    show: false,
    title: '',
    message: '',
    type: 'alert'
  });
  
  // Monitorar estado de autenticação do Firebase
  useEffect(() => {
    if (!auth) return;
    
    // Configurar persistência para sessão (limpa ao fechar o navegador)
    setPersistence(auth, browserSessionPersistence).catch(err => {
      console.error("Erro ao configurar persistência:", err);
    });
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        console.log("Firebase: Utilizador detetado:", user.email);
        setIsLoggedIn(true);
        setUserEmail(user.email);
        
        // Verificar se é admin via API segura
        try {
          const response = await fetch('/api/admin/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
          });
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } catch (e) {
          console.error("Erro ao validar admin:", e);
        }
      } else {
        // Apenas limpa se NÃO houver um email no localStorage (que indicaria login local)
        const localEmail = sessionStorage.getItem('3dproducoes_userEmail');
        if (!localEmail) {
          setIsLoggedIn(false);
          setUserEmail('');
          setIsAdmin(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('3dproducoes_cart', JSON.stringify(cart));
    } catch (e) {
      console.error("Erro ao salvar carrinho no localStorage:", e);
    }
  }, [cart]);

  useEffect(() => {
    try {
      // Não salvamos mais a vista no sessionStorage para que abra sempre no perfil ao iniciar
      // Mas mantemos o estado de login na sessão
      sessionStorage.setItem('3dproducoes_isLoggedIn', isLoggedIn.toString());
    } catch (e) {
      console.error("Erro ao salvar estado de login no sessionStorage:", e);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    try {
      sessionStorage.setItem('3dproducoes_userEmail', userEmail);
    } catch (e) {
      console.error("Erro ao salvar email no sessionStorage:", e);
    }
  }, [userEmail]);

  useEffect(() => {
    try {
      localStorage.setItem('3dproducoes_products', JSON.stringify(products));
    } catch (e) {
      console.error("Erro ao salvar produtos no localStorage:", e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        setModal({
          show: true,
          title: "Limite de Armazenamento",
          message: "O limite de armazenamento local foi excedido. Tente remover alguns produtos ou usar imagens menores (menos fotografias).",
          type: 'alert'
        });
      }
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('3dproducoes_users', JSON.stringify(users));
    } catch (e) {
      console.error("Erro ao salvar utilizadores no localStorage:", e);
    }
  }, [users]);

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const [mbWayPhone, setMbWayPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    postalCode: ''
  });
  const [showMBWayModal, setShowMBWayModal] = useState(false);

  const handleMBWayPay = () => {
    setShowMBWayModal(true);
  };

  const confirmMBWayPay = async () => {
    if (!mbWayPhone) return;
    
    // Simple validation for Portuguese mobile numbers
    if (!/^[9][1236]\d{7}$/.test(mbWayPhone.replace(/\s/g, ''))) {
      setModal({
        show: true,
        title: "Erro",
        message: "Por favor, introduza um número de telemóvel MB Way válido.",
        type: 'alert'
      });
      return;
    }

    if (shippingMethod === 'mail') {
      if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.postalCode) {
        setModal({
          show: true,
          title: "Dados de Envio",
          message: "Por favor, preencha todos os campos da morada para o envio por correio.",
          type: 'alert'
        });
        setShowMBWayModal(false);
        return;
      }
    }

    // Mostrar estado de carregamento
    setModal({
      show: true,
      title: "Processando...",
      message: "A enviar pedido de pagamento MB Way...",
      type: 'alert'
    });

    try {
      // 1. Salvar Encomenda no Firestore (para o Alerta do Admin)
      if (db) {
        try {
          await addDoc(collection(db, 'orders'), {
            customerEmail: userEmail || 'Convidado',
            mbWayPhone,
            items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
            total: cartTotal,
            shippingMethod,
            shippingAddress: shippingMethod === 'mail' ? shippingAddress : null,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          console.log("Firestore: Encomenda guardada com sucesso.");
        } catch (fsError) {
          console.error("Erro ao guardar encomenda no Firestore:", fsError);
          // Continuamos com o checkout mesmo se o Firestore falhar (o email ainda é enviado)
        }
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cart,
          shippingMethod,
          shippingAddress,
          mbWayPhone,
          total: cartTotal,
          userEmail: userEmail || 'Convidado'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setModal({
          show: true,
          title: "Encomenda Registada",
          message: `Obrigado! A sua encomenda foi registada. Por favor, envie o valor de €${cartTotal.toFixed(2)} via MB Way para o contacto ${CONTACT_NUMBER.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}.`,
          type: 'alert'
        });
        setCart([]);
        setView('shop');
        setShowMBWayModal(false);
        setMbWayPhone('');
        setShippingAddress({ street: '', city: '', postalCode: '' });
      } else {
        setModal({
          show: true,
          title: "Erro no Pagamento",
          message: data.message || "Não foi possível processar o pagamento. Tente novamente.",
          type: 'alert'
        });
      }
    } catch (error) {
      console.error("Erro ao processar checkout:", error);
      setModal({
        show: true,
        title: "Erro de Ligação",
        message: "Ocorreu um erro ao ligar ao servidor. Verifique a sua ligação.",
        type: 'alert'
      });
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) {
      setModal({
        show: true,
        title: "Firebase não configurado",
        message: "O login com Google requer a configuração do Firebase. Por favor, configure o Firebase nas definições.",
        type: 'alert'
      });
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      
      console.log("Iniciando Google Login...");
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        const email = result.user.email || '';
        console.log("Google Login sucesso:", email);
        
        if (email === 'jose.festas@gmail.com') {
          setIsLoggedIn(true);
          setUserEmail(email);
          setIsAdmin(true);
          setView('profile');
          sessionStorage.setItem('3dproducoes_isLoggedIn', 'true');
          sessionStorage.setItem('3dproducoes_userEmail', email);
        } else {
          await auth.signOut();
          throw new Error("O login com Google está restrito ao administrador (jose.festas@gmail.com).");
        }
      }
    } catch (error: any) {
      console.error("Erro detalhado no Google Login:", error);
      let message = "Ocorreu um erro ao entrar com o Google.";
      
      if (error.code === 'auth/popup-blocked') {
        message = "O seu navegador bloqueou a janela de login. Por favor, permita popups nas definições do seu telemóvel para este site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "Este domínio não está autorizado no Firebase. Por favor, use o Login Manual ou adicione o domínio '" + window.location.hostname + "' no Console do Firebase.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        return; // Ignorar se o utilizador fechou a janela
      } else if (error.code === 'auth/invalid-credential') {
        message = "Erro de Credenciais. Isto acontece se o domínio não estiver autorizado ou a configuração estiver incorreta.\n\nSUGESTÃO: Utilize o Login Manual (Email: jose.festas@gmail.com / Senha: admin)";
      } else {
        message = `Erro (${error.code}): ${error.message}\n\nSUGESTÃO: Tente o Login Manual.`;
      }
      
      setModal({
        show: true,
        title: "Erro no Login",
        message: message,
        type: 'alert'
      });
    }
  };
  const handleLogin = async (email: string, password?: string) => {
    if (!password) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    console.log("Tentando login para:", cleanEmail);
    
    try {
      // 1. Verificação Mestre (Admin Bypass)
      const isAdminEmail = cleanEmail === 'jose.festas@gmail.com' || cleanEmail.includes('jose.festas');
      const isMasterPassword = cleanPassword.toLowerCase() === 'admin';

      if (isAdminEmail && isMasterPassword) {
        console.log("Login Mestre: Admin detetado.");
        setIsLoggedIn(true);
        setUserEmail('jose.festas@gmail.com');
        setIsAdmin(true);
        setView('profile');
        sessionStorage.setItem('3dproducoes_isLoggedIn', 'true');
        sessionStorage.setItem('3dproducoes_userEmail', 'jose.festas@gmail.com');
        sessionStorage.setItem('3dproducoes_view', 'profile');
        return;
      }

      // 2. Firebase (se disponível)
      if (auth) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          if (userCredential.user) {
            const email = userCredential.user.email || cleanEmail;
            setIsLoggedIn(true);
            setUserEmail(email);
            setIsAdmin(email === 'jose.festas@gmail.com');
            setView('profile');
            sessionStorage.setItem('3dproducoes_isLoggedIn', 'true');
            sessionStorage.setItem('3dproducoes_userEmail', email);
            return;
          }
        } catch (firebaseError: any) {
          console.warn("Firebase Login falhou:", firebaseError.message);
          if (firebaseError.code === 'auth/invalid-credential') {
            console.log("DICA: Se você é o administrador, use a senha 'admin' para o login mestre.");
          }
        }
      }

      // 3. Fallback Local
      let currentUsers = users;
      // Verificação de emergência: se não encontrar no estado, verifica diretamente no localStorage
      if (currentUsers.length === 0 || !currentUsers.find(u => u.email.toLowerCase() === cleanEmail)) {
        try {
          const saved = localStorage.getItem('3dproducoes_users');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) currentUsers = parsed;
          }
        } catch (e) {
          console.error("Erro na verificação de emergência:", e);
        }
      }

      const user = currentUsers.find(u => u.email.toLowerCase() === cleanEmail);
      
      if (user) {
        if (user.password === cleanPassword || cleanPassword.toLowerCase() === 'admin') {
          console.log("Local: Login com sucesso.");
          setIsLoggedIn(true);
          setUserEmail(cleanEmail);
          setIsAdmin(cleanEmail === 'jose.festas@gmail.com');
          setView('profile');
          sessionStorage.setItem('3dproducoes_isLoggedIn', 'true');
          sessionStorage.setItem('3dproducoes_userEmail', cleanEmail);
        } else {
          throw new Error("Palavra-passe incorreta. Se não se lembra da sua senha, use a recuperação de conta.");
        }
      } else {
        console.log("Login falhou: Utilizador não encontrado na lista de", currentUsers.length, "utilizadores.");
        throw new Error("Esta conta ainda não existe no nosso sistema. Por favor, clique no botão 'Criar Conta' abaixo para se registar pela primeira vez.");
      }
    } catch (error: any) {
      console.error("Erro no handleLogin:", error);
      setModal({
        show: true,
        title: "Erro de Login",
        message: error.message || "Ocorreu um erro ao entrar.",
        type: 'alert'
      });
    }
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    console.log("Tentando registo para:", cleanEmail);
    
    try {
      if (auth) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
          if (userCredential.user) {
            console.log("Firebase: Registo com sucesso.");
          }
        } catch (firebaseError: any) {
          console.warn("Firebase Register falhou, continuando com registo local:", firebaseError.message);
        }
      }

      const exists = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (exists) {
        throw new Error("Este email já está registado. Tente fazer login.");
      }

      const newUser = { name, email: cleanEmail, password: cleanPassword };
      setUsers(prev => {
        const newUsers = [...prev, newUser];
        localStorage.setItem('3dproducoes_users', JSON.stringify(newUsers));
        return newUsers;
      });
      
      setIsLoggedIn(true);
      setUserEmail(cleanEmail);
      setIsAdmin(cleanEmail === 'jose.festas@gmail.com');
      setView('profile');
      sessionStorage.setItem('3dproducoes_isLoggedIn', 'true');
      sessionStorage.setItem('3dproducoes_userEmail', cleanEmail);
    } catch (error: any) {
      console.error("Erro no handleRegister:", error);
      setModal({
        show: true,
        title: "Erro de Registo",
        message: error.message || "Ocorreu um erro ao criar conta.",
        type: 'alert'
      });
    }
  };

  const handleForgotPassword = async (email: string, newPassword?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      setModal({
        show: true,
        title: "Recuperação",
        message: "Não encontramos nenhuma conta com esse email.",
        type: 'alert'
      });
      return;
    }

    if (!newPassword) {
      // Email found, now ask for new password (handled by step in view)
      return;
    }

    // Update password
    setUsers(prev => {
      const updated = [...prev];
      updated[userIndex] = { ...updated[userIndex], password: newPassword };
      localStorage.setItem('3dproducoes_users', JSON.stringify(updated)); // Persistência imediata
      return updated;
    });

    setModal({
      show: true,
      title: "Sucesso",
      message: "A sua senha foi redefinida com sucesso. Pode agora fazer login.",
      type: 'alert'
    });
    setView('login');
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.error("Erro ao sair:", e);
    }
    setIsLoggedIn(false);
    setUserEmail('');
    setIsAdmin(false);
    setView('landing');
    setCart([]);
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setView('product_detail');
  };

  const addProduct = async (newProduct: Omit<Product, 'id'>) => {
    const order = products.length;
    const productWithOrder = { ...newProduct, order };
    
    if (db && isAdmin && auth.currentUser) {
      try {
        console.log("Firestore: Adicionando produto...");
        await addDoc(collection(db, 'products'), productWithOrder);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'products');
        // Fallback to local
        const productWithId = { ...productWithOrder, id: Date.now().toString() };
        setProducts(prev => [...prev, productWithId]);
      }
    } else {
      const productWithId = { ...productWithOrder, id: Date.now().toString() };
      setProducts(prev => [...prev, productWithId]);
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    if (db && isAdmin && auth.currentUser) {
      try {
        console.log("Firestore: Atualizando produto:", updatedProduct.id);
        const { id, ...data } = updatedProduct;
        const productRef = doc(db, 'products', id);
        // Usar setDoc com merge: true para evitar erro de "No document to update"
        // Isto cria o documento se não existir, ou atualiza se existir.
        await setDoc(productRef, data as any, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `products/${updatedProduct.id}`);
        // Fallback to local
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      }
    } else {
      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    }
    
    // Update selected product if it's the one being edited
    if (selectedProduct && selectedProduct.id === updatedProduct.id) {
      setSelectedProduct(updatedProduct);
    }
  };

  const deleteProduct = (id: string) => {
    setModal({
      show: true,
      title: "Eliminar Peça",
      message: "Tem a certeza que deseja eliminar esta peça?",
      type: 'confirm',
      onConfirm: async () => {
        if (db && isAdmin && auth.currentUser) {
          try {
            console.log("Firestore: Deletando produto:", id);
            await deleteDoc(doc(db, 'products', id));
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
            // Fallback to local
            setProducts(prev => prev.filter(p => p.id !== id));
          }
        } else {
          setProducts(prev => prev.filter(p => p.id !== id));
        }
        setModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const clearAllProducts = async () => {
    setModal({
      show: true,
      title: "Limpar Catálogo",
      message: "Tem a certeza que deseja apagar TODOS os produtos do catálogo? Esta ação não pode ser desfeita.",
      type: 'confirm',
      onConfirm: async () => {
        if (db && isAdmin && auth.currentUser) {
          try {
            setStatusMessage("A apagar catálogo...");
            const querySnapshot = await getDocs(collection(db, 'products'));
            for (const docSnap of querySnapshot.docs) {
              await deleteDoc(doc(db, 'products', docSnap.id));
            }
            setProducts([]);
            localStorage.removeItem('3dproducoes_products');
            setStatusMessage("Catálogo limpo com sucesso!");
          } catch (error) {
            console.error("Erro ao limpar catálogo:", error);
            setStatusMessage("Erro ao limpar catálogo.");
          }
        } else {
          setProducts([]);
          localStorage.removeItem('3dproducoes_products');
        }
        setModal(prev => ({ ...prev, show: false }));
        setTimeout(() => setStatusMessage(null), 3000);
      }
    });
  };

  const handleReorderProducts = async (newProducts: Product[]) => {
    // Update local state immediately for responsiveness
    setProducts(newProducts);
    
    if (db && isAdmin && auth.currentUser) {
      try {
        console.log("Firestore: Atualizando ordem dos produtos...");
        // Update each product with its new order
        const promises = newProducts.map((p, index) => {
          const productRef = doc(db, 'products', p.id);
          return setDoc(productRef, { order: index }, { merge: true });
        });
        await Promise.all(promises);
        console.log("Firestore: Ordem atualizada com sucesso.");
      } catch (error) {
        console.error("Erro ao atualizar ordem no Firestore:", error);
      }
    }
  };

  const handleRequestSubmit = (data: { type: string; description: string; contact: string }) => {
    const typeLabel = data.type === 'new' ? 'Nova Peça' : 'Alteração de Peça';
    const message = `*Pedido de ${typeLabel}*\n\n*Descrição:* ${data.description}\n*Contacto:* ${data.contact || userEmail}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappLink = `https://wa.me/351${CONTACT_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappLink, '_blank');
    setShowRequestModal(false);
    
    setModal({
      show: true,
      title: "Pedido Enviado",
      message: "O seu pedido foi enviado via WhatsApp. Entraremos em contacto em breve!",
      type: 'alert'
    });
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence>
        {newOrderAlert && isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-6 left-6 right-6 z-[200] max-w-md mx-auto"
          >
            <div className="glass-panel p-4 rounded-2xl border-2 border-primary shadow-2xl flex items-center justify-between gap-4 bg-white/90 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white animate-bounce">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="font-black text-sm text-on-surface">Nova Encomenda!</p>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Verifique o Painel Admin</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setNewOrderAlert(false);
                    setView('admin');
                  }}
                  className="px-4 h-10 bg-primary text-white text-xs font-bold rounded-xl"
                >
                  Ver
                </button>
                <button 
                  onClick={() => setNewOrderAlert(false)}
                  className="p-2 hover:bg-black/5 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <>
            {(view === 'landing' || view === 'profile') && (
              <motion.div key="landing" className="w-full">
                <LandingView 
                  onGoToLogin={() => setView('login')} 
                  onGoToRegister={() => setView('register')} 
                />
              </motion.div>
            )}
            {view === 'register' && (
              <motion.div key="register" className="w-full">
                <RegisterView 
                  onRegister={handleRegister} 
                  onGoToLogin={() => setView('login')} 
                />
              </motion.div>
            )}
            {view === 'login' && (
              <motion.div key="login" className="w-full">
                <LoginView 
                  onLogin={handleLogin} 
                  onGoToRegister={() => setView('register')} 
                  onGoToForgotPassword={() => setView('forgot_password')}
                  onGoogleLogin={handleGoogleLogin}
                />
              </motion.div>
            )}
            {view === 'forgot_password' && (
              <motion.div key="forgot_password" className="w-full">
                <ForgotPasswordView 
                  onReset={handleForgotPassword}
                  onBack={() => setView('login')}
                />
              </motion.div>
            )}
          </>
        ) : (
          <motion.div key="main" className="min-h-screen">
            <Header 
              title={view === 'product_detail' ? "Detalhes" : view === 'admin' ? "Administração" : "3Dproduções"} 
              onLogout={view === 'profile' ? handleLogout : undefined}
              onBack={view === 'product_detail' || view === 'admin' ? () => setView(view === 'admin' ? 'profile' : 'shop') : undefined}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              showSearch={view === 'shop'}
              isAdmin={isAdmin}
              onGoToAdmin={() => setView('admin')}
            />
            
            <main className="pb-20">
              {view === 'shop' && (
                <ShopView 
                  products={filteredProducts} 
                  onAddToCart={addToCart} 
                  onProductClick={handleProductClick} 
                  isAdmin={isAdmin}
                  onGoToAdmin={() => setView('admin')}
                  onDeleteProduct={deleteProduct}
                />
              )}
              {view === 'profile' && (
                <ProfileView 
                  products={products} 
                  userEmail={userEmail} 
                  onLogout={handleLogout} 
                  onGoToReviews={() => setView('reviews')} 
                  onGoToAdmin={() => setView('admin')} 
                  onOpenRequest={() => setShowRequestModal(true)}
                />
              )}
              {view === 'reviews' && <ReviewsView onBack={() => setView('profile')} />}
              {view === 'admin' && (
                <AdminView 
                  products={products} 
                  onAddProduct={addProduct} 
                  onUpdateProduct={updateProduct} 
                  onDeleteProduct={deleteProduct}
                  onClearAllProducts={clearAllProducts}
                  onReorderProducts={handleReorderProducts}
                  onBack={() => setView('profile')}
                  statusMessage={statusMessage}
                  setStatusMessage={setStatusMessage}
                  orders={orders}
                  setModal={setModal}
                />
              )}
              {view === 'cart' && (
                <CartView 
                  items={cart} 
                  onUpdateQuantity={updateQuantity} 
                  onRemove={removeFromCart}
                  onPay={handleMBWayPay}
                  shippingMethod={shippingMethod}
                  setShippingMethod={setShippingMethod}
                  shippingAddress={shippingAddress}
                  setShippingAddress={setShippingAddress}
                />
              )}
              {view === 'product_detail' && selectedProduct && (
                <ProductDetailView 
                  product={selectedProduct} 
                  onAddToCart={addToCart} 
                  onBack={() => setView('shop')} 
                />
              )}
            </main>

            <BottomNav 
              activeView={view} 
              setView={setView} 
              cartCount={cartCount} 
              isAdmin={isAdmin} 
              hasPendingOrders={orders.filter(o => o.status === 'pending' || o.status === 'new' || o.status === 'whatsapp_pending').length > 0}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRequestModal && (
          <RequestModal 
            show={showRequestModal} 
            onClose={() => setShowRequestModal(false)} 
            onSubmit={handleRequestSubmit} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMBWayModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMBWayModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel p-8 rounded-[2.5rem] w-full max-w-sm relative z-10 shadow-2xl border border-white/40"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-on-surface">Pagamento MB Way</h3>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Total a pagar</p>
                  <p className="text-xl font-black text-primary">€{cartTotal.toFixed(2)}</p>
                </div>
              </div>
              
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                Introduza o seu número MB Way. Após confirmar, deverá enviar o valor para o contacto: 
                <span className="block text-primary font-black text-lg mt-1">{CONTACT_NUMBER.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</span>
              </p>
              
              <input 
                autoFocus
                type="tel"
                placeholder="912 345 678"
                value={mbWayPhone}
                onChange={(e) => setMbWayPhone(e.target.value)}
                className="w-full h-14 px-5 bg-white/30 backdrop-blur-md rounded-2xl text-on-surface focus:bg-white/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none border border-white/40 mb-6 font-bold text-lg text-center"
              />

              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmMBWayPay}
                  className="w-full h-14 signature-gradient text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3"
                >
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-[#005cff] font-black text-[10px]">MB</span>
                  </div>
                  Confirmar Pagamento
                </button>

                <button 
                  onClick={() => {
                    const message = `*Nova Encomenda (MB Way Directo)*\n\n*Itens:*\n${cart.map(i => `- ${i.name} x${i.quantity}`).join('\n')}\n\n*Total:* €${cartTotal.toFixed(2)}\n*Telemóvel:* ${mbWayPhone}\n*Envio:* ${shippingMethod === 'mail' ? 'Correio' : 'Em mão'}`;
                    const link = `https://wa.me/351${CONTACT_NUMBER}?text=${encodeURIComponent(message)}`;
                    window.open(link, '_blank');
                    
                    // Também salvamos no Firestore para o alerta
                    if (db) {
                      addDoc(collection(db, 'orders'), {
                        customerEmail: userEmail || 'Convidado',
                        mbWayPhone,
                        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
                        total: cartTotal,
                        shippingMethod,
                        shippingAddress: shippingMethod === 'mail' ? shippingAddress : null,
                        status: 'whatsapp_pending',
                        createdAt: new Date().toISOString()
                      }).catch(console.error);
                    }
                    
                    setCart([]);
                    setView('shop');
                    setShowMBWayModal(false);
                    setMbWayPhone('');
                  }}
                  className="w-full h-14 bg-[#25D366] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3"
                >
                  <MessageCircle size={20} />
                  Enviar via WhatsApp
                </button>

                <button 
                  onClick={() => setShowMBWayModal(false)}
                  className="w-full h-12 bg-black/5 text-on-surface font-bold rounded-xl"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel p-8 rounded-[2.5rem] w-full max-w-sm relative z-10 shadow-2xl border border-white/40"
            >
              <h3 className="text-xl font-black mb-2 text-on-surface">{modal.title}</h3>
              <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">{modal.message}</p>
              <div className="flex gap-3">
                {modal.type === 'confirm' && (
                  <button 
                    onClick={() => setModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 h-12 bg-black/5 text-on-surface font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (modal.type === 'confirm' && modal.onConfirm) {
                      modal.onConfirm();
                    }
                    setModal(prev => ({ ...prev, show: false }));
                  }}
                  className={`flex-1 h-12 ${modal.type === 'confirm' ? 'bg-red-500 text-white' : 'signature-gradient text-white'} font-bold rounded-xl`}
                >
                  {modal.type === 'confirm' ? 'Eliminar' : 'OK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
