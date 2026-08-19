# 🛠️ RooServ - Plataforma Hiperlocal de Serviços (Rondonópolis - MT)

<p align="center">
  <strong>A plataforma moderna, segura e com custódia de pagamento para contratação de prestadores de serviços em Rondonópolis.</strong>
</p>

---

## 🌟 Visão Geral

O **RooServ** conecta moradores de Rondonópolis a eletricistas, encanadores, pintores, diaristas e montadores de móveis qualificados, com **pagamento seguro em custódia**, **chat protegido contra vazamento de contatos** e **garantia de 60 dias**.

---

## 🚀 Funcionalidades Principais

* 🏙️ **Foco Hiperlocal:** Bairros reais de Rondonópolis (*Vila Aurora, Sagrada Família, Vila Operária, Centro, Coophalis, etc.*).
* 🛡️ **Pagamento em Custódia (Escrow):** O morador paga via Pix ou Cartão (em até 12x) e o valor só é liberado ao prestador após a aprovação e avaliação do serviço.
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
│   └── shared/          # Modelos TypeScript, cálculos de split (12%/88%) e motor de segurança
├── supabase/
│   ├── schema.sql       # Tabelas relacionais, enums e triggers
│   ├── seed.sql         # Seed inicial de categorias e prestadores
│   └── security_and_rls.sql # Políticas RLS e procedures atômicas RPC
```

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

4. Acesse em: `http://localhost:3001/`

---

## 📦 Licença
MIT © [Vinikra](https://github.com/Vinikra)
