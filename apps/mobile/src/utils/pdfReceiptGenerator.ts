import { Order, formatCurrencyBRL } from '@servicos/shared';

export function generateOrderReceiptPDF(order: Order) {
  const clientName = order.client?.fullName || 'Cliente RooServ';
  const clientPhone = order.client?.phone || '(66) 99999-0000';
  const clientNeighborhood = order.client?.neighborhood || 'Rondonópolis - MT';

  const providerName = order.provider?.profile?.fullName || 'Profissional Parceiro';
  const providerPhone = order.provider?.profile?.phone || '(66) 99999-0000';
  const providerNeighborhood = order.provider?.profile?.neighborhood || 'Rondonópolis - MT';

  const formattedTotal = formatCurrencyBRL(order.totalAmount);
  const formattedProvider = formatCurrencyBRL(order.providerPayoutAmount);
  const formattedPlatform = formatCurrencyBRL(order.platformFeeAmount);
  const completionDate = order.completedAt
    ? new Date(order.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const receiptHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Recibo e Termo de Garantia - ${order.orderNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; }
        body { padding: 40px; background-color: #ffffff; line-height: 1.5; font-size: 14px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
        .logo { font-size: 24px; font-weight: 900; color: #0f172a; }
        .logo span { color: #2563eb; }
        .tagline { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-top: 2px; }
        .receipt-badge { background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 12px; font-weight: 800; padding: 6px 14px; rounded-radius: 8px; text-transform: uppercase; }
        .order-info { margin-top: 10px; font-size: 12px; color: #475569; }
        .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 10px; letter-spacing: 0.5px; }
        .grid-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .party-box p { font-size: 13px; color: #334155; margin-bottom: 4px; }
        .party-box strong { color: #0f172a; }
        .service-details { margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background-color: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 800; color: #475569; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .financial-summary { display: flex; justify-content: flex-end; margin-top: 16px; }
        .summary-box { width: 280px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: #475569; }
        .summary-row.total { font-size: 16px; font-weight: 900; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
        .warranty-card { margin-top: 30px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; }
        .warranty-card h4 { font-size: 14px; font-weight: 800; color: #1e40af; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .warranty-card p { font-size: 12px; color: #1e3a8a; leading-relaxed; }
        .footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">Roo<span>Serv</span></div>
          <div class="tagline">Plataforma de Serviços de Rondonópolis - MT</div>
          <div class="order-info">Contrato Nº <strong>${order.orderNumber}</strong> • Emitido em ${completionDate}</div>
        </div>
        <div>
          <span class="receipt-badge">✓ Pagamento & Serviço Concluído</span>
        </div>
      </div>

      <div class="grid-parties">
        <div class="party-box">
          <div class="section-title">Contratante (Cliente)</div>
          <p><strong>Nome:</strong> ${clientName}</p>
          <p><strong>WhatsApp/Telefone:</strong> ${clientPhone}</p>
          <p><strong>Bairro:</strong> ${clientNeighborhood}</p>
          <p><strong>Cidade:</strong> Rondonópolis - MT</p>
        </div>

        <div class="party-box">
          <div class="section-title">Contratado (Prestador)</div>
          <p><strong>Nome:</strong> ${providerName}</p>
          <p><strong>WhatsApp/Telefone:</strong> ${providerPhone}</p>
          <p><strong>Bairro:</strong> ${providerNeighborhood}</p>
          <p><strong>Verificação:</strong> Identidade Verificada RooServ</p>
        </div>
      </div>

      <div class="service-details">
        <div class="section-title">Detalhamento do Serviço Executado</div>
        <table>
          <thead>
            <tr>
              <th>Descrição do Atendimento</th>
              <th>Status</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${order.serviceTitle || 'Serviço sob Demanda'}</strong><br/>
                <span style="font-size: 12px; color: #64748b;">${order.serviceDescription || 'Atendimento realizado conforme orçamento aprovado na plataforma RooServ.'}</span>
              </td>
              <td><span style="color: #059669; font-weight: bold;">100% Finalizado</span></td>
              <td style="text-align: right; font-weight: bold;">${formattedTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="financial-summary">
        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal do Serviço:</span>
            <strong>${formattedTotal}</strong>
          </div>
          <div class="summary-row">
            <span>Taxa de Intermediação & Seguro:</span>
            <span>${formattedPlatform}</span>
          </div>
          <div class="summary-row">
            <span>Repasse Líquido ao Profissional:</span>
            <span>${formattedProvider}</span>
          </div>
          <div class="summary-row total">
            <span>Valor Total Pago:</span>
            <span>${formattedTotal}</span>
          </div>
        </div>
      </div>

      <div class="warranty-card">
        <h4>🛡️ Certificado de Cobertura e Garantia RooServ (60 Dias)</h4>
        <p>
          Este comprovante certifica que o serviço acima foi contratado e intermediado pela plataforma RooServ em Rondonópolis - MT sob custódia financeira. O contratante possui garantia de 60 dias contra defeitos de execução e suporte direto da equipe de moderação.
        </p>
      </div>

      <div class="footer">
        <span>RooServ Rondonópolis • CNPJ Intermediação • www.rooserv.com.br</span>
        <span>Autenticação: ${order.id.slice(0, 18).toUpperCase()}</span>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  }
}
