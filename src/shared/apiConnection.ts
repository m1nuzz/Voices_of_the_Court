import { Message, MessageChunk } from "../main/ts/conversation_interfaces";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
const contextLimits = require("../../public/contextLimits.json");

import tiktoken from "js-tiktoken";

export interface apiConnectionTestResult{
    success: boolean,
    overwriteWarning?: boolean;
    errorMessage?: string,
}

export interface Connection{
    type: string; //openrouter, openai, ooba, custom, google, anthropic
    baseUrl: string;
    key: string;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    overwriteContext: boolean;
    customContext: number;
    customModelName?: string; // Custom display name for the model
    useCustomEndpoint: boolean; // Flag for using custom endpoints
}

export interface Parameters{
    temperature: number,
	frequency_penalty: number,
	presence_penalty: number,
	top_p: number,
}

let encoder = tiktoken.getEncoding("cl100k_base");

export class ApiConnection {
    type: string;
    openaiClient?: OpenAI;
    anthropicClient?: Anthropic;
    googleClient?: GenerativeModel;
    model: string;
    forceInstruct: boolean;
    parameters: Parameters;
    context: number;
    overwriteWarning: boolean;
    customModelName?: string;

    constructor(connection: Connection, parameters: Parameters) {
        this.type = connection.type;
        this.model = connection.model;
        this.forceInstruct = connection.forceInstruct;
        this.parameters = parameters;
        this.customModelName = connection.customModelName;

        // Инициализация клиентов
        if (connection.type === "anthropic") {
            this.anthropicClient = new Anthropic({
                apiKey: connection.key,
                baseURL: connection.baseUrl || undefined,
            });
        } else if (connection.type === "google") {
            const genAI = new GoogleGenerativeAI(connection.key);
            this.googleClient = genAI.getGenerativeModel({ model: connection.model });
        } else {
            // OpenAI-compatible endpoints (openai, openrouter, custom, ooba)
            this.openaiClient = new OpenAI({
                baseURL: connection.baseUrl,
                apiKey: connection.key || "not-needed",
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/Demeter29/Voices_of_the_Court",
                    "X-Title": "Voices of the Court",
                },
            });
        }

        // Определение context limit
        this.context = this.getContextLimit(connection);
        this.overwriteWarning = false;

        if (!connection.overwriteContext && !this.getModelContextLimit(connection.model)) {
            console.warn(`Context limit not found for model: ${this.model}`);
            this.overwriteWarning = true;
        }
    }

    private getContextLimit(connection: Connection): number {
        if (connection.overwriteContext) {
            console.log("Using custom context size:", connection.customContext);
            return connection.customContext;
        }

        const limit = this.getModelContextLimit(connection.model);
        if (limit) {
            return limit;
        }

        console.warn(`Context limit not found for ${this.model}, using custom value`);
        return connection.customContext;
    }

    private getModelContextLimit(modelName: string): number | null {
        // Очистка имени модели от префикса провайдера
        let cleanModelName = modelName;
        if (modelName && modelName.includes("/")) {
            cleanModelName = modelName.split("/").pop()!;
        }

        // Anthropic models
        const anthropicLimits: Record<string, number> = {
            "claude-3-5-sonnet-20241022": 200000,
            "claude-3-5-sonnet-20240620": 200000,
            "claude-3-5-haiku-20241022": 200000,
            "claude-3-opus-20240229": 200000,
            "claude-3-sonnet-20240229": 200000,
            "claude-3-haiku-20240307": 200000,
        };

        if (anthropicLimits[cleanModelName]) {
            return anthropicLimits[cleanModelName];
        }

        // OpenAI и другие из contextLimits.json
        if (contextLimits[cleanModelName]) {
            return contextLimits[cleanModelName];
        }

        return null;
    }

    isChat(): boolean {
        // Anthropic always uses chat format
        if (this.type === "anthropic") {
            return true;
        }

        // For custom endpoints, default to chat
        if (this.type === "custom") {
            return !this.forceInstruct;
        }

        // OpenAI and OpenRouter
        if (this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct)) {
            return true;
        }

        // Google always uses chat
        if (this.type === "google") {
            return true;
        }

        return false;
    }

    async complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        if (this.type === "anthropic") {
            return this.completeAnthropic(prompt as Message[], stream, otherArgs, streamRelay);
        } else if (this.type === "google") {
            return this.completeGoogle(prompt as Message[], stream, otherArgs, streamRelay);
        } else {
            return this.completeOpenAI(prompt, stream, otherArgs, streamRelay);
        }
    }

    private async completeAnthropic(
        messages: Message[],
        stream: boolean,
        otherArgs: any,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        // Convert OpenAI format to Anthropic format
        const systemMessage = messages.find((m) => m.role === "system")?.content || "";
        const anthropicMessages = messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
                role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
                content: m.name ? `${m.name}: ${m.content}` : m.content,
            }));

        const response = await this.anthropicClient!.messages.create({
            model: this.model,
            max_tokens: otherArgs.max_tokens || 4096,
            system: systemMessage || undefined,
            messages: anthropicMessages,
            temperature: this.parameters.temperature,
            top_p: this.parameters.top_p,
            stream: stream,
        });

        let fullResponse = "";

        if (stream) {
            // @ts-ignore
            for await (const chunk of response) {
                if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
                    const text = chunk.delta.text;
                    fullResponse += text;
                    streamRelay?.({ content: text });
                }
            }
        } else {
            // @ts-ignore
            fullResponse = response.content[0].text;
        }

        console.log("Anthropic response:", fullResponse);
        return fullResponse;
    }

    private async completeGoogle(
        prompt: Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        const fullPrompt = prompt as Message[];
        const lastMessage = fullPrompt[fullPrompt.length - 1];
        
        const systemMessages = fullPrompt.slice(0, -1).filter(msg => msg.role === "system").map(msg => msg.content || "");
        
        const history = fullPrompt.slice(0, -1).filter(msg => msg.role === "user" || msg.role === "assistant").map(msg => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content || "" }],
        }));
        
        if (history.length > 0 && history[0].role === "model") {
            console.warn("Warning: History starts with model message, Google API expects user message first.");
            history.shift();
        }
        
        const chat = this.googleClient!.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: (otherArgs as any).max_tokens,
                temperature: this.parameters.temperature,
                topP: this.parameters.top_p,
            },
        });
        
        let lastMessageContent = lastMessage.content || "";
        if (systemMessages.length > 0) {
            lastMessageContent = systemMessages.join("\n") + "\n\n" + lastMessageContent;
        }
        
        let completion;
        
        if(stream){
            const result = await chat.sendMessageStream(lastMessageContent);
            completion = result.stream;
        } else {
            const result = await chat.sendMessage(lastMessageContent);
            completion = result.response;
        }

        let response: string = "";
        if(stream){
            for await(const chunk of (completion as AsyncGenerator<any, any, any>)){
                let msgChunk: MessageChunk = { content: chunk.text() as string };
                if(msgChunk.content !== null && msgChunk.content !== undefined){
                    streamRelay!(msgChunk);
                    response += msgChunk.content;
                }
            }
        } else {
            const textResponse = (completion as any).text();
            if (textResponse !== undefined && textResponse !== null) {
                response = textResponse;
            } else {
                response = "";
            }
        }
        console.log(response);
        return response;
    }

    private async completeOpenAI(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        // OpenAI doesn't allow spaces in message.name
        if (this.type === "openai" && Array.isArray(prompt)) {
            for (let i = 0; i < prompt.length; i++) {
                if (prompt[i].name) {
                    prompt[i].content = prompt[i].name + ": " + prompt[i].content;
                    delete prompt[i].name;
                }
            }
        }

        console.log("Prompt:", prompt);

        if (this.isChat()) {
            let completion = await this.openaiClient!.chat.completions.create({
                model: this.model,
                //@ts-ignore
                messages: prompt,
                stream: stream,
                ...this.parameters,
                ...otherArgs,
            });

            let response: string = "";

            if (stream) {
                // @ts-ignore
                for await (const chunk of completion) {
                    let msgChunk: MessageChunk = chunk.choices[0].delta;
                    if (msgChunk.content) {
                        streamRelay!(msgChunk);
                        response += msgChunk.content;
                    }
                }
            } else {
                // @ts-ignore
                response = completion.choices[0].message.content;
            }

            console.log("Response:", response);
            return response;
        } else {
            // Legacy completions API
            let completion;

            if (this.type === "openrouter") {
                //@ts-ignore
                completion = await this.openaiClient!.chat.completions.create({
                    model: this.model,
                    //@ts-ignore
                    prompt: prompt,
                    stream: stream,
                    ...this.parameters,
                    ...otherArgs,
                });
            } else {
                completion = await this.openaiClient!.completions.create({
                    model: this.model,
                    //@ts-ignore
                    prompt: prompt,
                    stream: stream,
                    ...this.parameters,
                    ...otherArgs,
                });
            }

            let response: string = "";

            if (stream) {
                // @ts-ignore
                for await (const chunk of completion) {
                    let msgChunk: MessageChunk = {
                        // @ts-ignore
                        content: chunk.choices[0].text,
                    };
                    streamRelay!(msgChunk);
                    response += msgChunk.content;
                }
            } else {
                // @ts-ignore
                response = completion.choices[0].text;
            }

            console.log("Response:", response);
            return response;
        }
    }

    async testConnection(): Promise<apiConnectionTestResult> {
        let prompt: string | Message[];
        if (this.isChat()) {
            prompt = [
                {
                    role: "user",
                    content: "ping"
                }
            ];
        } else {
            prompt = "ping";
        }

        if (this.type === "google") {
            if (!this.googleClient) {
                return { success: false, overwriteWarning: false, errorMessage: "Google client not initialized." };
            }
            try {
                const promptContent = (prompt as Message[])[0].content;
                if (!promptContent) {
                    return { success: false, overwriteWarning: false, errorMessage: "Prompt content is empty." };
                }
                const result = await this.googleClient.generateContent(promptContent);
                const response = await result.response;
                const responseText = response.text();
                if (responseText && responseText.trim() !== "") {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                } else {
                    return { success: false, overwriteWarning: false, errorMessage: "no response from Google API" };
                }
            } catch (err: any) {
                let errorMessage = err.message || err;
                if (err.response && err.response.status) {
                    errorMessage = `Google API Error: ${err.response.status} - ${err.response.statusText}`;
                }
                return { success: false, overwriteWarning: false, errorMessage: errorMessage }
            }
        } else {
            return this.complete(prompt, false, { max_tokens: 1 }).then((resp) => {
                if (resp) {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                }
                else {
                    return { success: false, overwriteWarning: false, errorMessage: "no response, something went wrong..." };
                }
            }).catch((err) => {
                return { success: false, overwriteWarning: false, errorMessage: err }
            });
        }
    }

    calculateTokensFromText(text: string): number {
        return encoder.encode(text).length;
    }

    calculateTokensFromMessage(msg: Message): number {
        let sum = encoder.encode(msg.role).length + encoder.encode(msg.content).length;

        if (msg.name) {
            sum += encoder.encode(msg.name).length;
        }

        return sum;
    }

    calculateTokensFromChat(chat: Message[]): number {
        let sum = 0;
        for (let msg of chat) {
            sum += this.calculateTokensFromMessage(msg);
        }

        return sum;
    }
}