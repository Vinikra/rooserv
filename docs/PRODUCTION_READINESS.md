# RooServ — revisão de segurança e prontidão

Revisão executada em 23/08/2026 sobre React/PWA, autenticação, Supabase RLS/RPC/Storage, Edge Functions e AbacatePay.

## Estado verificado

- Build de produção concluído com Vite 8.
- 21 testes automatizados aprovados.
- Nos utilitários instrumentados pelos testes: 97,29% de statements e 91,48% de branches; essa medição não inclui UI, Edge Functions ou SQL.
- `npm audit` sem vulnerabilidades conhecidas.
- Bundle inicial dividido por telas: aproximadamente 420 KB minificado / 120 KB gzip.
- QA visual da build de produção em desktop e viewport móvel de 390×844: sem overflow horizontal nem erros de console observados.
- Chave Dev mode validada diretamente contra a API v2 da AbacatePay: criação de R$ 30,00, QR/payload presentes, simulação `PAID` e consulta final `PAID`.
- Staging Supabase atualizado em 24/08/2026: migrations `202608230001`, `202608230002` e `202608230003` aplicadas e registradas no histórico.
- As oito Edge Functions foram publicadas; as sete funções privadas rejeitaram chamadas anônimas com HTTP 401.
- Cinco secrets de runtime foram configurados, o webhook sandbox foi cadastrado para seis eventos e o health check assinado retornou HTTP 200; chamadas sem secret retornaram HTTP 401.
- O aplicativo público carregou conectado ao staging endurecido.
- O E2E financeiro autenticado foi aprovado no staging com cliente, prestador e admin de teste: proposta/aceite, cobrança Pix, simulação `PAID`, conciliação, idempotência, autorização, webhook duplicado/divergente, disputa, estorno contábil, conclusão do serviço, liberação da custódia e saque recusado com restauração integral da carteira.
- O sandbox recusou o reembolso externo e a transferência Pix. O E2E registrou essas limitações sem tratá-las como sucesso do gateway: aplicou evento controlado apenas para validar o estorno local e comprovou que o saque terminou `failed`, com motivo seguro, R$ 52,80 disponíveis e zero em custódia.
- Supabase Auth revisado em 24/08/2026: confirmação de e-mail e mudança segura de e-mail ativas; login anônimo e vinculação manual desativados; TOTP ativo; sessões AAL1 limitadas a 15 minutos; mudança de senha exige reautenticação e senha atual; complexidade do servidor alinhada a maiúscula, minúscula e número.
- A migration `202608240001` separa a capacidade administrativa da autorização efetiva: todos os RPCs, políticas e Edge Functions que já usavam `is_rooserv_admin()` agora exigem token AAL2. O E2E comprovou bloqueio em AAL1 e liberação somente após TOTP.
- As 12 fixtures criadas durante as três execuções de desenvolvimento e a validação final de MFA foram removidas; staging voltou a zero pedidos, transações, ledger, webhooks e saques de teste.

## Correções implementadas

### Segurança e pagamentos

- Token do Sonar removido da configuração atual. Ele ainda existe no histórico Git.
- Cache offline de respostas autenticadas do Supabase removido.
- Broadcast global falsificável removido; Realtime usa linhas protegidas por RLS e recarrega projeções seguras.
- Criação de solicitações e comandos financeiros movida para RPCs validadas, com limites de valor e abuso.
- Contratação direta sem aceite do prestador foi fechada; a cobrança nasce de proposta formal aceita.
- Inserção direta de reviews removida; propostas exibidas no chat precisam existir no banco.
- Fotos novas de solicitações/provas usam bucket privado e URLs assinadas de cinco minutos.
- KYC exige objetos existentes; identidade, autorização e destino Pix receberam proteção adicional.
- CPF ativo é normalizado, validado por dígitos verificadores e não pode pertencer a duas contas.
- Recibos escapam dados dinâmicos e não executam script inline.
- Reembolso administrativo chama `POST /v2/transparents/refund`; o webhook confirma o estado final e movimenta o ledger.
- Webhook valida secret da URL, assinatura HMAC do corpo raw e idempotência.
- Checkout consulta o status com limitação no banco como fallback de UX, mas somente o webhook confirmado movimenta o ledger em produção.
- Cobranças Dev mode são identificadas e a simulação sandbox exige três travas: flag explícita do ambiente, cobrança marcada `devMode` pelo gateway e propriedade do pedido pelo usuário autenticado.
- O teste sandbox conciliado usa o mesmo RPC idempotente do webhook, com identificador sintético único; a função fica desabilitada quando a flag de ambiente não é exatamente `true`.
- Admin deixou de conter UUID/e-mail pessoal em migration; concessão exige `service_role`.
- O painel administrativo agora cadastra/confirma TOTP, elimina inscrição incompleta ao cancelar e só carrega métricas, KYC, disputas e reembolsos após AAL2 validado também no banco.
- Scripts SQL antigos/destrutivos foram marcados como legado; as migrations incrementais são a trilha de atualização do ambiente existente.

### Frontend, UI e UX

- Configuração Supabase é obrigatória; URL insegura ou chave privilegiada no frontend interrompe a inicialização.
- CSP e headers de segurança adicionados; zoom do navegador reabilitado.
- Expiração Pix deriva do horário do gateway e permite regenerar QR Code expirado ou cancelado sem duplicar o pedido.
- Checkout mostra estados distintos para aguardando pagamento, pagamento detectado aguardando webhook, confirmado, cancelado e expirado; também atualiza ao voltar para a aba.
- Upload, envio, cópia e formulários têm estados de erro e bloqueio de envio concorrente.
- Diálogos bloqueiam o scroll de fundo, contêm o foco e devolvem o foco ao controle de origem.
- Visitantes são encaminhados ao login antes de abrir telas privadas; o destino solicitado é retomado após autenticação.
- CPF é validado no frontend e banco; cadastro registra aceite legal versionado.
- URL de indicação, favicon e manifesto PWA corrigidos; telas são carregadas sob demanda.
- Notas, experiência, bairro, preço, promoções e garantias deixam de receber valores fictícios quando não existem no banco.
- Textos de Pix, cobertura, disputa e recibo foram alinhados ao comportamento efetivamente implementado.
- Promessas de “custódia segura”, “escrow”, “split” do gateway e pagamento garantido foram removidas da interface até validação jurídica e operacional.

## Concluído no staging em 24/08/2026

1. Migrations incrementais `017`, `018`, `202608230001`, `202608230002`, `202608230003` e `202608240001` presentes no histórico do ambiente.
2. Oito Edge Functions publicadas, incluindo consulta/simulação Pix e processamento de reembolso.
3. Secrets de origem, API AbacatePay, URL do webhook, HMAC e trava de simulação configurados. A trava continua devendo ser `false` em produção.
4. Webhook HTTPS sandbox cadastrado com secret de URL, HMAC e os eventos de pagamento/transferência usados pelo app.
5. E2E financeiro reproduzível disponível em `npm run test:staging:financial`, com travas para o projeto de staging e chave `abc_dev_`; execução de 24/08/2026 aprovada em todos os invariantes locais.
6. Limpeza reproduzível disponível em `npm run cleanup:staging:financial`; exige projeto exato, marca de fixture, domínio `example.com` e duas confirmações na linha de comando.

## Bloqueadores restantes antes de dinheiro real

1. **Revogar o token Sonar exposto.** Gere outro, configure `SONAR_TOKEN` no CI e reescreva o histórico Git. Colaboradores devem reclonar depois da limpeza.
2. **Migrar mídia legada.** `rooserv-media` continua público para preservar URLs. Copie `requests/` e `proofs/` ao bucket privado, converta as referências, valide e desative o legado.
3. **Homologar reembolso e saque no gateway antes de dinheiro real.** O E2E integrado já validou cobrança, pagamento, idempotência, autorização, eventos duplicados/divergentes, disputa, estorno local e recuperação de saldo no saque falho. A AbacatePay Dev recusou tanto `POST /v2/transparents/refund` quanto a transferência Pix; repetir com credenciais/ambiente de homologação que suportem essas operações e obter evidência de reembolso externo, webhook real e transferência concluída/falha pelo gateway.
4. **Revisão jurídica/LGPD.** Publicar textos integrais, controlador/encarregado, canal do titular, bases legais, retenção, descarte, garantia, mediação e estorno.
5. **Concluir infraestrutura de Auth para tráfego público.** Confirmação de e-mail, redirects de produção, requisitos de senha, reautenticação e MFA administrativo já estão ativos. Antes do lançamento, configurar SMTP próprio, CAPTCHA e remover o redirect localhost; proteção de senhas vazadas exige upgrade do plano Free para Pro. Revisar os limites atuais com os volumes esperados depois do SMTP.
6. **Backups/observabilidade.** Ativar PITR, testar restauração e alertar falhas de webhook, reembolso e saque sem registrar dados sensíveis.
7. **Recuperar saques de estado incerto.** Definir procedimento e alerta para transferências que ficaram em `processing` após timeout/5xx, conciliando pelo webhook ou suporte antes de permitir nova tentativa.
8. **Criar baseline reproduzível do banco.** A migration `202608210001` pressupõe que o schema e RLS-base já existam. Gere um dump somente de schema do staging endurecido, revise grants/policies, transforme-o em migration-base e prove um `db reset` em projeto descartável; não reutilize os scripts legados em produção.
9. **Definir chargeback/reembolso depois do repasse.** O ledger atual rejeita reembolso após a liberação do saldo e não modela saldo negativo ou reserva. Defina política operacional e contábil, janela de reserva e recuperação de saldo; então teste chargeback e reembolso tardio antes de habilitar saques reais.

## Riscos residuais

- Falta teste automatizado das migrations/RLS contra projeto Supabase descartável.
- Cobertura de componentes/E2E ainda é pequena; adicionar Playwright e axe.
- Rate limits de banco não substituem WAF/gateway e limites do Auth.
- Logs das Edge Functions ainda usam `console`; falta correlação estruturada e alertas.
- O manifesto ainda precisa de ícones PNG 192/512 e `apple-touch-icon` validados em iOS real.
- Fazer DAST e teste manual de autorização com anônimo, cliente, prestador e admin.

Produção com dinheiro real deve ser liberada somente quando os nove bloqueadores restantes tiverem evidência em staging.
