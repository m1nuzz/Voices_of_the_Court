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

## Google AI API Setup

To use the Google AI API (for Gemini models):

1. Go to [Google AI Studio](https://aistudio.google.com/) and create an account
2. Generate an API key from the "Get API Key" section
3. In the Voices of the Court application, go to the Configuration window
4. Select "google" as the API type
5. Enter the generated API key
6. Select your preferred Gemini model (e.g., gemini-pro, gemini-1.5-pro, etc.)
7. Save the configuration

## OpenAI API Setup

For OpenAI API (GPT models):

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In the application config window, select "openai" as the API type
3. Enter your API key
4. Select your preferred model (e.g., gpt-3.5-turbo, gpt-4, etc.)

## Other APIs

The application also supports OpenRouter and locally hosted Oobabooga APIs. For details about all supported APIs and advanced configuration options, see the [API Configuration Guide](docs/api-configuration.md).

