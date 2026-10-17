# Architecture

## Request flow

```mermaid
flowchart TD
    A["Client<br/>POST /send<br/>Authorization: Bearer [token]"]

    subgraph Middleware
        B["app.ts<br/>bearerAuth middleware<br/>Checks Authorization header<br/>401 if invalid"]
    end

    subgraph Route
        C["routes/send.route.ts<br/>Parse JSON body<br/>Call validator<br/>Call service<br/>Return ok/error response"]
    end

    subgraph Internal_Modules
        D["validators/send.validator.ts<br/>Pure validation<br/>Throws ValidationError"]
        E["services/mailer.service.ts<br/>Nodemailer transport to SMTP server"]
    end

    A --> B
    B --> C
    C --> D
    C --> E
```

## Module responsibilities

| Module                         | Responsibility                                         | Touches                        |
| ------------------------------ | ------------------------------------------------------ | ------------------------------ |
| `index.ts`                     | Bun HTTP server bootstrap                              | `Bun.serve` via default export |
| `app.ts`                       | Hono instance, global middleware, route mounting       | `hono`, `hono/bearer-auth`     |
| `routes/send.route.ts`         | HTTP concerns — parse, validate, call service, respond | `Hono`, validator, service     |
| `validators/send.validator.ts` | Pure request-body validation                           | Nothing else                   |
| `services/mailer.service.ts`   | SMTP transport, `sendMail()`                           | `nodemailer` only              |
| `config/env.ts`                | Environment variable parsing + defaults                | `process.env`                  |
| `types/index.ts`               | Shared TypeScript interfaces                           | Nothing else                   |

## Error handling strategy

| Layer              | Handles                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| **Route**          | Catches `ValidationError` → `400`, SMTP errors → `502`, unknown → `500` |
| **Validator**      | Throws `ValidationError` with caller-safe messages                      |
| **Service**        | Lets SMTP errors bubble up to the route                                 |
| **App middleware** | Hono `bearerAuth` returns `401` automatically                           |
