import { BaseNodeData } from "./BaseGrammarNode";
import PhysicalLayerNode, {
  PhysicalLayerNode as PhysicalLayerNodeType,
} from "./PhysicalLayerNode";
import ViewNode, { ViewNode as ViewNodeType, ViewNodeData } from "./ViewNode";
import RenderNode from "./RenderNode";

// add more as you implement them:
// import JoinNode from "./JoinNode"; etc.

export const nodeTypes = {
  physicalLayerNode: PhysicalLayerNode,
  viewNode: ViewNode,
  renderNode: RenderNode,
  //   joinNode: JoinNode,
  //   transformationNode: TransformationNode,
  //   interactionNode: InteractionNode,
  //   choiceNode: ChoiceNode,
} as const;

export type AnyNode = PhysicalLayerNodeType | ViewNodeType;
export type AnyNodeData = BaseNodeData | ViewNodeData; // extend as you add nodes
