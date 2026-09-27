# TDD-STACK-H1: Stack tecnológico inicial

Estado: Aprobado
Autor: Equipo 2026 UTN Grupo 01
Fecha: 2026-09-24

## 1. Contexto de Negocio (el "Qué")

### 1.1. Objetivo

Establecer una base técnica única para que frontend y backend evolucionen con contratos claros,
tipado estático, persistencia relacional y una estructura preparada para modularización futura.

### 1.2. User Personas

- Integrantes del equipo que implementan módulos de frontend, backend y pruebas.
- Agentes de desarrollo que necesitan una estructura y comandos inequívocos para ejecutar tareas.

### 1.3. Criterios de Aceptación (User Stories)

- Como desarrollador, quiero instalar todas las dependencias desde la raíz para preparar el
  proyecto con un único lockfile.
- Como desarrollador backend, quiero iniciar una API NestJS conectable a PostgreSQL mediante
  Prisma ORM.
- Como desarrollador frontend, quiero iniciar una aplicación Next.js con App Router.
- Dado un entorno con Node.js 22.22.3, cuando se compilan ambos workspaces, entonces los builds
  terminan correctamente.
- Dado PostgreSQL disponible, cuando se inicia la API, entonces `GET /health` responde HTTP 200.
- Dado que falta `DATABASE_URL`, cuando se inicia la API, entonces el arranque falla con un
  mensaje explícito.

### 1.4. Qué no vamos a hacer en esta fase

- Definir entidades o reglas de negocio.
- Agregar autenticación, autorización o módulos funcionales.
- Incorporar bibliotecas de UI, testing, validación o estado global sin una tarea que las use.
- Crear imágenes o pipelines de despliegue de aplicaciones.

## 2. Diseño Técnico (el "Cómo")

### 2.1. Modelo de Dominio (Entidad)

No se define un modelo de dominio en este hito. Cada entidad se incorporará junto con su módulo,
reglas, permisos, auditoría e historial.

### 2.2. Contrato de API

`GET /health`

Respuesta HTTP 200:

```json
{
  "status": "ok",
  "service": "back"
}
```

### 2.3. Esquema de Persistencia

PostgreSQL es el motor relacional y Prisma ORM administra el esquema y las migraciones. El
esquema inicial no contiene modelos para evitar inventar contratos de dominio.

Se eligieron NestJS y Next.js porque mantienen TypeScript de extremo a extremo y separan API e
interfaz en aplicaciones desplegables de manera independiente. PostgreSQL aporta persistencia
relacional y Prisma centraliza un contrato tipado. npm workspaces conserva un único lockfile sin
acoplar los ciclos de ejecución de ambas aplicaciones.

## 3. Arquitectura y Flujo

### 3.1. Definición del Puerto (Repository Interface)

No existe todavía un repositorio de dominio. `PrismaService` constituye la infraestructura base
que los futuros repositorios consumirán, sin exponer Prisma al frontend.

### 3.2. Lógica del Caso de Uso

1. PostgreSQL se inicia mediante Docker Compose para desarrollo local.
2. Prisma genera un cliente tipado sin descargar un motor binario adicional.
3. NestJS inicia la API y comprueba la conexión mediante el ciclo de vida de `PrismaService`.
4. Next.js inicia de forma independiente y consumirá la API mediante el contrato HTTP.

La separación permite versionar y desplegar frontend y backend por separado, y extraer módulos
del backend a servicios independientes cuando exista una necesidad comprobada.

## 4. Casos de Borde y Manejo de Errores

Precondiciones: Node.js 22.22.3, npm 10 y una conexión PostgreSQL válida.

| Escenario de Error | Validación / Regla de Negocio | Código HTTP |
|---|---|---|
| Falta `DATABASE_URL` | El backend valida la variable al crear `PrismaService`; el inicio falla con un mensaje explícito. | N/A — falla antes de exponer HTTP |
| PostgreSQL no está disponible | Prisma no puede completar `$connect()`; NestJS no queda disponible como servicio saludable. | N/A — falla antes de exponer HTTP |
| Versión de Node incompatible | `engines` y `.nvmrc` fijan Node.js 22.22.3; npm informa la incompatibilidad antes de ejecutar. | N/A — falla antes de ejecutar la app |

## 5. Observaciones Adicionales

- TypeScript 6 se usa en ambos workspaces para evitar divergencias en futuros paquetes
  compartidos.
- Prisma usa el adapter JavaScript `pg` y `engineType = "client"`; no requiere descargar un
  ejecutable de motor de consultas.
- `deepmerge-ts` está fijado en una versión corregida mediante `overrides` hasta que Prisma
  actualice su dependencia transitiva.
