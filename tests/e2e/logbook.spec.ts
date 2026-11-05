import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** A fixed Tuesday, far from the demo's sample days. */
const DAY = '2030-01-08';

async function openDemoDay(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Probar la demo' }).click();
  await page.goto(`./#/dia/${DAY}`);
  await expect(page.getByRole('heading', { name: /8 de enero/i })).toBeVisible();
}

async function capture(page: Page, notes: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Anota lo que hiciste' }).fill(notes);
  await page.getByRole('button', { name: 'Agregar al día' }).click();
}

test('login screen offers only the demo without Supabase', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByLabel('Correo')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Probar la demo' })).toBeEnabled();
});

test('boots with Supabase configured and offers sign-in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://localhost:4174/');
  await expect(page.getByLabel('Correo')).toBeEnabled();
  await expect(page.getByLabel('Contraseña')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();

  await page.getByRole('button', { name: /Olvidaste tu contraseña/ }).click();
  await expect(page.getByRole('button', { name: 'Enviar código' })).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeHidden();
  await page.getByRole('button', { name: 'Entrar con contraseña' }).click();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  expect(errors).toEqual([]);

  await page.getByRole('button', { name: 'Probar la demo' }).click();
  await expect(page.getByRole('textbox', { name: 'Anota lo que hiciste' })).toBeVisible();
});

test('reports wrong credentials without leaving the login', async ({ page }) => {
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({ status: 400, json: { error_code: 'invalid_credentials' } }),
  );
  await page.goto('http://localhost:4174/');
  await page.getByLabel('Correo').fill('ana@example.test');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
});

test('never loads the Supabase SDK when it is not configured', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await openDemoDay(page);
  expect(requests.some((url) => url.includes('supabaseClient'))).toBe(false);
});

test('turns quick notes into a scheduled day', async ({ page }) => {
  await openDemoDay(page);
  await capture(
    page,
    '1207 1h\n1190 2h reprotes\n1215 1h facturas\n1211 2h usuarios\n1204 2h facturas',
  );

  await expect(page.getByText('8h de 8h')).toBeVisible();
  await expect(page.getByText('Daily Scrum', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('12:00–13:00')).toBeVisible();
  await expect(page.getByText('15:00–17:00')).toBeVisible();
  await expect(page.getByLabel('Módulo de 1207')).toHaveValue('Inventario');
  await expect(page.getByLabel('Módulo de 1190')).toHaveValue('Reportes');
});

test('warns about missing hours and blocks export until the module is fixed', async ({ page }) => {
  await openDemoDay(page);
  await capture(page, '9001 2h');

  await expect(page.getByText('9001: falta el módulo.')).toBeVisible();
  await expect(page.getByText('Llevas 2h de 8h esperadas.')).toBeVisible();

  await page.getByRole('link', { name: 'Exportar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Corregir' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /8 de enero/i })).toBeDisabled();

  await page.goto(`./#/dia/${DAY}`);
  await page.getByLabel('Módulo de 9001').fill('Core');
  await page.getByLabel('Módulo de 9001').press('Enter');
  await expect(page.getByText('9001: falta el módulo.')).toBeHidden();
});

test('keeps support notes without hours as pending and registers them later', async ({ page }) => {
  await openDemoDay(page);
  await capture(page, 'Apoyo revisar conteo de ausencias');

  const item = page.getByRole('listitem').filter({ hasText: 'revisar conteo de ausencias' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Registrar' }).click();

  const textbox = page.getByRole('textbox', { name: 'Anota lo que hiciste' });
  await expect(textbox).toHaveValue('no plan  revisar conteo de ausencias');
  await textbox.fill('no plan 1h core revisar conteo de ausencias');
  await page.getByRole('button', { name: 'Agregar al día' }).click();

  await expect(page.getByLabel('Módulo de No plan')).toHaveValue('Core');
  await expect(page.getByRole('button', { name: /Quitar pendiente: revisar/ })).toBeHidden();
});

test('keeps unsaved notes after closing the page and until they are added', async ({ page }) => {
  await openDemoDay(page);
  const notes = page.getByRole('textbox', { name: 'Anota lo que hiciste' });
  await notes.pressSequentially('1207 1h');

  await page.reload();
  await expect(notes).toHaveValue('1207 1h');

  await page.getByRole('link', { name: 'Día siguiente' }).click();
  await expect(notes).toHaveValue('');
  await page.getByRole('link', { name: 'Día anterior' }).click();
  await expect(notes).toHaveValue('1207 1h');

  await page.getByRole('link', { name: 'Exportar', exact: true }).click();
  await expect(page.getByText('Tienes notas sin agregar al día:')).toBeVisible();
  await page.getByRole('link', { name: /8 de enero/i }).click();

  await notes.pressSequentially('\n1190 2h');
  await page.getByRole('button', { name: 'Agregar al día' }).click();
  await expect(notes).toHaveValue('');
  await expect(page.getByLabel('Módulo de 1190')).toHaveValue('Reportes');

  await page.reload();
  await expect(notes).toHaveValue('');
});

test('adds an activity with the direct form and reorders it', async ({ page }) => {
  await openDemoDay(page);
  await capture(page, '1207 2h');

  await page.getByRole('button', { name: 'Agregar actividad' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar actividad' });
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(dialog.getByText('Escribe el número de ticket.')).toBeVisible();

  await dialog.getByRole('textbox', { name: /^Ticket/ }).fill('1190');
  await dialog.getByLabel('Tiempo').fill('1.5');
  await expect(dialog.getByLabel(/Módulo/)).toHaveAttribute('placeholder', /Reportes/);
  await dialog.getByLabel(/Descripción/).fill('Ajuste de totales');
  await dialog.getByRole('button', { name: 'Agregar y seguir' }).click();

  await expect(dialog.getByRole('textbox', { name: /^Ticket/ })).toHaveValue('');
  await dialog.getByRole('combobox', { name: /^Tipo/ }).selectOption('noPlan');
  await dialog.getByLabel('Tiempo').fill('30m');
  await dialog.getByLabel(/Módulo/).fill('core');
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByLabel('Módulo de 1190')).toHaveValue('Reportes');
  await expect(page.getByLabel('Descripción de 1190')).toHaveValue('Ajuste de totales');
  await expect(page.getByLabel('Módulo de No plan')).toHaveValue('Core');
  await expect(page.getByText('10:00–11:30')).toBeVisible();

  await page.getByRole('button', { name: 'Subir 1190' }).click();
  await expect(page.getByText('08:00–09:30')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Subir 1190' })).toBeDisabled();
});

test('downloads a Windows-1252 CSV and marks the days as exported', async ({ page }) => {
  await openDemoDay(page);
  await capture(page, '1207 2h\n1190 3h\n1215 3h facturas');
  await page.getByRole('link', { name: 'Exportar', exact: true }).click();

  const preview = page.getByRole('complementary', { name: 'Vista previa del CSV' });
  await expect(preview).toContainText('08/01/2030,08:30,09:00,00:30,,Daily Scrum');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar CSV/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Bitacora_\d{8}\.csv$/);

  const bytes = await readFile(await download.path());
  const text = new TextDecoder('windows-1252').decode(bytes);
  expect(bytes.includes(0xf3)).toBe(true);
  expect(bytes.includes(Buffer.from('ó', 'utf8'))).toBe(false);
  expect(text.startsWith('Fecha,Inicio,Fin,Duracion,Modulo,Categoria,Subcat PSP,Bug,')).toBe(true);
  expect(text).toContain(
    '08/01/2030,14:00,17:00,03:00,Facturas,Programación,,,,,,,1215,Ana Ejemplo\r\n',
  );

  await expect(page.getByText(/listo con \d+ días?/)).toBeVisible();
  await expect(page.getByText('No tienes días pendientes de exportar.')).toBeVisible();
});

test('flags a day edited after exporting and warns before repeating it', async ({ page }) => {
  await openDemoDay(page);
  await capture(page, '1207 8h');
  await page.getByRole('link', { name: 'Exportar', exact: true }).click();
  await page.getByRole('button', { name: /Descargar CSV/ }).click();
  await expect(page.getByText(/listo con/)).toBeVisible();

  await page.goto(`./#/dia/${DAY}`);
  await expect(page.getByRole('main').locator('header').getByText('Exportado')).toBeVisible();
  await page.getByLabel('Horas de 1207').fill('7h');
  await page.getByLabel('Horas de 1207').press('Enter');
  await expect(
    page.getByRole('main').locator('header').getByText('Cambió tras exportar'),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Exportar', exact: true }).click();
  await page.getByText(/Ya exportados/).click();
  await page.getByRole('checkbox').last().check();
  await expect(page.getByText(/ya se exportó|ya se exportaron/)).toBeVisible();
});

test('marks a day off with no rows', async ({ page }) => {
  await openDemoDay(page);
  await page.getByLabel('Jornada').selectOption('off');
  await expect(page.getByText('Día libre: no se exporta ninguna fila.')).toBeVisible();
});

test('imports a history file without touching existing days', async ({ page }) => {
  await openDemoDay(page);
  await page.getByRole('link', { name: 'Ajustes' }).click();

  const csv =
    'Fecha,Inicio,Fin,Duracion,Modulo,Categoria,Actividad,Solicitado por\r\n' +
    '7/1/2030,08:00,12:00,04:00,Compras,Programaci\xf3n,7001,Ana Ejemplo\r\n' +
    '7/1/2030,13:00,17:00,04:00,compras,Programaci\xf3n,7002,Ana Ejemplo\r\n';
  await page.getByLabel('Archivo CSV de historial').setInputFiles({
    name: 'historial.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'latin1'),
  });

  await expect(page.getByText('2 de 2 filas listas, en 1 día.')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 1 día' }).click();
  await expect(page.getByText('Importación lista: 1 día.')).toBeVisible();

  await page.goto(`./#/dia/${DAY}`);
  await capture(page, '7001 1h');
  await expect(page.getByLabel('Módulo de 7001')).toHaveValue('Compras');
});

test('saves settings', async ({ page }) => {
  await openDemoDay(page);
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByLabel('Inicio del nombre del archivo').fill('Bitacora_Ana');
  await page.getByRole('button', { name: 'Guardar ajustes' }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Inicio del nombre del archivo')).toHaveValue('Bitacora_Ana');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test('keeps notes after the phone closes the page', async ({ page }) => {
    await openDemoDay(page);
    const notes = page.getByRole('textbox', { name: 'Anota lo que hiciste' });
    await notes.fill('1207 1h');
    await page.reload();
    await expect(notes).toHaveValue('1207 1h');
  });

  const expectNoOverflow = async (page: Page) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  };

  test('completes the daily flow with the bottom bar and large targets', async ({ page }) => {
    await openDemoDay(page);
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeInViewport();
    await expect(page.getByLabel('Calendario')).toBeHidden();

    await capture(page, '1207 2h\n1190 3h\n1215 3h facturas');
    await expect(page.getByText('8h de 8h')).toBeVisible();
    await expectNoOverflow(page);

    const hours = page.getByLabel('Horas de 1207');
    const fontSize = await hours.evaluate((input) => getComputedStyle(input).fontSize);
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(16);

    const button = await page.getByRole('button', { name: 'Bajar 1207' }).boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect(button?.width).toBeGreaterThanOrEqual(44);

    await page.getByRole('link', { name: 'Exportar', exact: true }).click();
    await expect(page.getByRole('button', { name: /Descargar CSV/ })).toBeVisible();
    await expectNoOverflow(page);

    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(page.getByRole('button', { name: 'Salir de la demo' })).toBeVisible();
    await expectNoOverflow(page);
  });

  test('opens the direct form as a sheet that fits the screen', async ({ page }) => {
    await openDemoDay(page);
    await page.getByRole('button', { name: 'Agregar actividad' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar actividad' });
    await expect(dialog.getByRole('textbox', { name: /^Ticket/ })).toBeFocused();
    const box = await dialog.boundingBox();
    expect(box?.width).toBe(375);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(667);

    await dialog.getByRole('textbox', { name: /^Ticket/ }).fill('1190');
    await dialog.getByLabel('Tiempo').fill('1h');
    await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByLabel('Módulo de 1190')).toHaveValue('Reportes');
  });
});
