import { trimMessages } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { MAX_TOKENS } from "./config";

function getContentLength(content: unknown): number {
  if (typeof content === "string") {
    return content.length;
  }
  if (Array.isArray(content)) {
    let len = 0;
    for (const part of content) {
      if (typeof part === "string") {
        len += part.length;
      } else if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text: unknown }).text === "string"
      ) {
        len += ((part as { text: string }).text).length;
      }
    }
    return len;
  }
  return 0;
}

function approximateTokenCount(messages: BaseMessage[]): number {
  let count = 0;
  for (const msg of messages) {
    count += Math.ceil(getContentLength(msg.content) / 4);
  }
  return count;
}

export async function trimMessagesToFit(
  messages: BaseMessage[]
): Promise<BaseMessage[]> {
  return trimMessages(messages, {
    maxTokens: MAX_TOKENS,
    strategy: "last",
    tokenCounter: approximateTokenCount,
    includeSystem: true,
    startOn: "human",
  });
}
