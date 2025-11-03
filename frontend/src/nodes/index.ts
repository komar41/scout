import PhysicalLayerNode, {
  PhysicalLayerNode as PhysicalLayerNodeType,
} from "./PhysicalLayerNode";
import ViewNode, { ViewNode as ViewNodeType } from "./ViewNode";

// add more as you implement them:
// import JoinNode from "./JoinNode"; etc.

export const nodeTypes = {
  physicalLayerNode: PhysicalLayerNode,
  viewNode: ViewNode,
  //   joinNode: JoinNode,
  //   transformationNode: TransformationNode,
  //   interactionNode: InteractionNode,
  //   choiceNode: ChoiceNode,
} as const;

export type AnyNodeType = PhysicalLayerNodeType | ViewNodeType;
