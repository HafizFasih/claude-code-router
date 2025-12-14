/**
 * Gemini OAuth Header Transformer
 *
 * This transformer modifies authentication headers for Gemini providers
 * when OAuth token authentication is enabled via the useOAuthToken flag.
 *
 * Configuration example:
 * {
 *   "Providers": [
 *     {
 *       "name": "gemini",
 *       "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
 *       "api_key": "ya29.a0AfB_byC...",  // OAuth access token
 *       "useOAuthToken": true,             // Enable OAuth mode
 *       "models": ["gemini-2.5-flash", "gemini-2.5-pro"]
 *     }
 *   ]
 * }
 *
 * This transformer runs AFTER the base "gemini" transformer in the chain.
 * It only modifies authentication headers, allowing the base transformer
 * to handle all request/response formatting logic.
 */

class GeminiOAuthHeadersTransformer {
  name = "gemini-oauth-headers";

  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Transform request to use OAuth Bearer token authentication
   * instead of API key authentication.
   *
   * @param {Object} requestBody - The request body
   * @param {Object} provider - The provider configuration object
   * @param {Object} context - Additional context (request, logger, etc.)
   * @returns {Object} Transformed request with modified headers
   */
  async transformRequestIn(requestBody, provider, context) {
    // Only activate if OAuth flag is explicitly set to true
    if (provider.useOAuthToken !== true) {
      // Not in OAuth mode, pass through unchanged
      return { body: requestBody };
    }

    // Get API key (which contains the OAuth token in this mode)
    const apiKey = provider.api_key || provider.apiKey;

    // Validate token exists
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        `OAuth token missing for provider "${provider.name}". ` +
        `Please set api_key to your OAuth access token (e.g., from ~/.gemini/oauth_creds.json).`
      );
    }

    // Warn if token doesn't look like a Google OAuth token
    // Google OAuth tokens typically start with "ya29."
    if (!apiKey.startsWith('ya29.')) {
      console.warn(
        `⚠️  Warning: OAuth token for provider "${provider.name}" ` +
        `doesn't start with "ya29." - this may not be a valid Google OAuth token.`
      );
    }

    // Log OAuth mode activation (with masked token for security)
    if (context?.req?.log) {
      const maskedToken = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 10);
      context.req.log.info({
        provider: provider.name,
        useOAuthToken: true,
        tokenPrefix: apiKey.substring(0, 10),
        tokenLength: apiKey.length
      }, `Using OAuth Bearer token authentication: ${maskedToken}`);
    } else {
      // Fallback to console if logger not available
      const maskedToken = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 10);
      console.log(`✓ Using OAuth Bearer token for provider "${provider.name}": ${maskedToken}`);
    }

    // Return modified headers
    // The base gemini transformer will have already set x-goog-api-key
    // We override it here to use OAuth Bearer token instead
    return {
      body: requestBody,
      config: {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "x-goog-api-key": void 0  // Explicitly remove API key header
        }
      }
    };
  }

  /**
   * Transform response output.
   * No transformation needed - base Gemini transformer handles this.
   *
   * @param {Object} response - The response from the provider
   * @param {Object} context - Additional context
   * @returns {Object} Unchanged response
   */
  async transformResponseOut(response, context) {
    // No response transformation needed
    // All response handling is done by the base Gemini transformer
    return response;
  }
}

module.exports = GeminiOAuthHeadersTransformer;
