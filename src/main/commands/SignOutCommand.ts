import * as vscode from "vscode";

import ICommand from "./ICommand";
import { SIGN_OUT } from "./constants";
import registerCommand from "./register";

import state from "../state";
import { KUBE_CONFIG_DIR, SERVER_CLUSTER_LIST } from "../constants";
import host from "../host";
import { IUserInfo } from "../domain";
import { KubeConfigNode } from "../nodes/KubeConfigNode";
import * as fs from "fs";
import Bookinfo from "../common/bookinfo";

export default class SignOutCommand implements ICommand {
  command: string = SIGN_OUT;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  async execCommand(node: KubeConfigNode) {
    if (!node) {
      host.showWarnMessage("Failed to get node configs, please try again.");
      return;
    }
    host.stopAutoRefresh();

    let globalUserList: {
      userInfo: IUserInfo;
      jwt: string;
      id: string;
    }[] = (host.getGlobalState(SERVER_CLUSTER_LIST) || []).filter((it: any) => {
      if (!it.userInfo || !node.id) {
        return true;
      }
      return it.id !== node.id;
    });
    host.setGlobalState(SERVER_CLUSTER_LIST, globalUserList);

    await state.disposeNode(node);

    Bookinfo.cleanCheck(node);

    await state.refreshTree();
  }

  async removeAllKubeconfig() {
    KUBE_CONFIG_DIR;
    fs.rmdirSync(KUBE_CONFIG_DIR, { recursive: true });
    fs.mkdirSync(KUBE_CONFIG_DIR);
  }
}
