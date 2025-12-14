# Implementation Plan: OAuth Token Support for Gemini Provider

## Overview
Enable claude-code-router to use OAuth access tokens (instead of API keys) for Gemini provider when a custom config flag is set.

---

## User Configuration Example

### In `~/.claude-code-router/config.json`:

```json
{
  "Providers": [
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "ya29.a0AfB_byC...",  // OAuth access token (not API key)
      "useOAuthToken": true,             // ← Custom flag to enable OAuth mode
      "models": [
        "gemini-2.5-flash",
        "gemini-2.5-pro"
      ],
      "transformer": {
        "use": ["gemini"]
      }
    }
  ]
}
```

**User Responsibility:**
- Manually obtain access token from `~/.gemini/oauth_creds.json`
- Copy the `access_token` value to the `api_key` field
- Set `useOAuthToken: true`
- Manually refresh token every ~1 hour (update config and restart service)

---

## Implementation Steps

### Step 1: Identify Where Authentication Headers Are Set

**Location:** The `@musistudio/llms` package handles provider transformers.

**Files to Investigate:**
```
node_modules/@musistudio/llms/dist/cjs/server.cjs
```

**Key Question:** Does the Gemini transformer in `@musistudio/llms` support custom header injection?

**Action Items:**
1. Check if `@musistudio/llms` reads provider config for custom fields
2. Identify where Gemini transformer sets headers:
   - Current: `x-goog-api-key: <api_key>`
   - Needed: `Authorization: Bearer <oauth_token>`

---

### Step 2: Add Custom Transformer Logic (Option A - Recommended)

If `@musistudio/llms` supports custom transformers via the `transformer` field:

**Create a custom transformer:** `~/.claude-code-router/plugins/gemini-oauth.js`

```javascript
// gemini-oauth.js
module.exports = {
  name: 'gemini-oauth',

  // Transform outgoing request
  transformRequestOut: (request, provider) => {
    // If provider has useOAuthToken flag, modify headers
    if (provider.useOAuthToken) {
      // Remove API key header
      delete request.headers['x-goog-api-key'];

      // Add OAuth Bearer token
      request.headers['Authorization'] = `Bearer ${provider.api_key}`;
    }

    return request;
  }
};
```

**Update config.json:**
```json
{
  "Providers": [
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "ya29.a0AfB_byC...",
      "useOAuthToken": true,
      "models": ["gemini-2.5-pro"],
      "transformer": {
        "use": [
          ["gemini-oauth", {}],  // ← Custom transformer
          "gemini"               // ← Default Gemini transformer
        ]
      }
    }
  ]
}
```

---

### Step 3: Add Middleware Hook (Option B - Alternative)

If custom transformers don't work, modify the router middleware.

**File:** `src/index.ts` (around line 160)

**Add a new preHandler hook:**

```typescript
// src/index.ts - Add after line 159
server.addHook("preHandler", async (req, reply) => {
  if (req.url.startsWith("/v1/messages")) {
    // Check if the selected provider uses OAuth
    const modelString = req.body?.model || '';
    if (modelString.includes(',')) {
      const [providerName, modelName] = modelString.split(',');

      // Find the provider config
      const provider = config.Providers?.find(
        (p: any) => p.name.toLowerCase() === providerName.toLowerCase()
      );

      // If provider has useOAuthToken flag, store it in request
      if (provider?.useOAuthToken) {
        req.useOAuthToken = true;
        req.oauthToken = provider.api_key;
      }
    }
  }
});
```

**Then modify how credentials are passed to `@musistudio/llms`:**

This requires investigating how `@musistudio/llms` server receives provider credentials and if we can override headers at request time.

---

### Step 4: Modify Provider Configuration Passing

**File:** `src/index.ts:125-139`

**Current code:**
```typescript
const server = createServer({
  jsonPath: CONFIG_FILE,
  initialConfig: {
    providers: config.Providers || config.providers,
    HOST: HOST,
    PORT: servicePort,
  },
  logger: loggerConfig,
});
```

**Potential modification:**

```typescript
// Process providers to handle OAuth tokens
const processedProviders = (config.Providers || []).map((provider: any) => {
  if (provider.useOAuthToken) {
    return {
      ...provider,
      // Flag for the transformer to use Bearer token
      authType: 'oauth',
      oauthToken: provider.api_key
    };
  }
  return provider;
});

const server = createServer({
  jsonPath: CONFIG_FILE,
  initialConfig: {
    providers: processedProviders,
    HOST: HOST,
    PORT: servicePort,
  },
  logger: loggerConfig,
});
```

---

### Step 5: Investigate `@musistudio/llms` Source Code

**Action Required:**
Since `@musistudio/llms` is a local dependency, we need to examine its source:

```bash
# Check if source is available
ls -la node_modules/@musistudio/llms/

# Look for transformer implementation
grep -r "x-goog-api-key" node_modules/@musistudio/llms/
grep -r "gemini" node_modules/@musistudio/llms/
```

**Key files to examine:**
1. How Gemini transformer constructs headers
2. Whether it reads custom provider fields
3. If there's a hook system for modifying requests

---

### Step 6: Testing Plan

**Test Configuration:**

```json
{
  "Providers": [
    {
      "name": "gemini-oauth",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "PASTE_YOUR_ACCESS_TOKEN_HERE",
      "useOAuthToken": true,
      "models": ["gemini-2.5-flash"]
    }
  ],
  "Router": {
    "default": "gemini-oauth,gemini-2.5-flash"
  }
}
```

**Test Commands:**

```bash
# 1. Rebuild the router
npm run build

# 2. Restart service
ccr stop
ccr start

# 3. Test with a simple prompt
ccr code "Say hello"

# 4. Check logs for header format
tail -f ~/.claude-code-router/logs/*.log
```

**Expected Behavior:**
- Request headers should contain: `Authorization: Bearer ya29...`
- Should NOT contain: `x-goog-api-key`
- Should receive successful response from Gemini

**If it fails:**
- Check error message (likely 401 Unauthorized if token is expired)
- Verify token format in logs
- Confirm `useOAuthToken` flag is being read

---

## File Modifications Summary

### Files to Examine:
1. `node_modules/@musistudio/llms/dist/cjs/server.cjs` - Understand transformer system
2. `node_modules/@musistudio/llms/package.json` - Check version and source location

### Files to Potentially Modify:
1. `src/index.ts` - Add preprocessing logic for OAuth providers
2. `src/utils/router.ts` - May need to pass OAuth flag through routing
3. `~/.claude-code-router/plugins/gemini-oauth.js` - Custom transformer (if supported)

### Configuration Files:
1. `~/.claude-code-router/config.json` - User adds `useOAuthToken: true`

---

## Alternative: Quick Hack for Testing

If the transformer approach is complex, we can test with a simple proxy modification:

**File:** `src/middleware/auth.ts` (or create new middleware)

```typescript
// Quick test: Intercept and modify headers before sending to @musistudio/llms
export const oauthHeaderInjector = (config: any) => {
  return async (req: any, reply: any, done: any) => {
    // Check if this is a Gemini OAuth request
    const provider = findProviderForRequest(req, config);

    if (provider?.useOAuthToken) {
      // Somehow inject the Bearer token...
      // (This approach may not work if headers are set deeper in the stack)
    }

    done();
  };
};
```

---

## Success Criteria

- [ ] User can set `useOAuthToken: true` in provider config
- [ ] User can paste OAuth access token in `api_key` field
- [ ] Router sends `Authorization: Bearer <token>` instead of `x-goog-api-key`
- [ ] Gemini API accepts the request and returns valid responses
- [ ] No changes needed to token refresh logic (user handles manually)

---

## Next Steps

1. **Investigate** `@musistudio/llms` transformer system
2. **Choose** implementation approach (custom transformer vs middleware)
3. **Implement** header modification logic
4. **Test** with real OAuth token
5. **Document** user instructions for obtaining and updating tokens

---

## Notes

- This is a **simple implementation** - no auto-refresh
- User must manually update token every hour
- Consider adding a warning in logs when OAuth mode is enabled
- Future enhancement: Read token directly from `~/.gemini/oauth_creds.json`
