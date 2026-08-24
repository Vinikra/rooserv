# 🛠️ RooServ - Plataforma Hiperlocal de Serviços (Rondonópolis - MT)

<p align="center">
  <strong>Plataforma de contratação de prestadores em Rondonópolis com pagamento Pix e repasse após a aprovação do serviço.</strong>
</p>

---

## 🌟 Visão Geral

O **RooServ** conecta moradores de Rondonópolis a prestadores verificados, com **pagamento Pix registrado na plataforma**, **chat com proteção contra compartilhamento de contatos** e fluxo de mediação.

---

## 🚀 Funcionalidades Principais

* 🏙️ **Foco Hiperlocal:** Bairros reais de Rondonópolis (*Vila Aurora, Sagrada Família, Vila Operária, Centro, Coophalis, etc.*).
* 🛡️ **Repasse condicionado:** o morador paga via Pix e o repasse ao prestador é autorizado após a aprovação do serviço ou a resolução de uma disputa. A revisão jurídica desse fluxo é obrigatória antes de operar com dinheiro real.
* 💬 **Chat In-App Anti-Vazamento:** Filtro em tempo real que bloqueia telefones DDD 66, chaves Pix e redes sociais, centralizando o atendimento dentro da plataforma.
* 📋 **Onboarding de Prestadores:** Assistente em 4 etapas com envio de documentos (RG/CNH) e galeria de portfólio Antes/Depois.
* ⚖️ **Mesa de Mediação & Disputas:** Dono do app pode arbitrar desacordos entre moradores e profissionais.
* 📲 **PWA Instalável:** Funciona direto no celular (Android e iOS) como app nativo.
* 🔐 **Segurança com Supabase:** Row Level Security (RLS) e Stored Procedures atômicas no PostgreSQL.

---

## 🏗️ Estrutura do Monorepo

```
├── apps/
│   └── mobile/          # Interface React + Vite + Tailwind CSS + Lucide Icons + PWA
├── packages/
│   └── shared/          # Modelos TypeScript, cálculos de taxa/repasse (12%/88%) e motor de segurança
├── supabase/
│   ├── migrations/      # Hardening incremental do banco existente (aplicar em ordem)
│   ├── functions/       # Edge Functions autenticadas e webhook AbacatePay
│   └── *.sql            # Referências/seed legados; somente desenvolvimento local
```

> Não use `full_migration.sql`, `schema.sql`, `security_and_rls.sql` ou `seed.sql` para implantar o ambiente atual. `full_migration.sql` é destrutivo e os seeds contêm dados fictícios. As migrations atuais partem de um schema-base já existente; antes de criar um projeto Supabase vazio, gere e revise uma migration-base reproduzível conforme o checklist de produção.

---

## 💻 Como Rodar Localmente

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Compilar pacote compartilhado:**
   ```bash
   npm run build:shared
   ```

3. **Iniciar servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. Acesse em: `http://localhost:3000/`

## 💳 Pagamentos com AbacatePay

O checkout Pix e os reembolsos usam os endpoints transparentes da API v2; os saques Pix usam os endpoints oficiais `/v1/withdraw/create` e `/v1/withdraw/get`. Toda comunicação passa exclusivamente pelas Supabase Edge Functions, e a chave privada nunca é enviada ao navegador.

1. Crie uma chave Dev mode com as permissões `CHECKOUT:CREATE`, `CHECKOUT:READ`, `WITHDRAW:CREATE` e `WITHDRAW:READ`.
2. Configure `APP_ORIGIN`, `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET` e `ABACATEPAY_WEBHOOK_HMAC_KEY` conforme `supabase/functions/.env.example`.
3. Aplique todas as migrations incrementais de `supabase/migrations` em ordem, até `202608240009_strict_payout_review_inputs.sql`.
4. Publique as Edge Functions de pagamento: `create-pix-charge`, `check-pix-payment`, `simulate-pix-payment`, `payment-webhook`, `process-payment-refund` e `process-provider-payout`.
5. Cadastre na AbacatePay o endpoint HTTPS:

   ```text
   https://SEU_PROJECT_REF.supabase.co/functions/v1/payment-webhook?webhookSecret=SEU_SECRET_DE_URL
   ```

6. Use o valor de `ABACATEPAY_WEBHOOK_SECRET` no parâmetro `webhookSecret` da URL e configure a chave HMAC oficial vigente separadamente.
7. Assine os eventos `transparent.completed`, `transparent.refunded`, `transparent.disputed`, `transparent.lost`, `transfer.completed` e `transfer.failed`.

Use uma chave Dev mode para os testes. A AbacatePay usa a mesma URL em desenvolvimento e produção; o ambiente é definido pela chave.

### Teste sandbox

No staging, defina `ALLOW_SANDBOX_PAYMENT_SIMULATION=true`. Isso habilita no checkout um botão de simulação somente quando a própria cobrança vier marcada pela AbacatePay como `devMode`. Em produção, mantenha obrigatoriamente:

```text
ALLOW_SANDBOX_PAYMENT_SIMULATION=false
```

Para validar diretamente a API sandbox, sem expor a chave no terminal ou no frontend:

```bash
npm run test:payments:sandbox
```

O script exige confirmação explícita embutida no comando do npm, recusa cobranças que não sejam `devMode` e testa criação, simulação e consulta final. Webhooks continuam sendo a fonte autoritativa em produção; a consulta periódica do checkout serve como fallback visual e nunca credita o ledger.

Cada saque usa o UUID local como `externalId` no gateway. Antes de criar uma transferência, o backend procura esse identificador na AbacatePay. Timeout, resposta 5xx ou resposta inválida colocam o saque em revisão manual e nunca provocam reenvio automático, evitando uma transferência Pix duplicada. O procedimento de conciliação e decisão administrativa está em [docs/PAYOUT_OPERATIONS.md](docs/PAYOUT_OPERATIONS.md).

Antes de habilitar transações reais, conclua o checklist em [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

---

## 📦 Licença
MIT © [Vinikra](https://github.com/Vinikra)
