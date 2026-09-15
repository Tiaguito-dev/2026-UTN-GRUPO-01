# TDD-EJEMPLO-H1: Login con email y contraseña

Estado: Propuesto
Autor: (mock — reemplazar por el TDD real)
Fecha: 2026-09-14

> Este documento es un **mock**: muestra cómo se completa la plantilla (`docs/tdd/template.md`)
> con un ejemplo genérico. No representa una decisión real del proyecto — bórralo o reemplázalo
> por el primer TDD real cuando corresponda.

---

## 1. Contexto de Negocio (el "Qué")

### 1.1. Objetivo

Permitir que un usuario registrado acceda a la aplicación con su email y contraseña.

### 1.2. User Personas

- **Usuario registrado**: quiere entrar a su cuenta de forma rápida y segura.

### 1.3. Criterios de Aceptación (User Stories)

- Como usuario registrado, quiero loguearme con mi email y contraseña para acceder a mi cuenta.
  - Escenario de éxito: Given un usuario con credenciales válidas, When envía email y contraseña
    correctos, Then recibe un token de sesión.
  - Escenario de borde/fallo: Given un usuario con contraseña incorrecta, When intenta loguearse,
    Then recibe un error 401 sin detalle de cuál campo falló.

### 1.4. Qué no vamos a hacer en esta fase

- Login social (Google, GitHub, etc.).
- Recuperación de contraseña.

## 2. Diseño Técnico (el "Cómo")

### 2.1. Modelo de Dominio (Entidad)

```
Usuario
  id: string
  email: string
  passwordHash: string
```

### 2.2. Contrato de API

```
POST /auth/login
Body:    { email: string, password: string }
200 OK:  { token: string }
```

### 2.3. Esquema de Persistencia

```
Usuario
  id            string  (PK)
  email         string  (unique)
  password_hash string
```

**Por qué elegimos este camino y no otro**: se guarda `passwordHash`, nunca la contraseña en
texto plano — estándar de la industria para minimizar el impacto de una fuga de datos.

## 3. Arquitectura y Flujo

### 3.1. Definición del Puerto (Repository Interface)

```
UsuarioRepository
  findByEmail(email: string): Usuario | null
```

Consumido por el backend (caso de uso `Login`).

### 3.2. Lógica del Caso de Uso

1. Validar que `email` y `password` no estén vacíos.
2. Buscar el usuario por email vía `UsuarioRepository`.
3. Si no existe, devolver 401 genérico (no revelar si el email existe o no).
4. Comparar `password` contra `passwordHash` (hash + verificación, no comparación directa).
5. Si coincide, generar y devolver un token de sesión.

**Por qué elegimos este camino y no otro**: el error 401 es genérico en los pasos 3 y 4 para no
filtrar si el email está registrado (previene enumeración de usuarios).

## 4. Casos de Borde y Manejo de Errores

Precondición: el usuario ya debe existir en el sistema (este TDD no cubre el registro).

| Escenario de Error | Validación / Regla de Negocio | Código HTTP |
|---|---|---|
| Email o password vacíos | Validación de entrada | 400 |
| Email no registrado | No revelar existencia del email | 401 |
| Contraseña incorrecta | Hash no coincide | 401 |

## 5. Observaciones Adicionales

- **Preguntas abiertas**: ¿el token es JWT o de sesión con storage server-side? Depende del stack
  que se elija.
- **Detalles técnicos adicionales**: ninguno concreto todavía — se completa cuando haya stack
  definido (ej. librería de hashing a usar).
