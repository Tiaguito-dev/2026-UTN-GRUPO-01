# TASK-021: Sincronizar el despliegue cloud en `main` (Vercel + Render + Neon)

Estado: Pendiente. El backend quedó montado desde `desarrollo` como medida provisoria.
Fecha: 2026-10-10

## 1. Contexto y objetivo

El 2026-10-10 se montó por primera vez el despliegue cloud definido en
[docs/architecture/DEFINICION-ARQUITECTURA.md](../../architecture/DEFINICION-ARQUITECTURA.md)
(Vercel + Render + Neon). El procedimiento quedó documentado en
[infra/DESPLIEGUE-CLOUD.md](../../../infra/DESPLIEGUE-CLOUD.md).

Al configurarlo apareció que **las tres plataformas no apuntan al mismo código**, y que `main`
no sirve para desplegar el backend. Estado al cerrar la sesión:

- **Neon**: listo y es el único componente que no depende de ninguna rama. Proyecto en
  `aws-us-east-2`, las 5 migraciones aplicadas y el seed de demostración cargado (3 materias,
  5 cursadas, 8 comisiones).
- **Render**: servicio `utn-grupo-01-back` apuntando a **`desarrollo`**, no a `main`.
- **Vercel**: proyecto `utn-grupo-01-front` apuntando a `main`, que está en el commit `084e0ea`
  (PR #8). Ese front sirve `/` y devuelve 404 en todo el resto: `/login`, `/register`,
  `/account`, `/forgot-password`, `/reset-password`, `/home` y `/health`. Verificado con
  petición real: `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` descartado, el 404 lo produce la
  aplicación porque esas rutas no existen en ese commit.

El objetivo de esta tarea es que las tres plataformas sirvan `main`, y que `main` contenga todo
lo que hoy vive en `desarrollo`.

### Por qué `main` no puede desplegar el backend hoy

En `084e0ea`, `back/src/` tiene 5 archivos: `main.ts`, `app.module.ts`, el controlador de salud
y el módulo Prisma. No existe el módulo de autenticación. Son dos impedimentos distintos:

1. **No hay auth**: `app.module.ts` registra únicamente `HealthController`. Un backend servido
   desde ese commit expone `/health` y `/health/ready`, nada más.
2. **No lee `PORT`**: `main.ts` hace `Number(process.env["BACKEND_PORT"] ?? 3001)`. Render asigna
   el puerto por `PORT` y descarta el deploy si no detecta un puerto abierto, así que ese commit
   falla el despliegue incluso con el build en verde. `desarrollo` ya lo resuelve con
   `process.env["PORT"] ?? process.env["BACKEND_PORT"] ?? 3001`.

## 2. Alcance

- Llevar a `main`, con el flujo de PR habitual, todo lo pendiente de `desarrollo` y de las ramas
  de trabajo abiertas (incluye TASK-018, TASK-019 y TASK-020 cuando cierren su validación).
- Repuntar el servicio de Render de `desarrollo` a `main` una vez que `main` contenga el backend
  completo con el soporte de `AUTH_TRUSTED_PROXY_HOPS`.
- Cargar `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ALLOW_LOCAL_HTTP` en Vercel y **redesplegar** el
  front sin caché de build.
- Verificar el recorrido completo de autenticación contra las URLs públicas.
- Corregir `AUTH_PUBLIC_URL` en Render si la URL asignada no coincide con la configurada.

## 3. Fuera de alcance

- Migrar a plan de pago en Render o Neon. Las limitaciones del plan gratuito se documentan, no se
  resuelven acá.
- Dominio propio. Se usan los subdominios de `onrender.com` y `vercel.app`.
- CI/CD propio: el autodeploy por push de cada plataforma es suficiente en esta fase.
- Habilitar `pgvector`. El esquema todavía no tiene ninguna columna vectorial; cuando haga falta,
  el procedimiento está al final de `infra/DESPLIEGUE-CLOUD.md`.
- Tests — a cargo del agente de Testing (`.agents/test.md`).

## 4. Decisiones de diseño

1. **Se montó desde `desarrollo` en vez de esperar el merge a `main`.** Era la única rama
   publicada con un backend desplegable, y el objetivo de la sesión era tener el entorno en pie.
   Es deuda deliberada y esta tarea es su registro: mientras Render sirva `desarrollo` y Vercel
   sirva `main`, front y back provienen de commits distintos y el front no tiene las pantallas
   que el back ya soporta.
2. **`AUTH_TRUSTED_PROXY_HOPS` como variable nueva, excluyente de `AUTH_TRUSTED_PROXIES`.** Render
   corta TLS en su edge y reenvía HTTP plano, de modo que `request.secure` es `false` y el guard
   de transporte rechazaba con 403 todas las rutas `/auth`. El mecanismo anterior confiaba solo en
   IP/CIDR declarados — correcto con el Nginx propio del stack Docker, imposible en una plataforma
   administrada, cuyo edge no tiene dirección estable ni documentada. No se amplió
   `AUTH_TRUSTED_PROXIES` para aceptar un número porque `auth-jwt-config.spec.ts` verifica
   deliberadamente que `AUTH_TRUSTED_PROXIES="1"` falle: aceptar un conteo ahí permitiría
   falsificar `X-Forwarded-For` y vaciar el rate limiter. Contar saltos conserva esa protección,
   porque Express descarta las entradas que puso el cliente y mantiene la que agregó el edge.
3. **Cadena de conexión de Neon con `sslmode=verify-full&channel_binding=require&uselibpqcompat=true`.**
   Con `sslmode=require` a secas, `node-postgres` cifra pero no valida el certificado del
   servidor, y lo advierte por consola. Verificado contra Neon: con los tres parámetros la
   conexión valida CA y hostname contra el almacén del sistema y la advertencia desaparece.
4. **Endpoint directo de Neon, no el pooler.** Con un único proceso persistente el pool de `pg` ya
   se reutiliza entre peticiones, y `prisma migrate deploy` exige conexión directa. Si en algún
   momento Render corre más de una instancia, ahí sí corresponde el endpoint `-pooler`.
5. **Migraciones y seed desde una máquina local, no desde Render.** El plan gratuito de Render no
   da consola, y la imagen de runtime no conserva el CLI de Prisma. `dotenv` no sobreescribe
   variables ya presentes en el proceso, así que definir `DATABASE_URL` en la terminal gana sobre
   el `.env` local: es lo que evita sembrar la base equivocada.
6. **`SMTP_TIMEOUT_MS=8000` y `AUTH_PASSWORD_RESET_MIN_RESPONSE_MS=8500`.** Los 1500 ms que trae
   el ejemplo alcanzan para Mailpit en loopback, no para un handshake SMTPS contra un proveedor
   remoto desde Render. La validación exige que la respuesta mínima supere el timeout por 250 ms.
7. **`AUTH_COOKIE_SAME_SITE=none` explícito.** `vercel.app` y `onrender.com` son sitios distintos
   para el navegador. Con `lax` —el valor del `.env` de desarrollo— la cookie de sesión no viaja
   en las peticiones del front: el login parece funcionar y la sesión se pierde al recargar.

## 5. Criterios de aceptación

- `main` contiene el backend con autenticación y con soporte de `AUTH_TRUSTED_PROXY_HOPS`.
- Render sirve `main` y su último deploy está en verde.
- `https://<render>/health/ready` devuelve `{"status":"ok","service":"back"}`.
- `AUTH_PUBLIC_URL` coincide exactamente con la URL asignada por Render.
- Vercel sirve `main` con `NEXT_PUBLIC_API_URL` apuntando a la URL de Render, y las rutas
  `/login`, `/register`, `/account`, `/forgot-password` y `/reset-password` responden 200.
- Registro con un email `@alu.frlp.utn.edu.ar`, login, recarga de página con la sesión viva,
  cambio de contraseña y recuperación por email: todos funcionando contra las URLs públicas.
- La cuenta administrativa existe y entra al panel de administración.
- Ningún secreto quedó versionado: `render.yaml` conserva `sync: false` en todos los sensibles.

## 6. Validación

Pendiente de ejecución. Lo ya verificado en la sesión del 2026-10-10:

- Neon: 5 migraciones aplicadas; seed cargado; lectura confirmada con `verify-full`.
- SMTP: credenciales de aplicación de Gmail validadas con `transporter.verify()` sobre TLS 465.
- Backend: `npm run build --workspace=back` en verde con `dist/main.js` generado;
  `tsconfig.build.json` limpio; 227 tests pasando y 89 salteados por falta de `TEST_DATABASE_URL`.
- Front en Vercel: `/` responde 200; el resto de las rutas 404 por el commit desactualizado.

Queda por verificar todo lo que dependa de que Render y Vercel sirvan el mismo commit.

## 7. Limitaciones conocidas

- **Render duerme el servicio tras 15 minutos sin tráfico** en el plan gratuito; el siguiente
  pedido tarda cerca de un minuto. Antes de una defensa o demo, despertarlo.
- Ese reinicio **vacía los contadores del rate limiter**, que viven en memoria del proceso. Con
  una sola instancia persistente el límite es correcto mientras el servicio está vivo, pero no
  sobrevive al reinicio. Si hiciera falta que sobreviva, la vía es un store externo para
  `express-rate-limit`, no relajar los límites.
- Neon suspende el cómputo por inactividad; la primera consulta tras una suspensión tarda cerca
  de un segundo. No es un error.
- **No se puede crear una cuenta con rol `USER` sin un email `@alu.frlp.utn.edu.ar`.**
  `register-user.ts` llama a `validateInstitutionalEmailDomain` y el registro público es el único
  camino al rol `USER` (`provision-admin` crea siempre `ADMIN`). Sin acceso a una casilla de
  alumno de la FRLP no hay forma de probar el recorrido de un usuario común.
- `npm run typecheck --workspace=back` falla hoy en `tsconfig.test.json`: los mocks de
  `academic.use-cases.spec.ts` y `auth.use-cases.spec.ts` no implementan los métodos agregados a
  los puertos. No afecta al despliegue —`nest build` solo usa `tsconfig.build.json`, que está
  limpio— y corresponde al cierre de TASK-019/TASK-020, no a esta tarea.
- `back/tsconfig.json` tiene `incremental: true`, así que un `typecheck` en verde puede provenir
  del `.tsbuildinfo` de `back/dist/` sin haber verificado nada. Para un resultado confiable,
  correr `npm run build --workspace=back`, que borra ese directorio antes de compilar.
