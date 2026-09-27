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

### 2.1. Topología de Infraestructura

La arquitectura de producción separa las tres capas en proveedores especializados:

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

### 2.2. Configuración de Entornos y Variables

El acoplamiento entre servicios se resuelve exclusivamente mediante variables de entorno en tiempo
de ejecución:

| Servicio | Variable | Propósito | Ejemplo en Producción |
|---|---|---|---|
| **Render (Back)** | `DATABASE_URL` | Cadena de conexión segura hacia Neon | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| **Render (Back)** | `PORT` | Puerto asignado por Render para escuchar HTTP | Asignado automáticamente por Render |
| **Vercel (Front)** | `NEXT_PUBLIC_API_URL` | URL pública del backend en Render | `https://utn-back.onrender.com` |

### 2.3. Justificación de Alternativas Evaluadas

* **¿Por qué Render para el Backend en vez de Vercel?**
  NestJS es un framework diseñado para correr como un proceso persistente (`app.listen(port)`).
  Vercel fuerza un modelo Serverless donde cada endpoint es una función efímera. Adaptar NestJS a
  Serverless en Vercel requiere bibliotecas de emulación, introduce límites estrictos de tiempo de
  ejecución y complica el pool de conexiones con PostgreSQL. Render corre el código tal cual está en
  [back/package.json](file:///c:/Users/Lucia/OneDrive/Documentos/Proyectos/Universidad/cloud-2026/back/package.json) sin tocar una sola línea.
* **¿Por qué Neon para la Base de Datos?**
  Render ofrece bases de datos PostgreSQL en su plan gratis pero expiran a los 30 días. Neon ofrece
  un nivel gratuito permanente para bases de datos PostgreSQL, con alta disponibilidad, consola web
  y compatibilidad completa con Prisma.
* **¿Por qué no usar Docker en Producción para este hito?**
  Alojar contenedores Docker propios en la nube requiere configurar máquinas virtuales (ej. EC2,
  Droplets) o clústeres que exceden el presupuesto (no gratuitos) o agregan sobrecarga de
  mantenimiento que no aporta valor al objetivo académico de este MVP.

---

## 3. Casos de Borde y Mitigaciones

| Escenario de Error / Riesgo | Causa Raíz | Mitigación Técnica |
|---|---|---|
| **Cold Start de Render** | El plan gratuito de Render suspende el contenedor tras 15 minutos sin tráfico. | Documentar el comportamiento para los evaluadores. Diseñar en el frontend un indicador de carga o reintento si la primera petición demora hasta 50 segundos. |
| **Bloqueo por CORS** | El frontend (`*.vercel.app`) y el backend (`*.onrender.com`) operan en dominios distintos. | Habilitar CORS en NestJS (`app.enableCors()`) permitiendo el origen del frontend desplegado. |
| **Fallo de SSL en Neon** | Neon exige conexiones seguras TLS/SSL. | Incluir `?sslmode=require` en el `DATABASE_URL` inyectado en Render. |

---

## 4. Observaciones para la Implementación

- El repositorio continuará utilizando npm workspaces con el archivo raíz [package.json](file:///c:/Users/Lucia/OneDrive/Documentos/Proyectos/Universidad/cloud-2026/package.json).
- En Render, el *Root Directory* se configurará en la raíz o en `back/`, utilizando los comandos de
  build y start correspondientes al workspace.
- En Vercel, el *Root Directory* se configurará apuntando a `front/`.
