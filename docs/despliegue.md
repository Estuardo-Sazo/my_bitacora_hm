# Análisis y guía de despliegue

## Dónde publicarla

| Criterio                   | GitHub Pages            | Vercel           |
| -------------------------- | ----------------------- | ---------------- |
| Herramientas adicionales   | Ninguna, todo en GitHub | Una cuenta más   |
| Despliegue al hacer push   | Con workflow            | Automático       |
| Repositorio privado gratis | No, requiere GitHub Pro | Sí               |
| Encabezados de seguridad   | No configurables        | Configurables    |
| Sitio privado              | Solo Enterprise Cloud   | Con plan de pago |

**Decisión: GitHub Pages.** Es una herramienta interna y sencilla, y así todo queda en un solo lugar.

Consideraciones aceptadas:

- El sitio es accesible en internet. Lo que protege los datos es el login y las políticas de la base.
- GitHub indica que Pages no debería usarse para operaciones sensibles como enviar contraseñas. Aquí
  la contraseña va directo de tu navegador a Supabase por HTTPS y nunca pasa por el servidor de Pages,
  pero la página que la solicita sí se sirve desde Pages.
- La app no queda atada a Pages: es un sitio estático con rutas por hash, y para migrar basta con
  publicar `dist/`.

## Pasos

### 1. Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard). Para Guatemala, `us-east-1` es la
   región más cercana.
2. Abre **SQL Editor**, pega el contenido de
   [`supabase/migrations/20261104000000_bitacora_schema.sql`](../supabase/migrations/20261104000000_bitacora_schema.sql)
   y ejecútalo.
3. En **Authentication > Users**, usa **Add user > Create new user**. Escribe tu correo y una
   contraseña, y activa **Auto Confirm User**. Así no dependes de ningún correo para entrar.
4. En **Project Settings > API**, copia la URL del proyecto y la clave publicable.

Las claves publicables pueden estar en el navegador: la protección está en las políticas de la
base. La clave `service_role` o secreta nunca debe ir en la app.

### 2. GitHub Pages

1. En el repositorio, ve a **Settings > General > Danger Zone** y hazlo público, o usa GitHub Pro para
   mantenerlo privado.
2. En **Settings > Pages**, elige **GitHub Actions** en **Source**.
3. En **Settings > Environments**, crea el entorno `Bitacora` y agrega ahí las variables de
   `.env.example`. Usa **Environment variables**, no **Secrets**: son valores públicos.
4. En **Actions**, abre **Deploy** y usa **Run workflow**. Después se publica con cada push a `main`.

La app queda en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`, en minúsculas el usuario.

### 3. Autorizar tu cuenta y el dominio

1. Abre la app y entra con tu correo y contraseña. Verás **Sin acceso** junto con tu ID, que es lo
   esperado.
2. En **SQL Editor**, autoriza tu cuenta con ese ID:

```sql
insert into public.allowed_users (user_id) values ('TU_ID');
```

3. Recarga la app.
4. En **Authentication > Sign In / Providers**, desactiva **Allow new users to sign up** para que
   nadie más cree cuentas.
5. En **Authentication > URL Configuration**, pon la dirección de la app en **Site URL** y agrégala
   en **Redirect URLs**.

La sesión se conserva en cada dispositivo: solo vuelves a escribir la contraseña si cierras sesión.

### Opcional: recuperar la contraseña

Para que **Entrar con un código** funcione, agrega esto en
**Authentication > Email Templates > Magic Link**:

```html
<p>Tu código es: <strong>{{ .Token }}</strong></p>
```

Después de entrar, cámbiala en **Ajustes > Cambiar contraseña**.

### 4. Primer uso

1. Completa **Ajustes** primero: nombres, Daily y módulos.
2. En Excel, guarda la hoja como CSV.
3. Súbelo en **Ajustes > Importar historial** y revisa el reporte antes de confirmar.

### 5. Instalarla en el teléfono

- **iPhone:** abre la app en Safari, toca **Compartir** y luego **Agregar a pantalla de inicio**.
- **Android:** abre la app en Chrome y toca **Instalar app**.

En iPhone, la app instalada no comparte sesión con Safari: inicia sesión una vez dentro de ella.

### Opcional: entrar con Google

1. En Google Cloud, crea un cliente OAuth de tipo aplicación web.
2. Agrega como URI de redireccionamiento la que indica Supabase en
   **Authentication > Sign In / Providers > Google**.
3. Pega el ID y el secreto del cliente en Supabase y activa el proveedor.
4. Cambia la variable `VITE_AUTH_GOOGLE` a `true` en GitHub y vuelve a ejecutar **Deploy**.

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
