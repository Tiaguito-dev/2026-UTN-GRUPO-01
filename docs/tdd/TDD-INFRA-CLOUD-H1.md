# TDD-INFRA-CLOUD-H1: Despliegue en la nube del MVP (Vercel, Render y Neon)

Estado: Aprobado
Autor: Equipo 2026 UTN Grupo 01
Fecha: 2026-09-27

## 1. Contexto de Negocio (el "Qué")

### 1.1. Objetivo

Definir la arquitectura de infraestructura y despliegue en la nube para publicar el MVP en Internet
con costo cero, manteniendo la compatibilidad estricta con el stack actual (NestJS, Next.js y
PostgreSQL con Prisma) y preservando el entorno de desarrollo local con Docker Compose.

### 1.2. User Personas

- **Docentes y evaluadores:** Acceden al MVP público mediante una URL HTTPS sin necesidad de
  instalar software local ni clonar el repositorio.
- **Desarrolladores del equipo:** Despliegan automáticamente cambios desde GitHub sin alterar el
  flujo de desarrollo local.

### 1.3. Criterios de Aceptación (User Stories)

- Como usuario, quiero acceder a la interfaz web mediante un dominio público HTTPS provisto por
  Vercel.
- Como evaluador, quiero que el frontend consulte al backend en la nube y este responda
  correctamente (verificado inicialmente con `GET /health`).
- Como desarrollador, quiero que el backend se conecte a una base de datos PostgreSQL en la nube
  (Neon) mediante la variable `DATABASE_URL` sin alterar el código de Prisma.
- Escenario de éxito: Dado un commit integrado en `main`, cuando los servicios de CI/CD de Vercel y
  Render compilan las aplicaciones, entonces el frontend y el backend quedan disponibles en
  Internet y comunicados entre sí.
- Escenario de borde (hibernación en Render): Dado el backend inactivo por más de 15 minutos en el
  plan gratuito de Render, cuando se recibe una petición, entonces el servicio reanuda su ejecución
  y responde tras el tiempo de arranque en frío (*cold start* ~30-50s) sin fallar con error 500.

### 1.4. Qué no vamos a hacer en esta fase

- No contrataremos planes de pago ni ingresaremos tarjetas de crédito.
- No adaptaremos NestJS como funciones Serverless dentro de Vercel para no distorsionar la
  arquitectura del framework ni introducir complejidad prematura con adaptadores efímeros.
- No eliminaremos Docker Compose local; el contenedor local de PostgreSQL sigue siendo el entorno de
  desarrollo por defecto para no depender de conexión a Internet ni alterar datos de producción.
- No configuraremos dominios personalizados de pago; utilizaremos los subdominios provistos
  gratuitamente (`*.vercel.app` y `*.onrender.com`).

---

## 2. Diseño Técnico (el "Cómo")

### 2.1. Modelo de Dominio (Entidad)

No se define un modelo de dominio en este hito — es una decisión de infraestructura de despliegue,
no de dominio de negocio. El modelo de dominio sigue siendo el que define (o todavía no define)
cada TDD funcional.

### 2.2. Contrato de API

No se agregan endpoints nuevos en este hito. Se reutiliza el contrato ya definido en
`TDD-STACK-H1.md` (`GET /health`) como verificación de que el backend desplegado en Render responde
y es alcanzable desde el frontend en Vercel.

### 2.3. Esquema de Persistencia

Sin cambios respecto a `TDD-STACK-H1.md`: PostgreSQL administrado por Prisma ORM. Este hito solo
cambia dónde corre la base de datos (Neon en la nube en vez del contenedor local), no su esquema ni
el adapter (`@prisma/adapter-pg`).

**Por qué elegimos este camino y no otro:**

* **¿Por qué Neon para la Base de Datos?** Render ofrece bases de datos PostgreSQL en su plan
  gratis pero expiran a los 30 días. Neon ofrece un nivel gratuito permanente para bases de datos
  PostgreSQL, con alta disponibilidad, consola web y compatibilidad completa con Prisma.

## 3. Arquitectura y Flujo

### 3.1. Definición del Puerto (Repository Interface)

No aplica un puerto de repositorio de dominio en este hito. Los componentes de sistema involucrados
son tres proveedores especializados:

```
[ Navegador del Usuario ]
           │
           ▼ (HTTPS)
 [ Vercel: Frontend Next.js ]
           │
           ▼ (HTTPS / REST API)
 [ Render: Backend NestJS ]
           │
           ▼ (TCP / SSL 5432)
 [ Neon: PostgreSQL Cloud ]
```

1. **Frontend (Vercel):** Aloja la aplicación Next.js. Vercel compila el workspace `front/` de forma
   nativa y distribuye los assets mediante su red global (Edge Network).
2. **Backend (Render):** Aloja el backend NestJS como un *Web Service* Node.js. Ejecuta el proceso
   continuo tradicional escuchando en el puerto asignado dinámicamente por la variable `PORT`.
3. **Base de Datos (Neon):** Aloja PostgreSQL en un esquema Serverless en la nube, con soporte
   nativo para SSL y compatible con `@prisma/adapter-pg`.

### 3.2. Lógica del Caso de Uso

1. Un commit se integra en `main`.
2. Vercel detecta el push y compila el workspace `front/`.
3. Render detecta el push, compila y levanta el workspace `back/`, escuchando en el puerto asignado
   por la variable `PORT`.
4. El backend se conecta a Neon mediante `DATABASE_URL` (con `sslmode=require`).
5. El frontend consulta al backend mediante `NEXT_PUBLIC_API_URL`; `GET /health` confirma que ambos
   servicios están arriba y comunicados.

**Configuración de Entornos y Variables:**

| Servicio | Variable | Propósito | Ejemplo en Producción |
|---|---|---|---|
| **Render (Back)** | `DATABASE_URL` | Cadena de conexión segura hacia Neon | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| **Render (Back)** | `PORT` | Puerto asignado por Render para escuchar HTTP | Asignado automáticamente por Render |
| **Vercel (Front)** | `NEXT_PUBLIC_API_URL` | URL pública del backend en Render | `https://utn-back.onrender.com` |

**Por qué elegimos este camino y no otro:**

* **¿Por qué Render para el Backend en vez de Vercel?**
  NestJS es un framework diseñado para correr como un proceso persistente (`app.listen(port)`).
  Vercel fuerza un modelo Serverless donde cada endpoint es una función efímera. Adaptar NestJS a
  Serverless en Vercel requiere bibliotecas de emulación, introduce límites estrictos de tiempo de
  ejecución y complica el pool de conexiones con PostgreSQL. Render corre el código tal cual está en
  [back/package.json](../../back/package.json) sin tocar una sola línea.
* **¿Por qué no usar Docker en Producción para este hito?**
  Alojar contenedores Docker propios en la nube requiere configurar máquinas virtuales (ej. EC2,
  Droplets) o clústeres que exceden el presupuesto (no gratuitos) o agregan sobrecarga de
  mantenimiento que no aporta valor al objetivo académico de este MVP.

---

## 4. Casos de Borde y Manejo de Errores

Precondiciones: `DATABASE_URL` con `sslmode=require` configurado en Render, `NEXT_PUBLIC_API_URL`
configurado en Vercel apuntando al backend desplegado.

| Escenario de Error | Validación / Regla de Negocio | Código HTTP |
|---|---|---|
| Cold Start de Render | El plan gratuito suspende el contenedor tras 15 minutos sin tráfico; la primera petición lo reactiva. | N/A — no es un error, es latencia de arranque en frío (~30-50s) antes de responder 200. |
| Bloqueo por CORS | Frontend (`*.vercel.app`) y backend (`*.onrender.com`) en dominios distintos; falta habilitar CORS en NestJS (`app.enableCors()`). | N/A — el navegador bloquea la respuesta antes de exponer un código de estado utilizable. |
| Fallo de SSL en Neon | Neon exige conexión TLS/SSL; falta `sslmode=require` en `DATABASE_URL`. | N/A — falla la conexión TCP/SSL antes de que exista una respuesta HTTP. |

---

## 5. Observaciones Adicionales

- **Preguntas abiertas:**
  - Confirmar compatibilidad de esta infraestructura con las decisiones todavía pendientes de
    Spike 2 (proveedor de verificación de mail) y Spike 3 (proveedor de IA para moderación) — por
    ejemplo, si el proveedor de IA elegido necesita límites de red/salida distintos en Render.
- **Detalles técnicos adicionales:**
  - El repositorio continuará utilizando npm workspaces con el archivo raíz
    [package.json](../../package.json).
  - En Render, el *Root Directory* se configurará en la raíz o en `back/`, utilizando los comandos
    de build y start correspondientes al workspace.
  - En Vercel, el *Root Directory* se configurará apuntando a `front/`.
