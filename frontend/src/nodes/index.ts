import { BaseNodeData } from "./BaseGrammarNode";

import PhysicalLayerNode, {
  PhysicalLayerNode as PhysicalLayerNodeType,
} from "./PhysicalLayerNode";

import ViewNode, { ViewNode as ViewNodeType, ViewNodeData } from "./ViewNode";

import ViewportNode, {
  ViewportNode as ViewportNodeType,
  ViewportNodeData,
} from "./ViewportNode";

import PyCodeEditorNode, {
  PyCodeEditorNode as PyCodeEditorNodeType,
  PyCodeEditorNodeData,
} from "./PyCodeEditorNode";

import InteractionNode, {
  InteractionNode as InteractionNodeType,
  InteractionNodeData,
} from "./InteractionNode";

import WidgetDefNode, {
  WidgetDefNode as WidgetDefNodeType,
  WidgetDefNodeData,
} from "./WidgetDefNode";

import TransformationNode, {
  TransformationNode as TransformationNodeType,
  TransformationNodeData,
} from "./TransformationNode";

// register all implemented node types
export const nodeTypes = {
  physicalLayerNode: PhysicalLayerNode,
  viewNode: ViewNode,
  viewportNode: ViewportNode,
  pyCodeEditorNode: PyCodeEditorNode,
  interactionNode: InteractionNode,
  widgetDefNode: WidgetDefNode,
  // joinNode: JoinNode,
  transformationNode: TransformationNode,
  // choiceNode: ChoiceNode,
} as const;

// union helpers (extend as you add more)
export type AnyNode =
  | PhysicalLayerNodeType
  | ViewNodeType
  | ViewportNodeType
  | InteractionNodeType
  | TransformationNodeType
  | PyCodeEditorNodeType
  | WidgetDefNodeType;

export type AnyNodeData =
  | BaseNodeData
  | ViewNodeData
  | ViewportNodeData
  | InteractionNodeData
  | TransformationNodeData
  | PyCodeEditorNodeData
  | WidgetDefNodeData;
