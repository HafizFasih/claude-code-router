Here is the comprehensive *Start-to-End flow* of what happens when you use the Claude Code Router.

Think of this like a *shipping process*. You (the User) drop a package (the prompt) into a mailbox (the CLI). Usually, the mailbox goes directly to one specific hub (Anthropic). But here, you've built a secret sorting facility (the Router) in the middle.

-----

### Phase 1: The Setup (One-Time Configuration)

Before the flow even starts, you have to "rig" the system.

1.  *Install:* You install both the official *Claude Code CLI* and the *Router* (middleware).
2.  *Configure:* You create a config.json file for the Router. This file is the "Rulebook." It says things like:
      * If the task involves "Thinking" $\rightarrow$ Send to DeepSeek R1.
      * If the task involves "Coding" $\rightarrow$ Send to Claude 3.5 Sonnet.
      * If the task involves "General Chat" $\rightarrow$ Send to Gemini Pro.
3.  *Redirect:* You set the environment variable ANTHROPIC_BASE_URL=http://localhost:3000. This tells the official CLI: "Don't talk to the real internet; talk to my local computer instead."

-----

### Phase 2: The Request (The "Start")

*1. User Action:*
You sit at your terminal and type:

> claude "Refactor this python script to use async/await"

*2. CLI Processing:*
The official *Claude Code CLI* packages your request. It bundles:

  * Your prompt ("Refactor this...").
  * Context (file contents, recent chat history).
  * System instructions (how Claude should behave).

*3. The Interception:*
The CLI tries to send this package to Anthropic. However, because of your setting in Phase 1, the package is *intercepted* by the *Claude Code Router* running on your localhost.

-----

### Phase 3: The "Magic" (Inside the Router)

This is where the third-party logic happens.

*4. Analysis:*
The Router opens the package and analyzes the "intent." It looks at the parameters (e.g., is is_reasoning set to true? Is it a huge file?).

*5. Routing Decision:*
The Router checks your config.json Rulebook.

  * Router thinks: "This looks like a standard coding task."
  * Rulebook says: "Default coding tasks go to *OpenAI GPT-4o* via OpenRouter."

*6. Translation (The Adapter):*
This is the most critical step. The official CLI speaks "Anthropic Language" (JSON structure). OpenAI speaks "OpenAI Language."

  * The Router *rewrites* the request headers and body.
  * It maps Anthropic's messages format to OpenAI's messages format.
  * It handles API Key swapping (swaps your dummy Anthropic key for your real OpenAI key).

-----

### Phase 4: Execution (The Provider)

*7. External Call:*
The Router sends the translated request out to the real provider (e.g., OpenRouter, Google, or DeepSeek).

*8. AI Processing:*
The external AI (e.g., GPT-4o) receives the prompt, processes the code refactoring, and generates a response.

*9. Raw Response:*
The provider sends the answer back to your Router.

-----

### Phase 5: The Return (The "End")

*10. Reverse Translation:*
The Router receives the answer in "OpenAI Language." It must translate it back into "Anthropic Language" so the official CLI doesn't crash.

  * It mimics the exact JSON structure Anthropic uses (including id, type, content fields).

*11. Delivery:*
The Router sends this fake Anthropic response back to the *Claude Code CLI*.

*12. User Experience:*
The CLI receives the data. It has *no idea* it just talked to OpenAI. It assumes it came from Anthropic. It renders the refactored Python code in your terminal with the nice formatting you expect.

### Summary Diagram

mermaid
graph TD
    User[You] -->|Type Command| CLI[Official Claude CLI]
    CLI -->|Sends Request (thinking it's Anthropic)| Router[Local Router (Proxy)]
    
    subgraph "Inside the Router"
        Router -->|Analyze Intent| Logic[Routing Logic]
        Logic -->|Select Provider| Trans[Translator]
    end
    
    Trans -->|Format for Google| Gemini[Google Gemini]
    Trans -->|Format for OpenAI| GPT[OpenAI GPT-4]
    Trans -->|Format for DeepSeek| DS[DeepSeek]
    
    Gemini -->|Response| Router
    GPT -->|Response| Router
    DS -->|Response| Router
    
    Router -->|Translate back to Anthropic Format| CLI
    CLI -->|Display Output| User
