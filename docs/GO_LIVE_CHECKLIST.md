# RooServ — checklist de go-live

Atualizado em 25/08/2026. O projeto Supabase atual pode ser promovido: não é obrigatório criar outro projeto, desde que haja backup verificável, limpeza de fixtures, troca controlada de secrets e evidências dos gates abaixo.

## Pronto no código

- [x] Cobrança Pix sandbox, webhook HMAC, idempotência, conciliação e ledger.
- [x] Saque incerto sem reenvio automático, fila manual e trilha de auditoria.
- [x] Admin exige TOTP/AAL2 também no banco.
- [x] RLS/RPC/Storage auditados no staging; fixtures financeiras removidas.
- [x] Headers de segurança e CSP publicados.
- [x] PWA com atualização confirmada, limpeza de cache e ícones 192/512/Apple.
- [x] 25 testes unitários e 8 E2E Playwright/axe em desktop e mobile.
- [x] Verificação estática com 41 controles e CI sem Sonar.
- [x] SQL avulso antigo marcado como legado e perigoso.
- [x] Script somente leitura para validar o deploy: `npm run check:live`.

## Ações do responsável antes de dinheiro real

### 1. Segredos e histórico

- [ ] Revogar o token antigo do SonarCloud. Não criar outro: o Sonar foi retirado.
- [ ] Autorizar a reescrita do histórico Git que contém o token e coordenar o reclone dos colaboradores.
- [ ] Rotacionar a chave Dev da AbacatePay compartilhada durante o desenvolvimento.
- [ ] Criar a chave de produção da AbacatePay apenas no momento da homologação e nunca salvá-la em arquivo versionado ou no frontend.

### 2. Identidade, jurídico e LGPD

- [ ] Informar razão social/nome empresarial, CNPJ/CPF do controlador, endereço e canal de privacidade.
- [ ] Contratar revisão jurídica dos Termos de Uso, Política de Privacidade, mediação, garantia, reembolso e repasse.
- [ ] Aprovar política contábil para chargeback ou reembolso depois do repasse, incluindo reserva e recuperação de saldo.
- [ ] Definir prazos de retenção e descarte de cadastro, KYC, mensagens, comprovantes, logs e registros financeiros.

### 3. Supabase Auth e proteção de conta

- [ ] Configurar SMTP próprio e validar entrega, SPF, DKIM e DMARC.
- [ ] Configurar CAPTCHA nos fluxos públicos de autenticação.
- [ ] Manter apenas URLs HTTPS do domínio final nos redirects; remover localhost.
- [ ] Revisar limites de envio/login para o volume do piloto.
- [ ] Se a proteção contra senhas vazadas for requisito, migrar ao plano que a oferece.

### 4. Banco, backup e observabilidade

- [ ] Ativar ao menos backups diários antes da promoção e provar uma restauração.
- [ ] Com a senha do banco disponível, gerar dump somente de schema do staging endurecido.
- [ ] Revisar o dump para grants/policies indevidos e convertê-lo na migration-base anterior a `202608210001`.
- [ ] Iniciar Docker Desktop e provar `supabase db reset` do zero; o estado atual não pode ser chamado de reproduzível antes desse teste.
- [ ] Definir monitor externo de disponibilidade e alertas financeiros sem enviar CPF, KYC ou payload sensível.

### 5. Gateway e operação financeira

- [ ] Homologar reembolso real, webhook correspondente, saque concluído e saque recusado no ambiente/credencial que suporte essas operações.
- [ ] Confirmar com AbacatePay os eventos e formato HMAC vigentes na data da produção.
- [ ] Configurar secrets de produção nas Edge Functions e confirmar `ALLOW_SANDBOX_PAYMENT_SIMULATION=false`.
- [ ] Cadastrar o webhook de produção e executar uma transação mínima ponta a ponta.
- [ ] Manter saques sob revisão manual durante o piloto.

### 6. Domínio, deploy e instalação

- [ ] Escolher e configurar o domínio final com HTTPS.
- [ ] Autorizar `commit` e `push` desta versão; aguardar o deploy da Vercel.
- [ ] Executar `npm run check:live` até todos os controles passarem.
- [ ] Instalar o PWA em Android e iPhone reais, fechar/reabrir e validar ícone, atualização e navegação.

## Sequência de promoção no mesmo banco

1. Congelar mudanças e registrar tag/commit de release.
2. Fazer backup e provar leitura/restauração em destino separado.
3. Confirmar zero fixtures e revisar usuários/dados reais que permanecerão.
4. Aplicar somente migrations ainda não registradas; nunca executar os SQL legados.
5. Configurar domínio, redirects, SMTP, CAPTCHA e secrets de produção.
6. Manter simulação sandbox desativada, cadastrar webhook e validar health check assinado.
7. Executar transação mínima, conferir AbacatePay, banco, ledger, painel admin e recibo.
8. Abrir piloto controlado conforme [`PILOT_RUNBOOK.md`](PILOT_RUNBOOK.md).

## Rollback

- Frontend: promover o último deployment saudável da Vercel.
- Tráfego: interromper novas contratações e saques antes de qualquer correção financeira.
- Secrets: revogar a credencial comprometida e substituir no gateway e nas Edge Functions.
- Banco: migrations financeiras são forward-only; não improvisar `DROP`/rollback manual. Restaurar o backup em ambiente separado, reconciliar e decidir a recuperação com evidência.
- Pagamentos: nunca reenviar saque de estado incerto. Consultar o mesmo `externalId` e seguir [`PAYOUT_OPERATIONS.md`](PAYOUT_OPERATIONS.md).
