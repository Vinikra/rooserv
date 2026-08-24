import { OrderStatus, RequestUrgency, VerificationStatus } from '../types';

export const LEGAL_TERMS_VERSION = '2026-08-23';

export const CITY_CONFIG = {
  name: 'Rondonópolis',
  state: 'MT',
  brandName: 'RooServ',
  tagline: 'A plataforma de serviços de Rondonópolis',
  phoneDDD: '66',
  estimatedPopulation: 245000,
  defaultNeighborhoods: [
    'Centro',
    'Vila Aurora',
    'Vila Operária',
    'Jardim Mato Grosso',
    'Sagrada Família',
    'Coophalis',
    'Jardim Europa',
    'Parque Sagrada Família',
    'Monte Líbano',
    'Jardim Adriana',
    'Cidade Alta',
    'Distrito Industrial',
  ],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string; description: string }> = {
  draft: {
    label: 'Rascunho',
    color: '#9CA3AF',
    description: 'Pedido ainda não enviado',
  },
  awaiting_payment: {
    label: 'Aguardando Pagamento',
    color: '#F59E0B',
    description: 'Aguardando confirmação do Pix ou Cartão',
  },
  payment_in_escrow: {
    label: 'Pagamento confirmado',
    color: '#3B82F6',
    description: 'Pagamento confirmado; repasse ao prestador aguarda a conclusão do fluxo',
  },
  in_progress: {
    label: 'Em Execução',
    color: '#6366F1',
    description: 'O prestador está realizando o serviço no local',
  },
  completed_by_provider: {
    label: 'Concluído pelo Prestador',
    color: '#8B5CF6',
    description: 'Aguardando você confirmar e liberar o pagamento',
  },
  approved_by_client: {
    label: 'Finalizado com Sucesso',
    color: '#10B981',
    description: 'Serviço concluído e pagamento liberado ao profissional',
  },
  disputed: {
    label: 'Em Mediação',
    color: '#EF4444',
    description: 'Um chamado foi aberto com a equipe de suporte',
  },
  cancelled: {
    label: 'Cancelado',
    color: '#6B7280',
    description: 'Pedido cancelado',
  },
  refunded: {
    label: 'Reembolsado',
    color: '#14B8A6',
    description: 'Valor estornado integralmente ao cliente',
  },
};

export const URGENCY_LABELS: Record<RequestUrgency, { label: string; badgeColor: string }> = {
  low: { label: 'Sem pressa (próximos 7 dias)', badgeColor: '#6B7280' },
  normal: { label: 'Normal (próximos 2 a 3 dias)', badgeColor: '#3B82F6' },
  urgent_today: { label: 'URGENTE: Hoje / Imediato', badgeColor: '#EF4444' },
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, { label: string; color: string }> = {
  pending: { label: 'Documentos Pendentes', color: '#F59E0B' },
  under_review: { label: 'Em Análise', color: '#3B82F6' },
  verified: { label: 'Profissional Verificado', color: '#10B981' },
  rejected: { label: 'Documentos Recusados', color: '#EF4444' },
};

export const SUGGESTED_REVIEW_TAGS = [
  'Pontual',
  'Preço Justo',
  'Caprichoso',
  'Limpo e Organizado',
  'Educado',
  'Equipamento Profissional',
  'Rápido',
  'Explicou Tudo Bem',
];
