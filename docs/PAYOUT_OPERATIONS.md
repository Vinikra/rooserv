# RooServ — operação segura de saques Pix

Este runbook cobre saques de prestadores enviados à AbacatePay. O objetivo principal é impedir uma transferência duplicada quando o backend perde a resposta do gateway.

## Regras invariáveis

- O UUID de `payout_requests` é enviado como `externalId` e identifica o saque de ponta a ponta.
- O backend consulta `/v1/withdraw/get?externalId=...` antes de qualquer criação em `/v1/withdraw/create`.
- Timeout, HTTP 5xx, resposta inválida ou estado desconhecido nunca autorizam reenvio automático.
- Um prestador pode ter apenas um saque aberto ou em revisão. O valor fica reservado até existir evidência suficiente para concluir ou falhar a operação.
- Apenas administrador com MFA AAL2 pode decidir uma revisão. Não altere carteira, ledger ou `payout_requests` diretamente no SQL Editor.

## Estados operacionais

| Estado local | Significado | Ação segura |
| --- | --- | --- |
| `pending` | Pedido criado e saldo reservado | Aguardar o processador |
| `processing` | Processamento iniciado | Conciliar; não reenviar manualmente |
| `completed` | Gateway confirmou conclusão e ledger foi liquidado | Nenhuma |
| `failed` sem revisão | Falha terminal confirmada e saldo restaurado | Prestador pode solicitar novamente |
| `requires_manual_review = true` | Resultado do gateway é incerto ou existe conclusão tardia sem saldo disponível | Seguir o procedimento abaixo |

## Procedimento de revisão

1. Entre no painel administrativo com TOTP/MFA AAL2 e abra a fila de saques em análise.
2. Use **Reconsultar gateway**. A consulta usa o `externalId`; não copie a chave Pix para tickets ou mensagens.
3. Se a AbacatePay retornar `COMPLETE`, liquide a conclusão. O backend debita novamente um saldo que já tenha sido restaurado antes de marcar o saque como concluído.
4. Se retornar `FAILED` ou `CANCELLED`, confirme a falha e restaure o valor reservado.
5. Se o saque não for encontrado, valide o mesmo `externalId` no painel/suporte da AbacatePay e aguarde a janela operacional definida. Só use **Tentar novamente** depois de evidência explícita de que nenhuma transferência foi criada.
6. Se houver conclusão tardia e saldo insuficiente para o débito, mantenha o bloqueio. Resolva a insuficiência por procedimento financeiro aprovado e use **Liquidar conclusão tardia** somente quando o saldo estiver disponível.

Cada reconsulta e decisão incrementa os dados de reconciliação; as decisões de tentar novamente, restaurar ou liquidar são gravadas em `admin_financial_audit_log`.

## Incidente e evidências

Registre no chamado operacional:

- UUID/`externalId` do saque;
- ID da transferência retornado pelo gateway, se existir;
- horários da solicitação, última reconciliação e webhook;
- estado local e estado informado pela AbacatePay;
- evidência usada e decisão do operador.

Nunca registre chave da API, assinatura HMAC, JWT, chave Pix completa ou resposta bruta contendo dados pessoais. O backend também não grava a resposta bruta do gateway nos logs.

## Antes de liberar dinheiro real

1. Rotacione a chave sandbox compartilhada durante o desenvolvimento e crie uma chave de produção dedicada com o menor conjunto de permissões necessário.
2. Mantenha `ALLOW_SANDBOX_PAYMENT_SIMULATION=false` em produção.
3. Confirme criação, consulta, conclusão e falha de saque na homologação/produção controlada, inclusive os webhooks `transfer.completed` e `transfer.failed`.
4. Execute `npm run test:staging:financial`, confirme a fila administrativa e depois execute `npm run cleanup:staging:financial`.
5. Verifique que o painel mostra zero saques presos ou em revisão antes de iniciar o piloto.

Referências oficiais: [autenticação e permissões](https://docs.abacatepay.com/pages/authentication), [criar saque](https://docs.abacatepay.com/api-reference/criar-um-novo-saque) e [buscar saque](https://docs.abacatepay.com/api-reference/buscar-saque).
