import { 
  ProviderProfile, 
  ServiceCategory, 
  Order, 
  ServiceRequest, 
  Review, 
  UserProfile 
} from '@servicos/shared';

export const INITIAL_CATEGORIES: ServiceCategory[] = [
  {
    id: 'c1000000-0000-0000-0000-000000000007',
    name: 'Aulas Particulares & Matemática',
    slug: 'aulas-matematica',
    iconName: 'GraduationCap',
    description: 'Aulas de Matemática, Física, Raciocínio Lógico, Pré-Vestibular e Reforço Escolar',
    averageTicketEstimate: 80,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000001',
    name: 'Elétrica & Chuveiros',
    slug: 'eletrica',
    iconName: 'Zap',
    description: 'Instalações elétricas, troca de chuveiros, disjuntores e tomadas',
    averageTicketEstimate: 120,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000002',
    name: 'Hidráulica & Desentupimento',
    slug: 'hidraulica',
    iconName: 'Droplets',
    description: "Vazamentos, torneiras, caixas d'água e desentupimentos",
    averageTicketEstimate: 130,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000003',
    name: 'Pintura & Acabamento',
    slug: 'pintura',
    iconName: 'Paintbrush',
    description: 'Pintura residencial, cimento queimado, textura e massa corrida',
    averageTicketEstimate: 250,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000004',
    name: 'Limpeza & Diaristas',
    slug: 'limpeza',
    iconName: 'Sparkles',
    description: 'Faxina residencial, pós-obra e higienização de estofados',
    averageTicketEstimate: 160,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000005',
    name: 'Montagem de Móveis',
    slug: 'montagem-moveis',
    iconName: 'Hammer',
    description: 'Montagem e desmontagem de armários, racks e planejados',
    averageTicketEstimate: 90,
    isActive: true,
  },
  {
    id: 'c1000000-0000-0000-0000-000000000006',
    name: 'Ar Condicionado & Climatização',
    slug: 'climatizacao',
    iconName: 'Fan',
    description: 'Instalação, limpeza química e recarga de gás',
    averageTicketEstimate: 180,
    isActive: true,
  },
];

export const INITIAL_CLIENT: UserProfile = {
  id: 'guest-visitor',
  role: 'client',
  fullName: 'Morador de Rondonópolis',
  email: 'morador@rooserv.com.br',
  phone: '(66) 99999-0000',
  neighborhood: 'Centro',
  city: 'Rondonópolis',
  state: 'MT',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

export const INITIAL_PROVIDERS: ProviderProfile[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_REVIEWS: Review[] = [];

export const INITIAL_REQUESTS: ServiceRequest[] = [];
