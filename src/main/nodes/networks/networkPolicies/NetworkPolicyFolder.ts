import * as vscode from "vscode";
import state from "../../../state";
import { KubernetesResourceFolder } from "../../abstract/KubernetesResourceFolder";
import { NETWORK_POLICIES_FOLDER } from "../../nodeContants";
import { BaseNocalhostNode } from "../../types/nodeType";
import { List, Resource } from "../../types/resourceType";
import { NetworkPolicy } from "./NetworkPolicy";

export class NetworkPolicyFolder extends KubernetesResourceFolder {
  public resourceType: string = "NetworkPolicy";
  constructor(public parent: BaseNocalhostNode) {
    super();
    this.parent = parent;
    state.setNode(this.getNodeStateId(), this);
  }
  public label: string = "Network Policies";
  public type = NETWORK_POLICIES_FOLDER;

  getParent(): BaseNocalhostNode {
    return this.parent;
  }
  async getChildren(
    parent?: BaseNocalhostNode
  ): Promise<vscode.ProviderResult<BaseNocalhostNode[]>> {
    let list = state.getData(this.getNodeStateId()) as Resource[];
    if (!list) {
      list = await this.updateData(true);
    }
    const result: NetworkPolicy[] = list.map(
      (item) =>
        new NetworkPolicy(this, item.metadata.name, item.metadata.name, item)
    );
    return result;
  }
}
