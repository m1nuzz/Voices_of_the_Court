import { Message, MessageChunk } from "../main/ts/conversation_interfaces";
import OpenAI from "openai";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
const contextLimits = require("../../public/contextLimits.json");

import { getEncoding } from "js-tiktoken";

export interface apiConnectionTestResult{
    success: boolean,
    overwriteWarning?: boolean;
    errorMessage?: string,
}

export interface Connection{
    type: string; //openrouter, openai, ooba
    baseUrl: string;
    key: string;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    overwriteContext: boolean;
    customContext: number;
}

export interface Parameters{
    temperature: number,
	frequency_penalty: number,
	presence_penalty: number,
	top_p: number,
}

let encoder = getEncoding("cl100k_base");

export class ApiConnection{
    type: string; //openrouter, openai, ooba, custom, google
    client: OpenAI | undefined;
    googleClient: GenerativeModel | undefined;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    parameters: Parameters;
    context: number;
    overwriteWarning: boolean;
    

    constructor(connection: Connection, parameters: Parameters){
        this.type = connection.type;
        if(this.type === "google"){
            const genAI = new GoogleGenerativeAI(connection.key);
            this.googleClient = genAI.getGenerativeModel({ model: connection.model});
            this.client = undefined;
        } else {
            this.client = new OpenAI({
                baseURL: connection.baseUrl,
                apiKey: connection.key,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/Demeter29/Voices_of_the_Court", // Optional, for including your app on openrouter.ai rankings.
                    "X-Title": "Voices of the Court", // Optional. Shows in rankings on openrouter.ai.
                  }
            })
        }
        this.model = connection.model;
        this.forceInstruct = connection.forceInstruct;
        this.parameters = parameters;
        

        let modelName = this.model
        if(modelName && modelName.includes("/")){
            modelName = modelName.split("/").pop()!;
        }

        if(connection.overwriteContext){
            console.log("Overwriting context size!");
            this.context = connection.customContext;
            this.overwriteWarning = false;
        }
        else if(contextLimits[modelName]){
            this.context = contextLimits[modelName];
            this.overwriteWarning = false;
        }
        else{
            console.log(`Warning: couldn't find ${this.model}'s context limit. context overwrite value will be used!`);
            this.context = connection.customContext;
            this.overwriteWarning = true;
        }
    }

    isChat(): boolean {
        if(this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct ) || this.type === "other" || this.type === "google"){
            return true;
        }
        else{
            return false;
        }
    
    }

    async complete(prompt: string | Message[], stream: boolean, otherArgs: object, streamRelay?: (arg1: MessageChunk)=> void,  ): Promise<string> {


        //OPENAI DOESNT ALLOW spaces inside message.name so we have to put them inside the Message content.
        if(this.type == "openai"){
            for(let i=0;i<prompt.length;i++){
                 //@ts-ignore
                 if(prompt[i].name){
                    //@ts-ignore
                    prompt[i].content = prompt[i].name + ": "+prompt[i].content;

                    //@ts-ignore
                    delete prompt[i].name;
                }
            }
        }   
        console.log(prompt);
        
        if(this.isChat()){
            if(this.type === "google"){
                // Process the prompt to separate system messages from the chat history
                // Google API doesn't allow system messages in history, so we need to handle them differently
                const fullPrompt = prompt as Message[];
                const lastMessage = fullPrompt[fullPrompt.length - 1];
                
                // Extract system messages to potentially prepend to the user's message
                const systemMessages = fullPrompt.slice(0, -1).filter(msg => msg.role === "system").map(msg => msg.content || "");
                
                // Filter out system messages for the history (Google API doesn't allow system messages in history)
                // Only include user and assistant messages in the history
                const history = fullPrompt.slice(0, -1).filter(msg => msg.role === "user" || msg.role === "assistant").map(msg => ({
                    role: msg.role === "user" ? "user" : "model", // Google API uses "model" instead of "assistant"
                    parts: [{ text: msg.content || "" }],
                }));
                
                // Check that history starts with a user message and ensure proper alternation
                if (history.length > 0 && history[0].role === "model") {
                    console.warn("Warning: History starts with model message, Google API expects user message first.");
                    // Since Google API requires history to start with user, we'll remove the initial model message
                    history.shift();
                }
                
                // Construct the chat configuration without system instruction for compatibility
                const chat = this.googleClient!.startChat({
                    history: history,
                    generationConfig: {
                        maxOutputTokens: (otherArgs as any).max_tokens,
                        temperature: this.parameters.temperature,
                        topP: this.parameters.top_p,
                    },
                });
                
                // Combine system messages with the last user message if there are system instructions
                let lastMessageContent = lastMessage.content || "";
                if (systemMessages.length > 0) {
                    // Prepend system instructions to the user's message to ensure they're included
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
                            //@ts-ignore
                            response += msgChunk.content;
                        }
                    }
                } else {
                    // TS2532 fix: ensure response text is properly handled for Google API
                    const textResponse = (completion as any).text();
                    if (textResponse !== undefined && textResponse !== null) {
                        response = textResponse;
                    } else {
                        response = "";
                    }
                }
                console.log(response);
                return response;

            } else {
                let completion = await this.client!.chat.completions.create({
                    model: this.model,
                    //@ts-ignore
                    messages: prompt,
                    stream: stream,
                    ...this.parameters,
                    ...otherArgs
                })

                let response: string = "";
                if(stream){
                    // @ts-ignore
                    for await(const chunk of (completion as OpenAI.Chat.Completions.ChatCompletionChunk)){
                        let msgChunk: MessageChunk = chunk.choices[0].delta;
                        if(msgChunk.content){
                            streamRelay!(msgChunk);
                            response += msgChunk.content;
                        }   
                    }
                }
                else{
                    if (completion && 
                        completion.choices && 
                        completion.choices[0] && 
                        completion.choices[0].message) {
                        
                        // TS2532 fix: properly handle potentially undefined content
                        const message = completion.choices[0].message;
                        if (message.content !== undefined && message.content !== null) {
                            response = message.content;
                        } else {
                            response = "";
                        }
                    } else {
                        throw new Error("OpenAI non-streaming completion is undefined or malformed.");
                    }
                }
                console.log(response);
                return response;
            }
        }
        else{
            // Ensure client is available for non-chat APIs
            if (!this.client) {
                throw new Error(`${this.type} API requires an OpenAI-compatible client, but client is not initialized.`);
            }
            
            let completion;

            if(this.type === "openrouter"){
                //@ts-ignore
                completion = await this.client.chat.completions.create({
                    model: this.model,
                    //@ts-ignore
                    prompt: prompt,
                    stream: stream,
                    ...this.parameters,
                    ...otherArgs
                })
            }
            else{
                completion = await this.client.completions.create({
                    model: this.model,
                    //@ts-ignore
                    prompt: prompt,
                    stream: stream,
                    ...this.parameters,
                    ...otherArgs
                });
            }

            let response: string = "";

            //@ts-ignore
            if(completion["error"]){
                //@ts-ignore
                throw completion.error.message;
            }

            if(stream){
                // @ts-ignore
                
                for await(const chunk of completion){
                    // TS2532 fix: properly handle different API response types (chat vs completion)
                    let content: string | null = null;
                    if ('text' in chunk.choices[0]) {
                        // Completion API (like Ooba, OpenRouter with instruct)
                        content = chunk.choices[0].text || null;
                    } else if ('delta' in chunk.choices[0]) {
                        // This path is for chat/streaming, but we've already handled that earlier in the isChat() branch
                        // This shouldn't happen in this part of the code, but adding for safety
                        const delta = chunk.choices[0].delta as any;
                        content = delta.content || null;
                    }
                    
                    let msgChunk: MessageChunk = {
                        // @ts-ignore
                        content: content
                    }
                    streamRelay!(msgChunk);

                    if (msgChunk.content) {
                        response += msgChunk.content;
                    }
                }
            }
            else{
                // TS2532 fix: properly handle different API response types (chat vs completion)
                let content: string = "";
                if ('text' in completion.choices[0]) {
                    // Completion API (like Ooba, OpenRouter with instruct)
                    content = completion.choices[0].text || "";
                } else if ('message' in completion.choices[0]) {
                    // Chat API, but we're in the non-chat section, so this shouldn't happen
                    // Keeping for type safety
                    const message = completion.choices[0].message as any;
                    content = message.content || "";
                }
                response = content;
            }

            console.log(response);
            return response;
        }
    }

    async testConnection(): Promise<apiConnectionTestResult>{
        let prompt: string | Message[];
        if(this.isChat()){
            prompt = [
                {
                    role: "user",
                    content: "ping"
                }
            ]
        }else{
            prompt = "ping";
        }

        if (this.type === "google") {
            if (!this.googleClient) {
                return {success: false, overwriteWarning: false, errorMessage: "Google client not initialized."};
            }
            try {
                const promptContent = (prompt as Message[])[0].content;
                if (!promptContent) {
                    return {success: false, overwriteWarning: false, errorMessage: "Prompt content is empty."};
                }
                const result = await this.googleClient.generateContent(promptContent);
                const response = await result.response;
                const responseText = response.text();
                if (responseText && responseText.trim() !== "") {
                    return {success: true, overwriteWarning: this.overwriteWarning };
                } else {
                    return {success: false, overwriteWarning: false, errorMessage: "no response from Google API"};
                }
            } catch (err: any) {
                let errorMessage = err.message || err;
                if (err.response && err.response.status) {
                    errorMessage = `Google API Error: ${err.response.status} - ${err.response.statusText}`;
                }
                return {success: false, overwriteWarning: false, errorMessage: errorMessage}
            }
        } else {
            return this.complete(prompt, false, {max_tokens: 1}).then( (resp) =>{
                if(resp){
                    return {success: true, overwriteWarning: this.overwriteWarning };
                }
                else{
                    return {success: false, overwriteWarning: false, errorMessage: "no response, something went wrong..."};
                }
            }).catch( (err) =>{
                return {success: false, overwriteWarning: false, errorMessage: err}
            });
        }
    }

    calculateTokensFromText(text: string): number{
          return encoder.encode(text).length;
    }

    calculateTokensFromMessage(msg: Message): number{
        let sum = encoder.encode(msg.role).length + encoder.encode(msg.content).length

        if(msg.name){
            sum += encoder.encode(msg.name).length;
        }

        return sum;
    }

    calculateTokensFromChat(chat: Message[]): number{        
        let sum=0;
        for(let msg of chat){
           sum += this.calculateTokensFromMessage(msg);
        }

        return sum;
    }

   
}