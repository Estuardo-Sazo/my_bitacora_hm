# Análisis y guía de despliegue

## Dónde publicarla

| Criterio                   | Vercel        | GitHub Pages           |
| -------------------------- | ------------- | ---------------------- |
| Despliegue al hacer push   | Automático    | Requiere workflow      |
| Vista previa por PR        | Incluida      | No incluida            |
| Variables de entorno       | Panel propio  | Secrets en el workflow |
| Encabezados de seguridad   | `vercel.json` | No configurables       |
| Repositorio privado gratis | Sí            | No                     |

**Decisión: Vercel.** Las vistas previas por PR y los encabezados de seguridad aportan más al flujo
de trabajo y al portafolio. El plan gratuito de Vercel es para uso personal y no comercial.

La app no queda atada a Vercel: es un sitio estático con rutas por hash, y para migrar basta con
publicar `dist/`.

## Pasos

### 1. Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard). Para Guatemala, `us-east-1` es la
   región más cercana.
2. Abre **SQL Editor**, pega el contenido de
   [`supabase/migrations/20261104000000_bitacora_schema.sql`](../supabase/migrations/20261104000000_bitacora_schema.sql)
   y ejecútalo.
3. En **Authentication > Email Templates > Magic Link**, agrega el código a la plantilla para poder
   entrar desde la app instalada:

```html
<p>Tu código es: <strong>{{ .Token }}</strong></p>
```

4. En **Project Settings > API**, copia la URL del proyecto y la clave publicable.

Las claves publicables pueden estar en el navegador: la protección está en las políticas de la
base. La clave `service_role` o secreta nunca debe ir en la app.

### 2. Vercel

1. Importa el repositorio de GitHub en [Vercel](https://vercel.com/new).
2. Agrega las variables de `.env.example` en **Settings > Environment Variables**.
3. Despliega y copia el dominio asignado.

### 3. Autorizar el dominio y tu cuenta

1. En **Authentication > URL Configuration**, pon tu dominio de Vercel en **Site URL** y agrégalo en
   **Redirect URLs**. Agrega también `http://localhost:5173/` para desarrollo.
2. Abre la app y entra con tu correo. Verás **Sin acceso** junto con tu ID, que es lo esperado.
3. En **SQL Editor**, autoriza tu cuenta con ese ID:

```sql
insert into public.allowed_users (user_id) values ('TU_ID');
```

4. Recarga la app.
5. En **Authentication > Sign In / Providers**, desactiva **Allow new users to sign up** para que
   nadie más cree cuentas.

### 4. Primer uso

1. Completa **Ajustes** primero: nombres, Daily y módulos.
2. En Excel, guarda la hoja como CSV.
3. Súbelo en **Ajustes > Importar historial** y revisa el reporte antes de confirmar.

### 5. Instalarla en el teléfono

- **iPhone:** abre la app en Safari, toca **Compartir** y luego **Agregar a pantalla de inicio**.
- **Android:** abre la app en Chrome y toca **Instalar app**.

En iPhone, la app instalada no comparte sesión con Safari: inicia sesión dentro de ella con el
código del correo.

### Opcional: entrar con Google

1. En Google Cloud, crea un cliente OAuth de tipo aplicación web.
2. Agrega como URI de redireccionamiento la que indica Supabase en
   **Authentication > Sign In / Providers > Google**.
3. Pega el ID y el secreto del cliente en Supabase y activa el proveedor.
4. Cambia `VITE_AUTH_GOOGLE` a `true` en Vercel y vuelve a desplegar.

## Límites del plan gratuito

Supabase pausa los proyectos gratuitos tras un periodo sin actividad. Si pasa, tus datos se
conservan y lo restauras desde el panel. Mientras tanto, la app sigue funcionando con la copia del
teléfono y sincroniza al restaurarlo.

## Verificación después de publicar

- En una ventana de incógnito, confirma que la app pide iniciar sesión.
- Entra con una cuenta no autorizada, antes de desactivar los registros, y confirma que ves
  **Sin acceso**.
- Entra con tu cuenta desde el teléfono, registra un día y ábrelo en otro dispositivo.
- Activa el modo avión, registra algo, recupera la señal y confirma que llega al otro dispositivo.
- En el teléfono, comparte un CSV y confirma que llega sin dañar los acentos.
- Importa un CSV de prueba en el sistema de destino.
