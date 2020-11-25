import * as nhctl from "../ctl/nhctl";
import * as kubectl from "../ctl/kubectl";
import git from "../ctl/git";
import { Host } from "../host";
import * as fileUtil from "../utils/fileUtil";
import * as path from "path";
import * as os from "os";

import * as vscode from "vscode";

import { updateAppInstallStatus } from "../api";
import { PodResource, Resource } from "../nodes/resourceType";
import state from "../state";
import {
  CURRENT_KUBECONFIG_FULLPATH,
  KUBE_CONFIG_DIR,
  SELECTED_APP_NAME,
} from "../constants";
import * as fileStore from "../store/fileStore";

interface NocalhostConfig {
  preInstalls: Array<{
    path: string;
    weight?: string | number;
  }>;
  appConfig: {
    name: string;
    type: string;
    resourcePath: string;
  };
  svcConfigs: Array<{
    name: string;
    type: string;
    gitUrl: string;
    devLang: string; // # java|go|node|php
    devImage: string;
    workDir: string;
    localWorkDir: string;
    sync: Array<string>;
    ignore: Array<string>;
    sshPort: {
      localPort: number;
      sshPort: number;
    };
    devPort: Array<string>;
    command: Array<string>;
    jobs: Array<string>;
    pods: Array<string>;
  }>;
}

const NHCTL_DIR = path.resolve(os.homedir(), ".nhctl");

class NocalhostService {
  private async getGitUrl(appName: string, workloadName: string) {
    const config = await this.getAppConfig(appName);
    const arr = config.svcConfigs;
    for (let i = 0; i < arr.length; i++) {
      const { gitUrl, name } = arr[i];
      if (name === workloadName) {
        return gitUrl;
      }
    }
  }

  private async getAppConfig(appName: string) {
    const configPath = path.resolve(
      NHCTL_DIR,
      "application",
      appName,
      ".nocalhost",
      "config.yaml"
    );
    const config = (await fileUtil.readYaml(configPath)) as NocalhostConfig;

    return config;
  }

  private async writeConfig(appName: string, config: NocalhostConfig) {
    const configPath = path.resolve(
      NHCTL_DIR,
      "application",
      appName,
      ".nocalhost",
      "config.yaml"
    );
    await fileUtil.writeYaml(configPath, config);
  }

  private async cloneAppAllSource(host: Host, appName: string) {
    const isClone = await host.showInformationMessage(
      "Do you want to clone the code?",
      "confirm",
      "cancel"
    );
    if (isClone === "cancel") {
      return;
    }
    host.log("start clone source ...", true);
    const configPath = path.resolve(
      NHCTL_DIR,
      "application",
      appName,
      ".nocalhost",
      "config.yaml"
    );
    const config = (await fileUtil.readYaml(configPath)) as NocalhostConfig;
    const dir = await host.showSelectFolderDialog(
      "please select directory of saving source code"
    );
    let dirPath: string;
    if (dir) {
      dirPath = (dir as vscode.Uri[])[0].fsPath;
      // replace localWorkDir
      config.svcConfigs.map((item) => {
        item.localWorkDir = path.resolve(dirPath, item.name);
        item.sync = [path.resolve(dirPath, item.name)];
      });
      await fileUtil.writeYaml(configPath, config);
    }
    const arr = config.svcConfigs;
    for (let i = 0; i < arr.length; i++) {
      const { gitUrl, localWorkDir } = arr[i];
      if (gitUrl) {
        const isExist = await fileUtil.isExist(localWorkDir);
        if (isExist) {
          continue;
        }
        await git.clone(host, gitUrl, [localWorkDir]);
      }
    }
    host.log("end clone source", true);
  }
  async install(
    host: Host,
    appName: string,
    appId: number,
    devSpaceId: number,
    gitUrl: string
  ) {
    host.log("installing app ...", true);
    await nhctl.install(host, appName, gitUrl);
    await updateAppInstallStatus(appId, devSpaceId, 1);
    // await this.cloneAppAllSource(host, `${appId}`);
    host.log("installed app", true);

    vscode.commands.executeCommand("refreshApplication");
  }

  async log(host: Host, appId: number, type: string, workloadName: string) {
    const resArr = await kubectl.getControllerPod(host, type, workloadName);
    if (resArr && resArr.length <= 0) {
      host.showErrorMessage("Not found pod");
      return;
    }
    const podNameArr = (resArr as Array<Resource>).map((res) => {
      return res.metadata.name;
    });
    let podName: string | undefined = podNameArr[0];
    if (podNameArr.length > 1) {
      podName = await vscode.window.showQuickPick(podNameArr);
    }
    if (!podName) {
      return;
    }
    const podStr = await kubectl.loadResource(host, "pod", podName, "json");
    const pod = JSON.parse(podStr as string) as PodResource;
    const containerNameArr = pod.spec.containers.map((c) => {
      return c.name;
    });
    let containerName: string | undefined = containerNameArr[0];
    if (containerNameArr.length > 1) {
      containerName = await vscode.window.showQuickPick(containerNameArr);
    }
    if (!containerName) {
      return;
    }

    const uri = vscode.Uri.parse(
      `Nocalhost://k8s/log/${podName}/${containerName}`
    );
    let doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async uninstall(
    host: Host,
    appName: string,
    appId: number,
    devSpaceId: number
  ) {
    host.log("uninstalling app ...", true);
    host.showInformationMessage("uninstalling app ...");
    await nhctl.uninstall(host, appName);
    await updateAppInstallStatus(appId, devSpaceId, 0);
    host.log("uninstalled app", true);
    host.showInformationMessage("uninstalled app ...");

    vscode.commands.executeCommand("refreshApplication");
  }

  private async cloneCode(host: Host, appName: string, workloadName: string) {
    const key = `${appName}_${workloadName}_directory`;
    let destDir: string | undefined;
    const nocalhostConfig = await this.getNocalhostConfig();
    let gitUrl = await this.getGitUrl(appName, workloadName);
    if (!gitUrl) {
      gitUrl = await host.showInputBox({
        placeHolder: "please input your git url",
      });
    }
    if (gitUrl) {
      const saveUris = await host.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: "select save directory",
      });
      if (saveUris) {
        destDir = path.resolve(saveUris[0].fsPath, workloadName);
        await git.clone(host, gitUrl, [destDir]);
        fileStore.set(key, destDir);
        nocalhostConfig.svcConfigs.forEach((conf) => {
          if (conf.name === workloadName) {
            conf.localWorkDir = destDir as string;
            return;
          }
        });
        this.writeConfig(appName, nocalhostConfig);
      }
    }
    return destDir;
  }

  async entryDevSpace(
    host: Host,
    appName: string,
    type: string,
    workloadName: string
  ) {
    const key = `${appName}_${workloadName}_directory`;
    let directory = fileStore.get(key);
    const currentUri = vscode.workspace.rootPath;
    if (!directory) {
      const result = await host.showInformationMessage(
        "current directory is not the directory of devSpace?",
        "clone source",
        "open source directory"
      );
      if (result === "clone source") {
        await this.cloneCode(host, appName, workloadName);
      } else if (result === "open source directory") {
        const uris = await host.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
        });
        if (uris) {
          fileStore.set(key, uris[0].fsPath);
          vscode.commands.executeCommand("vscode.openFolder", uris[0], {
            forceReuseWindow: true,
          });
          return;
        }
      }
    }
    // fresh config
    directory = fileStore.get(key);
    if (currentUri !== directory) {
      const result = await host.showInformationMessage(
        "current directory is not the directory of devSpace. open source directory",
        "select other directory",
        "open source directory",
        "cancel"
      );
      if (result === "select other directory") {
        const uris = await host.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
        });
        if (uris) {
          fileStore.set(key, uris[0].fsPath);
          vscode.commands.executeCommand("vscode.openFolder", uris[0], {
            forceReuseWindow: true,
          });
          return;
        }
      } else if (result === "open source directory") {
        const uri = vscode.Uri.file(directory);
        vscode.commands.executeCommand("vscode.openFolder", uri, {
          forceReuseWindow: true,
        });
        return;
      }
    }

    // fresh config
    directory = fileStore.get(key);
    const nocalhostConfig = await this.getNocalhostConfig();
    nocalhostConfig.svcConfigs.map((config) => {
      if (config.name === workloadName) {
        config.sync.push(directory);
        return;
      }
    });

    await this.writeConfig(appName, nocalhostConfig);

    host.log("replace image ...", true);
    host.showInformationMessage("replacing image ...");
    await nhctl.replaceImage(host, appName, workloadName);
    host.log("replace image end", true);
    host.log("", true);

    host.log("port forward ...", true);
    host.showInformationMessage("port forwarding ...");
    const portForwardDispose = await nhctl.startPortForward(
      host,
      appName,
      workloadName
    );
    host.pushDebugDispose(portForwardDispose);
    host.log("port forward end", true);
    host.log("", true);

    host.log("sync file ...", true);
    host.showInformationMessage("sysc file ...");
    await nhctl.syncFile(host, appName, workloadName);
    host.log("sync file end", true);
    host.log("", true);

    // record debug state
    state.set(`${appName}_${workloadName}_debug`, true);

    await this.exec(host, appName, type, workloadName);
  }

  private async getNocalhostConfig() {
    const appName = fileStore.get(SELECTED_APP_NAME);
    const configPath = path.resolve(
      NHCTL_DIR,
      "application",
      appName,
      ".nocalhost",
      "config.yaml"
    );
    const config = (await fileUtil.readYaml(configPath)) as NocalhostConfig;

    return config;
  }

  async exitDevSpace(host: Host, appName: string, workLoadName: string) {
    host.showInformationMessage("ending devSpace ...");
    host.log("ending devSpace ...", true);
    await nhctl.exitDevSpace(host, appName, workLoadName);
    host.showInformationMessage("ended devSpace");
    host.log("ended devSpace", true);
    state.delete(`${appName}_${workLoadName}_devSpace`);
  }

  async exec(host: Host, appName: string, type: string, workloadName: string) {
    const isdevSpace = state.get(`${appName}_${workloadName}_devSpace`);
    if (isdevSpace) {
      await this.opendevSpaceExec(host, type, workloadName);
    } else {
      await this.openExec(host, type, workloadName);
    }
  }

  async opendevSpaceExec(host: Host, type: string, workloadName: string) {
    host.log("open container ...", true);
    host.showInformationMessage("open container ...");
    const resArr = await kubectl.getControllerPod(host, type, workloadName);
    if (resArr && resArr.length <= 0) {
      host.showErrorMessage("Not found pod");
      return;
    }
    const podName = (resArr as Array<Resource>)[0].metadata.name;
    const kubeconfigPath = fileStore.get(CURRENT_KUBECONFIG_FULLPATH);
    const command = `kubectl exec -it ${podName} -c nocalhost-dev --kubeconfig ${kubeconfigPath} -- /bin/sh`;
    const terminalDisposed = host.invokeInNewTerminal(command);
    host.pushDebugDispose(terminalDisposed);
    host.log("open container end", true);
    host.log("", true);
  }

  /**
   * exec
   * @param host
   * @param type
   * @param workloadName
   */
  async openExec(host: Host, type: string, workloadName: string) {
    host.log("open container ...", true);
    host.showInformationMessage("open container ...");
    const resArr = await kubectl.getControllerPod(host, type, workloadName);
    if (resArr && resArr.length <= 0) {
      host.showErrorMessage("Not found pod");
      return;
    }
    const podNameArr = (resArr as Array<Resource>).map((res) => {
      return res.metadata.name;
    });
    let podName: string | undefined = podNameArr[0];
    if (podNameArr.length > 1) {
      podName = await vscode.window.showQuickPick(podNameArr);
    }
    if (!podName) {
      return;
    }
    const podStr = await kubectl.loadResource(host, "pod", podName, "json");
    const pod = JSON.parse(podStr as string) as PodResource;
    const containerNameArr = pod.spec.containers.map((c) => {
      return c.name;
    });
    let containerName: string | undefined = containerNameArr[0];
    if (containerNameArr.length > 1) {
      containerName = await vscode.window.showQuickPick(containerNameArr);
    }
    if (!containerName) {
      return;
    }
    const kubeconfigPath = fileStore.get(CURRENT_KUBECONFIG_FULLPATH);
    const command = `kubectl exec -it ${podName} -c ${containerName} --kubeconfig ${kubeconfigPath} -- /bin/sh`;
    const terminalDisposed = host.invokeInNewTerminal(command);
    host.pushDebugDispose(terminalDisposed);
    host.log("open container end", true);
    host.log("", true);
  }

  async portForward(host: Host, type: string, workloadName: string) {
    const resArr = await kubectl.getControllerPod(host, type, workloadName);
    if (resArr && resArr.length <= 0) {
      host.showErrorMessage("Not found pod");
      return;
    }
    const podNameArr = (resArr as Array<Resource>).map((res) => {
      return res.metadata.name;
    });
    let podName: string | undefined = podNameArr[0];
    if (podNameArr.length > 1) {
      podName = await vscode.window.showQuickPick(podNameArr);
    }
    if (!podName) {
      return;
    }
    let portMap: string | undefined = "";
    portMap = await vscode.window.showInputBox({
      placeHolder: "eg: 1234:1234",
    });
    if (!portMap) {
      return;
    }
    // kubeconfig
    const kubeconfigPath = fileStore.get(CURRENT_KUBECONFIG_FULLPATH);
    const command = `kubectl port-forward ${podName} ${portMap} --kubeconfig ${kubeconfigPath}`;
    const terminalDisposed = host.invokeInNewTerminal(command);
    host.pushDebugDispose(terminalDisposed);
    host.log("open container end", true);
    host.log("", true);
  }
}

export default new NocalhostService();
