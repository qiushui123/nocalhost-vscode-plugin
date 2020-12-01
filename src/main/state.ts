import * as vscode from "vscode";

class State {
  private login = false;

  private stateMap = new Map<string, any>();

  private running = false;

  public isLogin() {
    return this.login;
  }

  public isRunning() {
    return this.running;
  }

  setLogin(state: boolean) {
    vscode.commands.executeCommand("setContext", "login", state);
    this.login = state;
  }

  setRunning(running: boolean) {
    this.running = running;
  }

  get(key: string) {
    return this.stateMap.get(key);
  }

  delete(key: string) {
    this.stateMap.delete(key);
  }

  set(key: string, value: any) {
    this.stateMap.set(key, value);
  }
}

export default new State();