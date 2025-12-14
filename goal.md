You have correctly identified a potential "backdoor." Since the official Gemini CLI creates a local credentials file (typically ~/.gemini/oauth_creds.json), you can theoretically use these credentials to power claude-code-router.
Here is the technical breakdown of how you could achieve this, along with the specific code changes required, since the router does not support this out of the box.
1. Locate the Credentials
First, verify you have the file. It is usually located here:
 * Mac/Linux: ~/.gemini/oauth_creds.json
 * Windows: C:\Users\YourName\.gemini\oauth_creds.json
This file contains a JSON object with:
 * access_token (Short-lived, usually 1 hour)
 * refresh_token (Long-lived)
2. Why "Just Copying" Doesn't Work
You cannot simply paste this token into the api_key field of the router's config.json.
 * API Keys use the header: x-goog-api-key: <key>
 * OAuth Tokens use the header: Authorization: Bearer <token>
The claude-code-router code currently assumes you are using an API key. To use your CLI token, you must modify the router's source code to change the authentication header.
3. How to Modify the Router Code (The "Hack")
If you are comfortable editing JavaScript/TypeScript, you can modify the router to read your CLI credentials.
Step A: Fork & Clone
Clone the claude-code-router repository to your machine so you can edit it.
Step B: Edit the Gemini Provider
Look for the file handling Gemini requests (likely in src/providers/gemini.ts or similar). You need to change the headers construction.
Current Logic (Simplified):
const headers = {
  "Content-Type": "application/json",
  "x-goog-api-key": config.apiKey // This is what creates the issue
};

New Logic (What you need):
import fs from 'fs';
import os from 'os';
import path from 'path';

// 1. Read the CLI credentials file
const credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

// 2. Use the Access Token
const headers = {
  "Content-Type": "application/json",
  "Authorization": Bearer ${creds.access_token} // <--- The Change
  // Remove "x-goog-api-key"
};

Step C: Handle Token Expiry (The Hard Part)
The access_token in that file expires every hour.
 * Simple fix: Run gemini login in your terminal once an hour to refresh the file.
 * Advanced fix: You would need to write code to use the refresh_token to fetch a new access_token automatically when the router gets a 401 error.
4. The "Million Dollar" Question: Does this give you Gemini Advanced?
If you successfully do this, you are authenticating as "You (The Google User)" rather than "You (The API Key Holder)."
 * Will it work? Yes. There is a community project called ai-sdk-provider-gemini-cli that already does this for other tools.
 * Is it your "Subscription"? Technically, no. You are consuming the Gemini for Google Cloud quota assigned to your personal account.
   * Good News: This quota is often separate from the standard free API tier and can be quite generous.
   * Bad News: It is still not the exact same pipeline as the gemini.google.com web chat.
Summary
Yes, the token in ~/.gemini/oauth_creds.json is enough to integrate, but only if you modify the router's source code to send Bearer tokens instead of API keys.
Recommendation:
If you don't want to maintain a custom fork of the router code, sticking to the gemini-exp models with a free API key is still the path of least resistance. But if you love tinkering, the file you found is indeed the key to "hijacking" the CLI's authentication.