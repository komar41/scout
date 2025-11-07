import { BaseNodeData } from "./BaseGrammarNode";

import PhysicalLayerNode, {
  PhysicalLayerNode as PhysicalLayerNodeType,
} from "./PhysicalLayerNode";

import ViewNode, { ViewNode as ViewNodeType, ViewNodeData } from "./ViewNode";

import ViewportNode, {
  ViewportNode as ViewportNodeType,
  ViewportNodeData,
} from "./ViewportNode";

import InteractionNode, {
  InteractionNode as InteractionNodeType,
  InteractionNodeData,
} from "./InteractionNode";

// register all implemented node types
export const nodeTypes = {
  physicalLayerNode: PhysicalLayerNode,
  viewNode: ViewNode,
  viewportNode: ViewportNode,
  interactionNode: InteractionNode,
  // joinNode: JoinNode,
  // transformationNode: TransformationNode,
  // choiceNode: ChoiceNode,
} as const;

// union helpers (extend as you add more)
export type AnyNode =
  | PhysicalLayerNodeType
  | ViewNodeType
  | ViewportNodeType
  | InteractionNodeType;

export type AnyNodeData =
  | BaseNodeData
  | ViewNodeData
  | ViewportNodeData
  | InteractionNodeData;
