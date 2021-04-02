import * as vscode from "vscode";

import ICommand from "./ICommand";
import { SHOW_APP, INSTALL_APP } from "./constants";
import registerCommand from "./register";
import host from "../host";
import { DevSpaceNode } from "../nodes/DevSpaceNode";

export default class ShowApplicationsCommand implements ICommand {
  command: string = SHOW_APP;
  context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  async execCommand(node: DevSpaceNode) {
    if (!node) {
      host.showWarnMessage("A task is running, please try again later");
      return;
    }
    const apps = node.getUninstallApps();
    // show appName
    const appNames = apps.map((app) => {
      const context = app.context;
      let jsonObj = JSON.parse(context);
      const appName = jsonObj["application_name"] as string;
      return appName;
    });

    const result = await vscode.window.showQuickPick(appNames);
    if (!result) {
      return;
    }
    const app = node.getApplication(result);

    // build appNode
    const appNode = node.buildAppNode(app);

    vscode.commands.executeCommand(INSTALL_APP, appNode);
  }
}