import { zpp } from "@cryop/zpp";
import { type Model } from "@prisma/client";
import { Err, Ok } from "ts-results";
import { z } from "zod";
import { type StartCall, type ConvoADT } from "~/lib/types";
import { type PromptFunction } from "~/prompts/promptSchema";

import { fetchAccessToken } from "@humeai/voice";
import { env } from "~/env";

import { HumeClient } from "hume";
import { type PostedLanguageModelModelProvider } from "hume/api/resources/empathicVoice";

export const modelSchema = zpp(
  z.object({
    promptsConfigId: z.record(z.string()),
  }),
);

export type HumeConfig = {
  accessToken: string;
  configId: string;
};

const createCall = async (
  convo: ConvoADT,
  promptFn: PromptFunction,
  model: Model,
): Promise<StartCall<HumeConfig>> => {
  if (convo.type === "Phone") return Err("Not implemented");

  const llmConfig = modelSchema.jsonParseSafe(model.llmConfig);

  if (!llmConfig.success) return Err("Invalid LLM config");

  const accessToken = await fetchAccessToken({
    apiKey: env.HUME_API_KEY,
    clientSecret: env.HUME_CLIENT_SECRET,
  });

  const prompt = promptFn(convo.length);

  if (!prompt.fullKey) return Err("Invalid prompt");

  console.log(prompt.fullKey);

  const configId = llmConfig.data.promptsConfigId[prompt.fullKey];

  const client = new HumeClient({
    apiKey: env.HUME_API_KEY,
    clientSecret: env.HUME_CLIENT_SECRET,
  });

  console.log("configId", configId);

  if (!configId) {
    // TODO
    const ids = Object.keys(llmConfig.data.promptsConfigId);

    for (const id of ids) {
      const config = await client.empathicVoice.configs.getConfigVersion(id, 1);

      if (!config) continue;

      const newPrompt = await client.empathicVoice.prompts.createPrompt({
        name: `${model.label}-${prompt.fullKey}`,
        text: prompt.generalPrompt,
      });

      if (!newPrompt) return Err("Error creating new prompt");

      const newConfig = await client.empathicVoice.configs.createConfig({
        name: `${model.label}-${prompt.fullKey}`,
        prompt: {
          id: newPrompt.id,
        },
        languageModel: {
          modelProvider: config.languageModel?.modelProvider as
            | PostedLanguageModelModelProvider
            | undefined,
          modelResource: config.languageModel?.modelResource,
          //   mo: config.languageModel?.modelResource,
          temperature: config.languageModel?.temperature,
        },
      });

      if (!newConfig) return Err("Error creating new config");

      return Ok({
        type: "Online",
        details: { accessToken, configId: newConfig.id! },
      });
    }

    return Err("No implemented");
  }

  const config = await fetch(
    `https://api.hume.ai/v0/evi/configs/${configId}/version/1`,
    {
      headers: {
        "X-Hume-Api-Key": env.HUME_API_KEY,
      },
    },
  ).then((response) => response.json());

  if (!config) {
    return Err("No config found");
  }

  return Ok({ type: "Online", details: { accessToken, configId: config.id! } });
};

export const hume = {
  createCall,
  schemas: {
    modelSchema,
  },
};
