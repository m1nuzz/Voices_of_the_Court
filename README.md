# Voices of the Court

Voices of the Court is a Crusader Kings 3 mod which integrates Large Language Models into the game. It lets you hold conversations with the characters and also impact the game state to an extend.

This fork includes additional support for Gemini from Google.

Documentation: https://docs.voicesofthecourt.app

[Steam page](https://steamcommunity.com/sharedfiles/filedetails/?id=3346777360)

Join our Discord:

[![Discord Server](https://discord.com/api/guilds/1066522056243564585/widget.png?style=banner2)](https://discord.gg/5nuE54GFgr)

# Trailer video 
[![link to](https://img.youtube.com/vi/E2GmlNsK-J8/0.jpg)](https://www.youtube.com/watch?v=E2GmlNsK-J8)

# Gameplay video by DaFloove
[![link to](https://img.youtube.com/vi/3lhHkXPmis0/0.jpg)](https://www.youtube.com/watch?v=3lhHkXPmis0)

# Local setup

1. clone the repo
2. install dependencies with `npm i`
3. start dev mode with `npm run start`
4. package app with `npm run make`

# API Configuration

## Supported API Providers

### OpenAI
For OpenAI API (GPT models):

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In the application config window, select "openai" as the API type
3. Enter your API key
4. Select your preferred model (e.g., gpt-4-turbo, gpt-4o, gpt-3.5-turbo, etc.)

### Anthropic (Claude)
For Anthropic Claude models:

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. In the application config window, select "anthropic" as the API type
3. Enter your API key
4. Enter your preferred model (e.g., claude-3-5-sonnet-20241022, claude-3-opus-20240229, etc.)

### Google AI (Gemini)
To use the Google AI API (for Gemini models):

1. Go to [Google AI Studio](https://aistudio.google.com/) and create an account
2. Generate an API key from the "Get API Key" section
3. In the Voices of the Court application, go to the Configuration window
4. Select "google" as the API type
5. Enter the generated API key
6. Enter your preferred Gemini model (e.g., gemini-pro, gemini-1.5-pro, etc.)

### OpenRouter
For OpenRouter (access to multiple models):

1. Get your API key from [OpenRouter](https://openrouter.ai/keys)
2. In the application config window, select "openrouter" as the API type
3. Enter your API key
4. Enter the model name (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, etc.)
5. Optionally enable "Force Instruct mode" for legacy models

### Custom OpenAI-Compatible Endpoints
For locally hosted or custom OpenAI-compatible APIs (LM Studio, Ollama, vLLM, Text Generation WebUI, etc.):

1. In the application config window, select "custom" as the API type
2. Enter the Base URL of your endpoint (e.g., `http://localhost:1234/v1` for LM Studio)
3. Enter your API key (if required, or use "not-needed")
4. Enter the model name as defined by your endpoint
5. Optionally override context size if needed

#### Example Configurations

**LM Studio:**
- Base URL: `http://localhost:1234/v1`
- API Key: `not-needed`
- Model: (any model loaded in LM Studio)

**Ollama:**
- Base URL: `http://localhost:11434/v1`
- API Key: `not-needed`
- Model: `llama3.1`, `mistral`, etc.

**Text Generation WebUI (oobabooga):**
- Base URL: `http://localhost:5000/v1`
- API Key: `not-needed`
- Model: (any loaded model)
- Make sure to enable the "openai" extension in WebUI

### Text Generation WebUI (Oobabooga)
For Text Generation WebUI (oobabooga):

1. Start your Text Generation WebUI server with the OpenAI extension enabled
2. In the application config window, select "ooba" as the API type
3. Enter the server URL (e.g., `http://localhost:5000`)

## Advanced Configuration

### Context Size Override
For any API provider, you can override the automatic context size detection:

1. Check "Overwrite context size"
2. Enter the desired context size in tokens
3. This is useful for custom models with non-standard context limits

### Separate APIs for Different Functions
The application supports using different API providers for:
- Text Generation (main conversations)
- Summarization (conversation summaries)
- Actions (game state modifications)

Configure each independently in the Configuration window under their respective tabs.

