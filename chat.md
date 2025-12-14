 
  The actual HTTP requests to external LLM providers are handled by the @musistudio/llms package (a local dependency). Here's the flow:

  Phase 4: Execution (from your flow.md)

  1. Routing Decision → src/utils/router.ts:182-230
  - Determines which provider/model to use
  - Sets req.body.model to values like "openai,gpt-4" or "anthropic,claude-opus"

  2. Server Processing → src/index.ts:125-139
  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      providers: config.Providers || config.providers,
      HOST: HOST,
      PORT: servicePort,
    },
    logger: loggerConfig,
  });
  This creates the @musistudio/llms server instance that handles provider communication.

  3. Actual LLM API Calls → node_modules/@musistudio/llms/dist/cjs/server.cjs

  The @musistudio/llms package uses provider-specific SDKs:
  - Anthropic: @anthropic-ai/sdk → calls api.anthropic.com
  - OpenAI: openai SDK → calls OpenAI API
  - Google: @google/genai → calls Google Gemini API
  - DeepSeek: Uses OpenAI-compatible endpoints

  4. HTTP Clients Used:
  - node-fetch for fetch API
  - undici for low-level HTTP
  - Provider SDKs wrap their own HTTP clients

  Response Streaming → src/index.ts:200-327

  Converts provider SSE responses back to Anthropic format using SSEParserTransform and SSESerializerTransform.

  In summary: The routing logic is in your codebase (src/utils/router.ts), but the actual HTTP requests to LLMs are abstracted in the @musistudio/llms package, which handles all provider transformations and API calls.
 
 
=====================
 
 
 
 Perfect! Now I can show you exactly where the credentials are extracted from the ~/.claude-code-router/config.json file.

  Credentials Extraction Flow

  1. Config File Path Definition → src/constants.ts:4-6

  export const HOME_DIR = path.join(os.homedir(), ".claude-code-router");
  export const CONFIG_FILE = path.join(HOME_DIR, "config.json");

  This sets CONFIG_FILE to ~/.claude-code-router/config.json.

  ---
  2. Reading & Parsing Config File → src/utils/index.ts:69-76

  export const readConfigFile = async () => {
    try {
      const config = await fs.readFile(CONFIG_FILE, "utf-8");  // ← Reads from disk
      try {
        const parsedConfig = JSON5.parse(config);               // ← Parses JSON
        return interpolateEnvVars(parsedConfig);                // ← Interpolates env vars
      } catch (parseError) {
        console.error(`Failed to parse config file at ${CONFIG_FILE}`);
        process.exit(1);
      }
    }
  }

  Key Feature: The interpolateEnvVars() function (lines 14-31) allows you to use environment variables in config values:  
  - Supports ${VAR_NAME} or $VAR_NAME syntax
  - Example: "api_key": "${OPENAI_API_KEY}" will be replaced with the actual env var value

  ---
  3. Config Structure (What Gets Extracted) → Based on ui/config.example.json:16-169

  The config contains a Providers array where each provider has:
  {
    "Providers": [
      {
        "name": "openrouter",
        "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
        "api_key": "sk-or-v1-xxxxx",     // ← API KEY extracted here
        "models": ["google/gemini-2.5-pro-preview"],
        "transformer": { "use": ["openrouter"] }
      },
      {
        "name": "deepseek",
        "api_base_url": "https://api.deepseek.com/chat/completions",
        "api_key": "sk-xxxxx",           // ← Another provider's key
        "models": ["deepseek-chat"]
      }
    ]
  }

  ---
  4. Passing Credentials to the Server → src/index.ts:64, 125-139

  const config = await initConfig();  // ← Reads config file

  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      providers: config.Providers || config.providers,  // ← Providers with API keys
      HOST: HOST,
      PORT: servicePort,
    },
    logger: loggerConfig,
  });

  The entire Providers array (including all API keys) is passed to the @musistudio/llms server.

  ---
  5. Using Credentials in API Calls → @musistudio/llms package

  The @musistudio/llms server:
  1. Receives the providers array with credentials
  2. When routing decides to use a specific provider (e.g., "openrouter")
  3. The transformer extracts the matching provider's api_key
  4. Sets the appropriate authentication header:
    - For OpenAI: Authorization: Bearer {api_key}
    - For Anthropic: x-api-key: {api_key}
    - For Google: Uses google-auth-library with the key

  ---
  Complete Credential Flow Diagram

  1. User's Device
     └─ ~/.claude-code-router/config.json
        └─ Contains: Providers[].api_key
              ↓
  2. src/constants.ts
     └─ CONFIG_FILE = "~/.claude-code-router/config.json"
              ↓
  3. src/utils/index.ts → readConfigFile()
     └─ fs.readFile(CONFIG_FILE)
     └─ JSON5.parse()
     └─ interpolateEnvVars() ← Can use $ENV_VAR syntax
              ↓
  4. src/index.ts → run()
     └─ config = await initConfig()
     └─ server = createServer({ providers: config.Providers })
              ↓
  5. @musistudio/llms Server
     └─ Receives all provider configs with api_keys
     └─ Router selects provider based on rules
     └─ Transformer extracts api_key for selected provider
     └─ Sets Authorization header
              ↓
  6. HTTP Request to External LLM
     └─ Headers: { Authorization: "Bearer sk-xxxxx" }
     └─ Sent to: provider.api_base_url

  ---
  Key Security Features

  1. Local Storage: Credentials are stored locally in ~/.claude-code-router/config.json
  2. Environment Variable Support: You can use "api_key": "${OPENAI_KEY}" to avoid hardcoding secrets
  3. No Transmission: The router doesn't send credentials anywhere except to the configured LLM provider endpoints        

  The main files handling credential extraction are:
  - src/constants.ts:6 - Defines config path
  - src/utils/index.ts:69-76 - Reads and parses credentials
  - src/index.ts:129 - Passes credentials to LLM server



=====================



> so in ~.claude-code-router/config.json can i set the extra variable with true and false and according to this i         
could decide the logic in behind? 

● Yes, absolutely! You can add custom variables to ~/.claude-code-router/config.json and use them to control logic throughout the codebase.

  Let me show you how the config is accessible and where you can add custom logic:

● Read(src\utils\router.ts)
  ⎿  Read 100 lines

● Search(pattern: "config\.", path: "src", type: "ts", output_mode: "content", head_limit: 30)
  ⎿  Found 30 lines (ctrl+o to expand)

● Read(src\utils\codeCommand.ts)
  ⎿  Read 30 lines

● Read(src\agents\image.agent.ts)
  ⎿  Read 25 lines

● Perfect! Yes, you can absolutely add custom variables to ~/.claude-code-router/config.json and use them to control logic. The codebase already has several examples of this pattern!

  Examples of Custom Config Variables in the Codebase

  1. Boolean Flags → src/utils/codeCommand.ts:30

  if (config.NON_INTERACTIVE_MODE) {
    env.CI = "true";
    env.FORCE_COLOR = "0";
    env.NODE_NO_READLINE = "1";
    env.TERM = "dumb";
  }

  2. Another Boolean Flag → src/agents/image.agent.ts:63

  if (
    !config.forceUseImageAgent &&
    lastMessage.role === "user" &&
    // ... image detection logic
  ) {
    req.body.model = config.Router.image;
  }

  3. Custom String Variables → src/utils/codeCommand.ts:38-40

  if (config?.ANTHROPIC_SMALL_FAST_MODEL) {
    env.ANTHROPIC_SMALL_FAST_MODEL = config.ANTHROPIC_SMALL_FAST_MODEL;
  }

  ---
  How to Add Your Own Custom Variables

  Step 1: Add to ~/.claude-code-router/config.json

  {
    "PORT": 3456,
    "Providers": [...],
    "Router": {...},

    // ✅ Your custom variables
    "enableCustomFeature": true,
    "debugMode": false,
    "customTimeout": 30000,
    "myCustomLogic": {
      "option1": true,
      "option2": "value"
    }
  }

  Step 2: Access in Your Code

  The config object is available in multiple places:

  A) In Middleware/Routing → src/utils/router.ts

  export async function router(req: any, reply: any, options: any) {
    const { config, event } = options;

    // ✅ Your custom logic
    if (config.enableCustomFeature) {
      // Do something special
    }

    if (config.debugMode) {
      console.log("Debug:", req.body);
    }
  }

  B) In Agents → src/agents/image.agent.ts:58

  shouldHandle(req: any, config: any): boolean {
    // ✅ Access custom config
    if (config.myCustomLogic?.option1) {
      // Custom handling logic
    }
    return someCondition;
  }

  C) In Main Server → src/index.ts:64-67

  const config = await initConfig();

  // ✅ Access anywhere after this point
  if (config.enableCustomFeature) {
    // Custom server configuration
  }

  let HOST = config.HOST || "127.0.0.1";

  ---
  Where Config is Accessible

  | Location          | File Path                  | How to Access                                           |
  |-------------------|----------------------------|---------------------------------------------------------|
  | Main Server       | src/index.ts:64            | const config = await initConfig()                       |
  | Router Middleware | src/utils/router.ts        | Passed via options.config parameter                     |
  | Agents            | src/agents/*.ts            | Passed as second parameter to shouldHandle(req, config) |
  | Code Command      | src/utils/codeCommand.ts   | Passed as parameter                                     |
  | Auth Middleware   | src/middleware/auth.ts:157 | apiKeyAuth(config) receives it                          |

  ---
  Practical Example: Adding Custom Routing Logic

  Let's say you want to add a "premium mode" that routes to a better model:

  1. Add to config.json:

  {
    "Providers": [...],
    "Router": {
      "default": "openrouter,gemini-2.5-flash",
      "premium": "openrouter,claude-opus-4"  // ← Premium route
    },
    "enablePremiumMode": true,  // ← Your custom flag
    "premiumUsers": ["user123", "user456"]  // ← Optional user list
  }

  2. Modify src/utils/router.ts (around line 180):

  export async function router(req: any, reply: any, options: any) {
    const { config, event } = options;

    // ✅ Custom premium logic
    if (config.enablePremiumMode) {
      const userId = req.headers['x-user-id'];
      if (config.premiumUsers?.includes(userId)) {
        req.body.model = config.Router.premium;
        return; // Use premium route
      }
    }

    // ... rest of existing routing logic
  }

  ---
  Important Notes

  1. Config is Read Once: The config is loaded when the server starts (src/index.ts:64). If you change config.json, you need to restart the service (ccr stop && ccr start).
  2. Type Safety: The config object is typed as any, so you won't get TypeScript errors, but you should validate your custom fields:
  if (config.myCustomField !== undefined) {
    // Safe to use
  }
  3. Environment Variables: You can use env var interpolation in config values:
  {
    "enableDebug": "${DEBUG_MODE}",  // ← Will use $DEBUG_MODE env var
    "customKey": "${MY_SECRET_KEY}"
  }
  4. Config Inheritance: You can have project-specific configs at ~/.claude-code-router/{project}/config.json that override the main config.

  ---
  In summary: Yes, you can add any custom variables (booleans, strings, objects, etc.) to your config.json, and they'll be accessible throughout the codebase via the config object. The existing code already uses this pattern extensively!       
