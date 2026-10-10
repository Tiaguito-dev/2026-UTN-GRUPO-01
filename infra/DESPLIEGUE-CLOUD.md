# Despliegue cloud (Vercel + Render + Neon)

Runbook operativo del despliegue real definido en
[docs/architecture/DEFINICION-ARQUITECTURA.md](../docs/architecture/DEFINICION-ARQUITECTURA.md).
El stack Docker de [OVERVIEW.md](OVERVIEW.md) es solo para desarrollo local.

| Componente | Plataforma | Qué se despliega |
| --- | --- | --- |
| Front Next.js | Vercel | Workspace `front/`, root directory `front` |
| Back NestJS | Render | Web Service Node, proceso persistente, blueprint [`render.yaml`](../render.yaml) |
| PostgreSQL | Neon | Base administrada, capa gratuita permanente |

## Orden obligatorio

El front necesita la URL del back y el back necesita el origen del front, así que el orden
no es opcional: **Neon → migraciones → Render → Vercel**. Las variables `NEXT_PUBLIC_*` se
incrustan durante `next build`: cambiarlas exige volver a desplegar el front, no solo guardarlas.

## Antes de empezar

1. Cuenta de GitHub con acceso a este repositorio (Neon y Render se registran con ella).
2. La URL pública del front en Vercel, por ejemplo `https://<proyecto>.vercel.app`.
3. Una casilla de correo para SMTP. El back **no arranca** sin `SMTP_USERNAME` y
   `SMTP_PASSWORD` cuando `NODE_ENV=production` (`back/src/auth/smtp.config.ts:46`).
   Lo más rápido es Gmail con contraseña de aplicación: requiere verificación en dos pasos
   activa en la cuenta, y se genera en <https://myaccount.google.com/apppasswords>.
   Host `smtp.gmail.com`, puerto `465`, `SMTP_SECURE=true`.

## Paso 1 — Neon

1. Entrar a <https://neon.tech> y registrarse con GitHub.
2. **Create project**:
   - Name: `2026-utn-grupo-01`
   - Postgres version: 17
   - Region: **AWS US East (Ohio)** — es la misma región que usa `render.yaml` (`ohio`),
     así la query no cruza el continente.
3. Al crearse, Neon muestra el panel **Connection string**. Ahí hay un selector de rama y un
   check de pooling:
   - **Desactivar "Connection pooling"**. Queremos la cadena directa, sin `-pooler` en el host.
     Con un único proceso persistente el pool de `pg` ya se reutiliza, y `prisma migrate deploy`
     exige conexión directa de todos modos.
   - La cadena se ve así:
     `postgresql://USUARIO:CLAVE@ep-algo-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. **Reemplazar los parámetros TLS** por estos tres:

   ```
   ?sslmode=verify-full&channel_binding=require&uselibpqcompat=true
   ```

   Con `sslmode=require` a secas, `node-postgres` cifra la conexión pero **no valida el
   certificado del servidor**, y lo avisa por consola al conectar. `verify-full` más
   `uselibpqcompat=true` activan la verificación de CA y de hostname contra el almacén de
   certificados del sistema; los certificados de Neon están firmados por una CA pública, así
   que no hace falta distribuir ningún CA bundle. Verificado contra Neon el 2026-10-10.
5. Guardar esa cadena en el gestor de contraseñas. Es el `DATABASE_URL` de producción, y la
   región que figura en el host debe coincidir con la `region` de [`render.yaml`](../render.yaml).

> El plan gratuito de Neon suspende el cómputo tras unos minutos sin uso. La primera consulta
> después de una suspensión tarda alrededor de un segundo; no es un error.

## Paso 2 — Migraciones y datos iniciales, desde tu máquina

Render en plan gratuito no da consola, así que el esquema y la cuenta administrativa se cargan
desde local contra Neon. Es una sola vez.

`dotenv` no sobreescribe variables ya presentes en el proceso, así que definirlas en la terminal
gana sobre el `.env` local. Verificá la cadena antes de ejecutar: apuntar sin querer a la base
local sembraría el entorno equivocado.

```powershell
cd C:\Users\tiagu\orca\2026-UTN-GRUPO-01
npm run build --workspace=back

$env:DATABASE_URL = "postgresql://...neon.tech/neondb?sslmode=require"

cd back
npx prisma migrate deploy
```

Debe listar las cinco migraciones aplicadas. Después, la cuenta administrativa y el contenido
de demostración (ambos idempotentes, se pueden repetir sin duplicar):

```powershell
$env:ADMIN_EMAIL = "admin@ejemplo.com"
$env:ADMIN_DISPLAY_NAME = "Administrador"
$env:ADMIN_PASSWORD = "<contraseña de 8 a 128 caracteres>"
npm run auth:provision-admin
npm run academic:seed
```

Cerrar esa terminal al terminar, para no dejar la cadena de producción y la contraseña en el
historial de la sesión.

## Paso 3 — Render

1. Entrar a <https://render.com> y registrarse con GitHub.
2. **New → Blueprint**. Elegir este repositorio y la rama a desplegar. Render lee
   [`render.yaml`](../render.yaml) y propone el servicio `utn-grupo-01-back`.
3. Render pide una por una las variables marcadas `sync: false`. Completar:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | La cadena directa de Neon del paso 1 |
   | `AUTH_JWT_SECRET` | Generarlo (comando abajo), nunca reutilizar el local |
   | `AUTH_PUBLIC_URL` | `https://utn-grupo-01-back.onrender.com` |
   | `AUTH_ALLOWED_ORIGINS` | La URL del front en Vercel, sin barra final |
   | `AUTH_PASSWORD_RESET_URL` | Esa misma URL + `/reset-password` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_FROM` | La casilla remitente |
   | `SMTP_USERNAME` | La misma casilla |
   | `SMTP_PASSWORD` | La contraseña de aplicación, sin espacios |

   El secreto, en una terminal local:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Tiene que ser base64url canónico de 32 bytes o la validación lo rechaza
   (`back/src/auth/auth.config.ts:66-69`).

4. **Apply**. El primer build corre `npm ci && npm run build --workspace=back`.
5. Cuando termine, Render muestra la URL real arriba del servicio. Si el nombre
   `utn-grupo-01-back` estaba tomado, le agregó un sufijo y **no coincide** con lo que cargaste
   en `AUTH_PUBLIC_URL`. En ese caso: **Environment** → corregir `AUTH_PUBLIC_URL` →
   **Manual Deploy → Deploy latest commit**.
6. Verificar: abrir `https://<url-de-render>/health/ready`. Debe responder
   `{"status":"ok","service":"back"}`. Un `503` es base inalcanzable; revisar `DATABASE_URL`.

Si el servicio no arranca, el log dice exactamente qué variable falta: el back valida
autenticación y SMTP antes de escuchar, y aborta sin quedar a medias.

## Paso 4 — Vercel

1. En el proyecto del front: **Settings → Environment Variables**. Agregar para Production:

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://<url-de-render>` exacta, sin barra ni path final |
   | `NEXT_PUBLIC_ALLOW_LOCAL_HTTP` | `false` |

2. **Deployments → el último → Redeploy.** Guardar la variable no alcanza: Next las incrusta
   en el bundle durante el build, así que el deploy viejo sigue apuntando a donde apuntaba.
3. Confirmar que el root directory del proyecto sea `front`.

## Paso 5 — Verificación de punta a punta

1. `https://<render>/health/ready` responde 200.
2. Abrir el front, **Registrarse** con un email `@alu.frlp.utn.edu.ar` — el registro público
   exige ese dominio (`back/src/auth/domain/institutional-domain.ts:3`).
3. Iniciar sesión. Si el login devuelve 403, el origen del front no coincide con
   `AUTH_ALLOWED_ORIGINS`; si entra pero la sesión se pierde al recargar, la cookie no viajó:
   revisar que `AUTH_COOKIE_SAME_SITE` siga en `none`.
4. Probar **Olvidé mi contraseña** y confirmar que llega el correo.

## Lo que hay que tener presente del plan gratuito

- **Render duerme el servicio tras 15 minutos sin tráfico.** El siguiente pedido tarda cerca
  de un minuto en levantar el proceso. En una defensa o demo, despertalo antes.
- Ese reinicio también **reinicia los contadores del rate limiter**, que viven en memoria
  (`back/src/auth/presentation/http-security.ts:42`). Con un único proceso persistente el
  límite es correcto mientras el servicio está vivo; no sobrevive al reinicio.
  Si en algún momento hace falta que sí sobreviva, la vía es un store externo para
  `express-rate-limit`, no tocar los límites.
- Neon suspende el cómputo por inactividad y lo reanuda en la primera consulta.

## Cambios de código que este despliegue requirió

`AUTH_TRUSTED_PROXY_HOPS` existe por esto. Render corta TLS en su edge y reenvía HTTP plano al
proceso, de modo que `request.secure` es `false` y el guard de transporte rechazaba con 403
todas las rutas `/auth`. El mecanismo anterior confiaba solo en IP/CIDR declarados, que es lo
correcto con un Nginx propio pero imposible en una plataforma administrada: su edge no tiene
dirección estable ni documentada. Contar un salto conserva la protección que motivaba esa
decisión — Express descarta las entradas de `X-Forwarded-For` que puso el cliente y conserva
la que agregó el edge, así que la IP del rate limiter sigue siendo la real.
Las dos variables son excluyentes: configurar ambas aborta el arranque.

## pgvector

Neon lo soporta, pero el esquema todavía no tiene ninguna columna vectorial, así que no hay
nada que habilitar. Cuando haga falta: `CREATE EXTENSION IF NOT EXISTS vector;` en la base, y
en `schema.prisma` el `previewFeatures = ["postgresqlExtensions"]` del generador más
`extensions = [vector]` en el datasource.
