export type UserRole = 'client' | 'provider' | 'admin';

export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected';

export type RequestUrgency = 'low' | 'normal' | 'urgent_today';

export type OrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'payment_in_escrow'       // Retido pela plataforma com segurança
  | 'in_progress'             // Prestador executando
  | 'completed_by_provider'   // Prestador marcou como concluído
  | 'approved_by_client'      // Cliente aceitou e liberou pagamento
  | 'disputed'                // Problema reportado
  | 'cancelled'
  | 'refunded';

export type PaymentMethodType = 'pix' | 'credit_card';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string;
  documentCpf?: string;
  avatarUrl?: string;
  neighborhood: string;
  city: string;
  state: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProviderProfile {
  id: string;
  profileId: string;
  profile?: UserProfile;
  documentCnpj?: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  bio: string;
  experienceYears: number;
  hourlyRateEstimate?: number;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pixKey?: string;
  averageRating: number;
  totalReviews: number;
  totalCompletedOrders: number;
  isAvailable: boolean;
  categories: ServiceCategory[];
  portfolio: PortfolioItem[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string;
  averageTicketEstimate: number;
  isActive: boolean;
}

export interface PortfolioItem {
  id: string;
  providerId: string;
  title: string;
  description: string;
  beforeImageUrl?: string;
  afterImageUrl: string;
  createdAt: string;
}

export interface ServiceRequest {
  id: string;
  clientId: string;
  client?: UserProfile;
  categoryId: string;
  category?: ServiceCategory;
  title: string;
  description: string;
  urgency: RequestUrgency;
  preferredDate?: string;
  addressNeighborhood: string;
  budgetEstimate?: number;
  photos: string[];
  status: 'open' | 'in_negotiation' | 'assigned' | 'closed';
  createdAt: string;
}

export interface Proposal {
  id: string;
  requestId: string;
  providerId: string;
  provider?: ProviderProfile;
  laborAmount: number;
  materialsAmount: number;
  totalAmount: number;
  estimatedDays: number;
  description: string;
  warrantyDays: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
}

export interface ProviderWalletSummary {
  id?: string;
  providerId: string;
  balanceAvailable: number;
  balanceInEscrow: number;
  totalEarnedLifetime: number;
  updatedAt?: string;
}

export interface PayoutRequest {
  id: string;
  walletId: string;
  providerId: string;
  amount: number;
  pixKeyDestination: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  gatewayTransferId?: string;
  failReason?: string;
  transactionReceiptUrl?: string;
  processingStartedAt?: string;
  processedAt?: string;
  requiresManualReview: boolean;
  uncertainSince?: string;
  lastReconciliationAt?: string;
  reconciliationAttempts: number;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  client?: UserProfile;
  providerId: string;
  provider?: ProviderProfile;
  proposalId?: string;
  requestId?: string;
  totalAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  providerPayoutAmount: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethodType;
  installmentsCount: number;
  paidAt?: string;
  startedAt?: string;
  completedAt?: string;
  fundsReleasedAt?: string;
  completionProofPhotos?: string[];
  disputeReason?: string;
  disputeDetails?: string;
  disputeOpenedBy?: string;
  disputeOpenedAt?: string;
  disputeResolution?: 'refund_client' | 'release_provider';
  refundRequestedAt?: string;
  disputeResolvedAt?: string;
  serviceTitle?: string;
  serviceDescription?: string;
  photos?: string[];
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  clientId: string;
  client?: UserProfile;
  providerId: string;
  rating: number; // 1 to 5
  comment?: string;
  tags: string[];
  photos: string[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  orderId?: string;
  requestId?: string;
  senderId: string;
  recipientId: string;
  content: string;
  attachmentUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ProviderWallet {
  providerId: string;
  balanceAvailable: number;
  balanceInEscrow: number;
  totalEarnedLifetime: number;
}

export interface SignupData {
  role: UserRole;
  fullName: string;
  email: string;
  password: string;
  phone: string;
  neighborhood: string;
  documentCpf?: string;
  avatarUrl?: string;
  acceptedTerms: true;
  termsVersion: string;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export type InAppNotificationType = 'order' | 'message' | 'payment' | 'system' | 'proposal';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: InAppNotificationType;
  time: string;
  isRead: boolean;
  actionTab?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}
