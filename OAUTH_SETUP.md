# Gemini OAuth Token Setup Guide

## Overview

The claude-code-router now supports using OAuth access tokens for Gemini authentication instead of API keys. This allows you to use credentials from the official Gemini CLI.

## Quick Setup

### Step 1: Get Your OAuth Access Token

You can get your OAuth token from the Gemini CLI credentials file:

**Windows:**
```bash
type %USERPROFILE%\.gemini\oauth_creds.json
```

**Mac/Linux:**
```bash
cat ~/.gemini/oauth_creds.json
```

The file contains:
```json
{
  "access_token": "ya29.a0AfB_byC...",  ← Copy this
  "refresh_token": "1//0g...",
  "token_expiry": "2024-01-15T10:30:00Z"
}
```

Or use gcloud:
```bash
gcloud auth application-default print-access-token
```

### Step 2: Configure Your Provider

Edit `~/.claude-code-router/config.json`:

```json
{
  "Providers": [
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "ya29.a0AfB_byC...",  ← Paste your OAuth token here
      "useOAuthToken": true,             ← Enable OAuth mode
      "models": [
        "gemini-2.5-flash",
        "gemini-2.5-pro"
      ]
    }
  ],
  "Router": {
    "default": "gemini,gemini-2.5-flash"
  }
}
```

### Step 3: Restart the Router

```bash
ccr stop
ccr start
```

**Expected Output:**
```
✓ Auto-registered Gemini OAuth transformer
✓ Auto-configured OAuth for provider: gemini
```

### Step 4: Test It

```bash
ccr code "Hello, test OAuth"
```

If successful, you should see a response from Gemini using your OAuth credentials!

## How It Works

### Auto-Detection

The router automatically detects providers with `useOAuthToken: true` and:
1. Registers the OAuth transformer plugin
2. Configures the transformer chain: `["gemini", "gemini-oauth-headers"]`
3. Switches authentication from `x-goog-api-key` to `Authorization: Bearer`

### Authentication Headers

**Standard API Key Mode:**
```
x-goog-api-key: AIzaSy...
```

**OAuth Token Mode (when useOAuthToken: true):**
```
Authorization: Bearer ya29.a0AfB_byC...
```

## Token Refresh

OAuth tokens expire after approximately **1 hour**.

### When Your Token Expires

You'll see an error like:
```
Error from provider(gemini,gemini-2.5-flash): 401
{
  "error": {
    "code": 401,
    "message": "Request had invalid authentication credentials",
    "status": "UNAUTHENTICATED"
  }
}
```

### How to Refresh

1. **Get new token:**
   ```bash
   # Using Gemini CLI
   cat ~/.gemini/oauth_creds.json | jq -r .access_token

   # Or using gcloud
   gcloud auth application-default print-access-token
   ```

2. **Update config:**
   Edit `~/.claude-code-router/config.json` and replace the `api_key` value

3. **Restart router:**
   ```bash
   ccr restart
   ```

## Multiple Providers

You can have both OAuth and API key providers simultaneously:

```json
{
  "Providers": [
    {
      "name": "gemini-oauth",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "ya29...",      ← OAuth token
      "useOAuthToken": true,
      "models": ["gemini-2.5-flash"]
    },
    {
      "name": "gemini-apikey",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "AIzaSy...",    ← Regular API key
      "models": ["gemini-2.5-pro"]
    }
  ],
  "Router": {
    "default": "gemini-oauth,gemini-2.5-flash",
    "background": "gemini-apikey,gemini-2.5-pro"
  }
}
```

## Troubleshooting

### Error: "OAuth token missing"

**Problem:** The `api_key` field is empty or missing

**Solution:** Add your OAuth access token to the `api_key` field

### Error: 401 Unauthorized

**Problem:** Token has expired (tokens last ~1 hour)

**Solution:** Get a fresh token and update config, then restart

### Warning: "doesn't start with ya29"

**Problem:** You may have entered an API key instead of OAuth token

**Solution:** Google OAuth tokens always start with `ya29.` - verify you copied the right value

### Transformer not auto-registered

**Problem:** No console message about auto-registration

**Solution:**
1. Verify `useOAuthToken: true` is set in provider config
2. Verify `api_base_url` contains `generativelanguage.googleapis.com`
3. Check for typos in field names (case-sensitive)

## Advanced: Manual Transformer Registration

If you prefer to manually configure the transformer (not recommended):

```json
{
  "transformers": [
    {
      "path": "~/.claude-code-router/plugins/gemini-oauth-headers.js",
      "options": {}
    }
  ],
  "Providers": [
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "ya29...",
      "useOAuthToken": true,
      "models": ["gemini-2.5-flash"],
      "transformer": {
        "use": ["gemini", "gemini-oauth-headers"]
      }
    }
  ]
}
```

## Backwards Compatibility

Existing Gemini configurations without `useOAuthToken` continue to work normally:

```json
{
  "name": "gemini",
  "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
  "api_key": "AIzaSy...",    ← Regular API key
  "models": ["gemini-2.5-flash"]
  // No useOAuthToken flag = API key mode
}
```

## Benefits of OAuth

1. **Use existing CLI credentials** - No need for separate API key
2. **Same quota as CLI** - Uses your Google Cloud quota
3. **Potentially higher limits** - May have different rate limits than free API tier

## Limitations

1. **Manual token refresh** - You must update the token every hour (no auto-refresh)
2. **No quota sharing** - Separate from gemini.google.com web chat quota
3. **Requires Google Cloud setup** - Need gcloud CLI or Gemini CLI installed

## FAQ

**Q: Can I use this to get Gemini Advanced features?**
A: You're using your Google Cloud quota, not your Gemini Advanced subscription. Features depend on the models available via the API.

**Q: How do I get my first OAuth token?**
A: Install Gemini CLI (`npm install -g @google/generative-ai-cli`), run `gemini login`, then check `~/.gemini/oauth_creds.json`

**Q: Does this work with other providers?**
A: No, this is specifically for Google Gemini providers. Other providers have their own authentication methods.

**Q: Can I automate token refresh?**
A: Not currently implemented. You must manually refresh tokens when they expire.

## Support

If you encounter issues:
1. Check logs at `~/.claude-code-router/logs/`
2. Verify token format (should start with `ya29.`)
3. Ensure transformer file exists at `~/.claude-code-router/plugins/gemini-oauth-headers.js`
4. Open an issue on GitHub with logs and config (redact sensitive tokens!)
