import * as vscode from "vscode";
import * as fs from "fs";
import { isExistCluster } from "../clusters/utils";
import ICommand from "./ICommand";
import { DELETE_KUBECONFIG, REFRESH, SIGN_OUT } from "./constants";
import registerCommand from "./register";
import { LOCAL_PATH } from "../constants";
import host from "../host";
import { LocalClusterNode } from "../clusters/LocalCuster";
import { KubeConfigNode } from "../nodes/KubeConfigNode";

export default class DeleteKubeConfigCommand implements ICommand {
  command: string = DELETE_KUBECONFIG;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  async execCommand(node: KubeConfigNode) {
    const localClusterNodes: LocalClusterNode[] = host.getGlobalState(
      LOCAL_PATH
    ) as LocalClusterNode[];
    const kubeConfigPath = node.getKubeConfigPath();
    const index = localClusterNodes.findIndex(
      (it: LocalClusterNode) => it.filePath === kubeConfigPath
    );
    if (index < 0) {
      return;
    }
    let tmpPath = [...(localClusterNodes || [])];
    let deleted: LocalClusterNode[] = [];
    if (localClusterNodes.length > 0) {
      deleted = tmpPath.splice(index, 1);
    } else {
      tmpPath = [];
    }
    host.setGlobalState(LOCAL_PATH, tmpPath);

    await vscode.commands.executeCommand(REFRESH);
    if (!isExistCluster()) {
      await vscode.commands.executeCommand(
        "setContext",
        "Nocalhost.visibleTree",
        false
      );
    }
    deleted.forEach((f) => {
      fs.unlinkSync(f.filePath);
    });

    // if (tmpPath.length === 0) {
    //   await vscode.commands.executeCommand(SIGN_OUT);
    // } else {
    //   await vscode.commands.executeCommand(REFRESH);
    // }
  }
}