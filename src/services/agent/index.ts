import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { allTools } from "../gwTools";
import logger from "../../utils/logger";
import { processToolResult } from "../toolResultHandlers";
import { createSystemPrompt, createModel } from "./config";
import { trimMessagesToFit } from "./trimmer";
import {
  ChatMessage,
  convertChatHistory,
  filterSystemMessages,
} from "./messages";

export { ChatMessage };

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onChart: (chart: object) => void;
  onToolCall: (toolName: string, args: object) => void;
  onToolResult: (toolName: string, result: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export function createGroundwaterAgent() {
  const model = createModel();
  const toolNode = new ToolNode(allTools);

  function shouldContinue(
    state: typeof MessagesAnnotation.State
  ): "tools" | typeof END {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    return END;
  }

  async function callModel(state: typeof MessagesAnnotation.State) {
    const trimmedMessages = await trimMessagesToFit(state.messages);
    const response = await model.invoke(trimmedMessages);
    return { messages: [response] };
  }

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow.compile();
}

export async function streamGroundwaterChat(
  query: string,
  chatHistory: ChatMessage[] = [],
  callbacks: StreamCallbacks,
  language: string = "en"
): Promise<void> {
  const agent = createGroundwaterAgent();

  // Filter out system messages from history, always add fresh system prompt
  const filteredHistory = filterSystemMessages(chatHistory);
  const systemPrompt = createSystemPrompt(language);
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...convertChatHistory(filteredHistory),
    new HumanMessage(query),
  ];

  let fullResponse = "";

  try {
    logger.debug("Starting agent stream");
    const stream = await agent.stream({ messages }, { streamMode: "messages" });

    for await (const chunk of stream) {
      const [message] = chunk;

      if (message._getType() === "ai") {
        const aiMessage = message as AIMessage;

        if (aiMessage.content && typeof aiMessage.content === "string") {
          callbacks.onToken(aiMessage.content);
          fullResponse += aiMessage.content;
        }

        if (aiMessage.tool_calls?.length) {
          for (const toolCall of aiMessage.tool_calls) {
            callbacks.onToolCall(toolCall.name, toolCall.args);
          }
        }
      }

      if (message._getType() === "tool") {
        const toolMessage = message as ToolMessage;
        const toolName = toolMessage.name ?? "unknown";
        callbacks.onToolResult(toolName, toolMessage.content as string);

        await processToolResult(
          toolName,
          toolMessage.content as string,
          callbacks.onChart
        );
      }
    }

    logger.debug("Agent stream completed");
    callbacks.onComplete(fullResponse);
  } catch (error) {
    logger.error({ err: error }, "Agent stream failed");
    callbacks.onError(error as Error);
  }
}

export async function invokeGroundwaterChat(
  query: string,
  chatHistory: ChatMessage[] = [],
  language: string = "en"
): Promise<{ response: string; charts: object[] }> {
  const agent = createGroundwaterAgent();

  // Filter out system messages from history, always add fresh system prompt
  const filteredHistory = filterSystemMessages(chatHistory);
  const systemPrompt = createSystemPrompt(language);
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...convertChatHistory(filteredHistory),
    new HumanMessage(query),
  ];

  logger.debug("Invoking agent");
  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1] as AIMessage;
  const response =
    typeof lastMessage.content === "string" ? lastMessage.content : "";

  const charts: object[] = [];
  for (const msg of result.messages) {
    if (msg._getType() === "tool") {
      try {
        const toolResult = JSON.parse((msg as ToolMessage).content as string);
        if (toolResult.charts) {
          charts.push(...toolResult.charts);
        }
      } catch {
        // Not JSON
      }
    }
  }

  logger.debug({ chartsCount: charts.length }, "Agent invocation completed");
  return { response, charts };
}
