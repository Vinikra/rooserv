import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blockingViolations = results.violations.filter(({ impact }) =>
    impact === 'serious' || impact === 'critical'
  );

  expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // Os fluxos públicos de UI não dependem da disponibilidade do staging.
  // Integração financeira/autorização é coberta pela suíte staging separada.
  await page.route('https://*.supabase.co/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.goto('/');
  await expect(page.getByRole('heading', {
    level: 1,
    name: /Contrate profissionais verificados/i,
  })).toBeVisible();
});

test('catálogo público é responsivo e acessível', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo principal' })).toBeAttached();
  await expect(page.getByRole('heading', { level: 2, name: 'Categorias de Serviços' })).toBeVisible();

  await expect.poll(async () => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.clientWidth,
  })));

  await expectNoSeriousAccessibilityViolations(page);
});

test('ação privada abre autenticação, contém foco e devolve foco ao fechar', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /Pedir Orçamento Grátis/i });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Entrar no RooServ' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('E-mail')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('cadastro abre termos como diálogo empilhado e mantém semântica', async ({ page }) => {
  await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
  const authDialog = page.getByRole('dialog', { name: 'Entrar no RooServ' });
  await authDialog.getByRole('button', { name: 'Criar Conta' }).click();

  const signupDialog = page.getByRole('dialog', { name: 'Criar Conta no RooServ' });
  const termsTrigger = signupDialog.getByRole('button', {
    name: 'Termos de Uso e a Política de Privacidade',
  });
  await termsTrigger.click();

  const termsDialog = page.getByRole('dialog', { name: 'Termos de Uso RooServ' });
  await expect(termsDialog).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.keyboard.press('Escape');
  await expect(termsDialog).toBeHidden();
  await expect(termsTrigger).toBeFocused();
});

test('onboarding de prestador expõe progresso e campos essenciais', async ({ page }) => {
  await page.getByRole('button', { name: 'Quero me Cadastrar' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Dados do Profissional' })).toBeVisible();
  const progress = page.getByRole('progressbar', { name: 'Progresso do cadastro profissional' });
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(progress).toHaveAttribute('aria-valuemax', '4');
  await expect(page.getByLabel('Nome Completo')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();

  await expectNoSeriousAccessibilityViolations(page);
});
