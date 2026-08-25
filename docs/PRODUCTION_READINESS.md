# RooServ — revisão de segurança e prontidão

Revisão executada entre 23 e 25/08/2026 sobre React/PWA, autenticação, Supabase RLS/RPC/Storage, Edge Functions e AbacatePay.

## Estado verificado

- Build de produção concluído com Vite 8.
- 25 testes automatizados aprovados.
- Nos utilitários instrumentados pelos testes: 97,29% de statements e 91,48% de branches; essa medição não inclui UI, Edge Functions ou SQL.
- `npm audit` sem vulnerabilidades conhecidas.
- Bundle inicial dividido por telas: aproximadamente 420 KB minificado / 120 KB gzip.
- QA visual da build de produção em desktop e viewport móvel de 390×844: sem overflow horizontal nem erros de console observados.
- Oito E2E públicos com Playwright passam em Chromium desktop e mobile. Axe não encontrou violações WCAG A/AA sérias ou críticas nos fluxos cobertos: catálogo, autenticação protegida, cadastro/termos empilhados e onboarding de prestador.
- O verificador estático de release aprovou 41 controles de headers, CSP, PWA, secrets, funções, migrations, SQL legado, sandbox e CI. O deploy público atual aprovou os headers de segurança, mas ainda antecede os novos ícones PWA e precisa receber esta versão antes da validação final.
- Chave Dev mode validada diretamente contra a API v2 da AbacatePay: criação de R$ 30,00, QR/payload presentes, simulação `PAID` e consulta final `PAID`.
- Staging Supabase atualizado em 24/08/2026: migrations `202608230001`–`202608230003` e `202608240001`–`202608240009` aplicadas e registradas no histórico.
- As oito Edge Functions foram publicadas; as sete funções privadas rejeitaram chamadas anônimas com HTTP 401.
- Cinco secrets de runtime foram configurados, o webhook sandbox foi cadastrado para seis eventos e o health check assinado retornou HTTP 200; chamadas sem secret retornaram HTTP 401.
- O aplicativo público carregou conectado ao staging endurecido.
- O E2E financeiro autenticado foi aprovado no staging com cliente, prestador e admin de teste: proposta/aceite, cobrança Pix, simulação `PAID`, conciliação, idempotência, autorização, webhook duplicado/divergente, disputa, estorno contábil, conclusão do serviço, liberação da custódia, saque recusado com restauração integral da carteira e recuperação administrativa de um saque deliberadamente deixado em estado incerto.
- O sandbox recusou o reembolso externo e a transferência Pix. O E2E registrou essas limitações sem tratá-las como sucesso do gateway: aplicou evento controlado apenas para validar o estorno local e comprovou que o saque terminou `failed`, com motivo seguro, R$ 52,80 disponíveis e zero em custódia.
- Supabase Auth revisado em 24/08/2026: confirmação de e-mail e mudança segura de e-mail ativas; login anônimo e vinculação manual desativados; TOTP ativo; sessões AAL1 limitadas a 15 minutos; mudança de senha exige reautenticação e senha atual; complexidade do servidor alinhada a maiúscula, minúscula e número.
- A migration `202608240001` separa a capacidade administrativa da autorização efetiva: todos os RPCs, políticas e Edge Functions que já usavam `is_rooserv_admin()` agora exigem token AAL2. O E2E comprovou bloqueio em AAL1 e liberação somente após TOTP.
- O Security Advisor ficou em 0 erros e 31 avisos após a auditoria. Os avisos remanescentes são as duas projeções públicas redigidas e 29 assinaturas de RPC deliberadamente concedidas a usuários autenticados; os dois novos RPCs de revisão de saque ainda exigem, dentro do banco, capacidade administrativa e sessão MFA AAL2. Uma consulta independente confirmou zero funções `SECURITY DEFINER` autenticadas fora da allowlist do frontend.
- Backups e observabilidade auditados no painel: o plano Free não mantém backups do projeto; Pro inclui até sete dias de backups diários, enquanto PITR é add-on separado. Log Drains também exigem plano pago e add-on. Os sete erros recentes eram exclusivamente negações e divergências provocadas pelo E2E.
- As 18 fixtures criadas durante o desenvolvimento, a validação de MFA e as regressões posteriores foram removidas; staging voltou a zero pedidos, transações, ledger, webhooks e saques de teste.

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
- Execução anônima foi revogada de todas as funções `SECURITY DEFINER`, exceto as duas projeções públicas redigidas. Sete funções internas/legadas também perderam acesso `authenticated`, e privilégios padrão futuros agora exigem concessão explícita.
- `update_provider_rating()` recebeu `search_path` fixo e deixou de ser executável diretamente pela API.
- A política ampla que permitia listar todo o bucket legado foi removida. O único avatar foi copiado para `rooserv-public-media`, a referência do perfil foi atualizada e validada, o objeto antigo foi removido e `rooserv-media` ficou privado, vazio e sem políticas de escrita.
- O painel administrativo AAL2 passou a mostrar webhooks das últimas 24 horas, saques falhos ou parados, revisões manuais e reembolsos com erro ou parados, sem expor motivo sensível. O E2E mais recente comprovou 3 webhooks, 2 saques falhos, 0 saques presos, 0 revisões pendentes, 1 reembolso com erro e 0 reembolsos presos.
- O saque passou a usar os endpoints oficiais `/v1/withdraw/create` e `/v1/withdraw/get`, com o UUID local como `externalId`, consulta antes da criação, validação estrita da resposta e timeout de dez segundos. Timeout, 5xx, resposta inválida ou estado desconhecido nunca causam reenvio automático.
- Saques incertos agora mantêm o valor reservado, bloqueiam novo saque e entram numa fila administrativa protegida por MFA AAL2. Reconsulta, nova tentativa, restauração do saldo e liquidação tardia exigem decisão explícita; cada decisão é registrada numa tabela de auditoria inacessível a usuários comuns.
- A conciliação também trata conclusão tardia depois de uma falha local: o saldo é debitado novamente antes de concluir; se não houver saldo suficiente, a conta continua bloqueada para revisão sem criar saldo negativo silencioso.
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
- Atualização do PWA passou a exigir confirmação do usuário, sem recarregar checkout ou formulário no meio de uma ação; a notificação não se perde caso o service worker responda antes da montagem do React.
- Ícones PNG 192/512 e `apple-touch-icon` foram adicionados e o cache obsoleto passou a ser removido pelo service worker.
- O garimpo automatizado corrigiu semântica ARIA do selo da cidade, contraste do onboarding, região rolável dos termos e devolução de foco em diálogos empilhados.
- CI de qualidade sem Sonar executa testes unitários, build, verificação de configuração e Playwright/axe em cada PR e push para `main`, sem depender de credenciais do staging.

## Concluído no staging em 24/08/2026

1. Migrations incrementais `017`, `018`, `202608230001`–`202608230003` e `202608240001`–`202608240009` presentes no histórico do ambiente.
2. Oito Edge Functions publicadas, incluindo consulta/simulação Pix e processamento de reembolso.
3. Secrets de origem, API AbacatePay, URL do webhook, HMAC e trava de simulação configurados. A trava continua devendo ser `false` em produção.
4. Webhook HTTPS sandbox cadastrado com secret de URL, HMAC e os eventos de pagamento/transferência usados pelo app.
5. E2E financeiro reproduzível disponível em `npm run test:staging:financial`, com travas para o projeto de staging e chave Dev; a regressão de 24/08/2026 aprovou todos os invariantes locais, MFA AAL2, bloqueio de saque duplicado, restauração somente após decisão administrativa e trilha de auditoria.
6. Limpeza reproduzível disponível em `npm run cleanup:staging:financial`; exige projeto exato, marca de fixture, domínio `example.com` e duas confirmações na linha de comando.
7. Migração de mídia legada reproduzível disponível em `npm run migrate:staging:legacy-media`; a execução copiou e validou o avatar antes de atualizar o perfil e remover o objeto antigo. O estado final é bucket legado privado com zero objetos e bucket novo com uma referência válida.
8. Saúde operacional financeira disponível no painel administrativo protegido por TOTP, com métricas de webhook, reembolso e saque validadas pelo E2E e sem acesso em AAL1.
9. Recuperação de saque incerto implementada e documentada em [`PAYOUT_OPERATIONS.md`](PAYOUT_OPERATIONS.md), com valor reservado, reconciliação por `externalId`, decisão humana explícita e proteção contra duplicidade.

## Bloqueadores restantes antes de dinheiro real

1. **Revogar o token Sonar exposto e limpar o histórico.** O workflow foi removido e o CI atual não depende do Sonar, portanto não gere nem configure outro token. Revogue o antigo no SonarCloud, reescreva o histórico Git e faça os colaboradores reclonarem depois da limpeza.
2. **Homologar reembolso e saque no gateway antes de dinheiro real.** O E2E integrado já validou cobrança, pagamento, idempotência, autorização, eventos duplicados/divergentes, disputa, estorno local e recuperação de saldo no saque falho. A AbacatePay Dev recusou tanto `POST /v2/transparents/refund` quanto a transferência Pix; repetir com credenciais/ambiente de homologação que suportem essas operações e obter evidência de reembolso externo, webhook real e transferência concluída/falha pelo gateway.
3. **Revisão jurídica/LGPD.** Publicar textos integrais, controlador/encarregado, canal do titular, bases legais, retenção, descarte, garantia, mediação e estorno.
4. **Concluir infraestrutura de Auth para tráfego público.** Confirmação de e-mail, redirects de produção, requisitos de senha, reautenticação e MFA administrativo já estão ativos. Antes do lançamento, configurar SMTP próprio, CAPTCHA e remover o redirect localhost; proteção de senhas vazadas exige upgrade do plano Free para Pro. Revisar os limites atuais com os volumes esperados depois do SMTP.
5. **Backups/observabilidade externa.** O projeto está no plano Free e não possui backup diário. Migrar ao menos para Pro, comprovar uma restauração e decidir se o risco exige também PITR. Os indicadores financeiros internos já existem, mas alertas externos/24×7 ainda exigem Log Drain pago ou outra integração que não registre dados sensíveis.
6. **Criar baseline reproduzível do banco.** A migration `202608210001` pressupõe que o schema e RLS-base já existam. Gere um dump somente de schema do staging endurecido, revise grants/policies, transforme-o em migration-base e prove um `db reset` local ou em projeto descartável; não reutilize os scripts legados em produção. A tentativa local de 25/08 encontrou Docker instalado com daemon desligado e ausência de CLI/`psql`; o dump remoto também exige a senha do banco.
7. **Definir chargeback/reembolso depois do repasse.** O ledger atual rejeita reembolso após a liberação do saldo e não modela saldo negativo ou reserva. Defina política operacional e contábil, janela de reserva e recuperação de saldo; então teste chargeback e reembolso tardio antes de habilitar saques reais.

## Riscos residuais

- Falta teste automatizado das migrations/RLS contra projeto Supabase descartável.
- Playwright/axe cobre os principais fluxos públicos, mas ainda faltam E2E autenticados de cliente, prestador e admin no navegador.
- Rate limits de banco não substituem WAF/gateway e limites do Auth.
- Logs das Edge Functions ainda usam `console`; falta correlação estruturada e encaminhamento externo de alertas.
- Ícones PNG/Apple estão na build, mas a instalação precisa ser validada em um iPhone real depois do próximo deploy.
- Fazer DAST e teste manual de autorização com anônimo, cliente, prestador e admin; o E2E financeiro de staging já cobre as autorizações críticas no backend.

Produção com dinheiro real deve ser liberada somente quando os sete bloqueadores restantes tiverem evidência em staging.
