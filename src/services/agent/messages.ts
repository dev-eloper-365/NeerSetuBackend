import {
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function filterSystemMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((msg) => msg.role !== "system");
}

export function convertChatHistory(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    if (msg.role === "user") return new HumanMessage(msg.content);
    return new AIMessage(msg.content);
  });
}
