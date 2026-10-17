# Required Deployment Secrets

Secret values from source repositories are not migration inputs. Any value
that was previously committed must be treated as compromised, rotated at its
provider, and injected into the destination deployment through its secret
store. Never paste usable values into this repository, build logs, migration
notes, or issue trackers.

## `@scs/api`

Configure these Cloudflare Worker secrets from `services/api` after rotation:

```powershell
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put MAILER_API_KEY
wrangler secret put GITHUB_APP_INTERNAL_SECRET
wrangler secret put CONFIG_ACCESS_TOKEN_SECRET
```

For local development, copy `.dev.vars.example` to the ignored `.dev.vars`
file and replace every placeholder locally. Public client identifiers, redirect
URIs, service URLs, and KV binding identifiers remain in `wrangler.jsonc`.
