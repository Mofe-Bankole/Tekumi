import {
  logger,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from "@elizaos/core";
import tekumiPlugin from "./plugin.ts";
import { character } from "./character.ts";

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info("Initializing Tekumi gaming agent");
  logger.info({ name: character.name }, "Gaming agent ready:");
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [tekumiPlugin],
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from "./character.ts";

export default project;
