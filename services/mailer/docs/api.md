# API Reference

## `POST /send`

Sends a transactional email. Requires bearer authentication.

### Authentication

Include a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <MAILER_API_KEY>
```

Missing or invalid tokens receive a `401` response with a `WWW-Authenticate` challenge.

### Request

**Content-Type:** `application/json`

```json
{
  "to": ["user@pdn.ac.lk"],
  "subject": "Sign in to SCS Portal",
  "html": "<h1>Welcome!</h1><p>Click the link to sign in.</p>",
  "text": "Welcome! Click the link to sign in: https://..."
}
```

| Field     | Type       | Required | Description                                     |
| --------- | ---------- | -------- | ----------------------------------------------- |
| `to`      | `string[]` | **yes**  | Recipient email addresses (1–50)                |
| `subject` | `string`   | **yes**  | Email subject line                              |
| `html`    | `string`   | no       | HTML body (at least one of `html`/`text`)       |
| `text`    | `string`   | no       | Plain-text body (at least one of `html`/`text`) |

### Response

#### Success — `200`

```json
{ "ok": true }
```

#### Error — `400`

Validation failure. The `error` field describes the problem:

```json
{
  "ok": false,
  "error": "\"to\" must be an array of 1–50 valid email addresses"
}
```

#### Error — `401`

Missing or invalid bearer token:

```json
{ "ok": false, "error": "Unauthorized" }
```

#### Error — `502`

SMTP delivery failure (bad gateway to the mail server):

```json
{ "ok": false, "error": "Failed to send email" }
```

### Example (curl)

```sh
curl -X POST http://localhost:3000/send \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["test@pdn.ac.lk"],
    "subject": "Hello",
    "text": "This is a test email."
  }'
```
