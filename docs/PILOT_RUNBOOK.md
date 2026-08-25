# RooServ — runbook do piloto

O piloto começa somente depois de todos os gates obrigatórios do [`GO_LIVE_CHECKLIST.md`](GO_LIVE_CHECKLIST.md). O objetivo é validar operação, suporte e dinheiro real com exposição limitada, não maximizar volume.

## Preparação

- Convide manualmente um grupo pequeno de prestadores verificados e moradores conhecidos.
- Comunique horário de atendimento, canal de suporte e tempo esperado de resposta.
- Mantenha aprovação KYC, reembolso, disputa e saque sob revisão humana.
- Registre quem está de plantão para produto, banco, gateway e atendimento.
- Defina limites de usuários, pedidos e valor por pedido antes de abrir; os valores exigem aprovação do responsável e não devem ser escolhidos silenciosamente pelo código.

## Gate diário

Antes de aceitar novos pedidos, conferir no painel e no gateway:

- cobranças criadas, pagas, expiradas e divergentes;
- webhooks recebidos, duplicados e com erro;
- total do ledger versus saldos e valores reservados;
- reembolsos pendentes, concluídos e falhos;
- saques pendentes, incertos, concluídos e falhos;
- disputas abertas e tempo desde a última resposta;
- erros de autenticação, funções e frontend sem dados pessoais nos logs.

Qualquer diferença de centavos sem explicação, webhook inválido repetido, saque incerto ou falha de autorização interrompe novos saques até conciliação.

## Atendimento de incidentes

1. Preserve evidências: IDs locais, `externalId`, horários, status e request IDs. Não copie CPF, documento ou chave completa em chat/log.
2. Pare a ação que amplia o impacto: contratação, reembolso ou saque específico.
3. Consulte o gateway antes de repetir qualquer comando financeiro.
4. Reconcile pelo painel/RPC previsto; não edite saldo diretamente.
5. Registre decisão, responsável e resultado.
6. Avise usuários afetados com linguagem factual e sem prometer prazo ou cobertura não confirmados.

## Critérios de pausa do piloto

- autorização indevida entre contas ou acesso sem MFA ao admin;
- diferença entre gateway, transações e ledger;
- saque duplicado, reembolso duplicado ou estado financeiro irrecuperável;
- indisponibilidade prolongada sem canal alternativo de suporte;
- exposição de segredo, KYC, CPF ou URL assinada;
- volume acima da capacidade manual de conciliação e atendimento.

## Encerramento da primeira semana

- Reconciliar 100% das transações e decisões manuais.
- Revisar conversão, abandono, tempo de resposta e motivos de suporte sem misturar isso com o gate financeiro.
- Corrigir incidentes de severidade alta antes de ampliar usuários ou valores.
- Registrar decisão explícita de continuar, pausar ou expandir o piloto.
