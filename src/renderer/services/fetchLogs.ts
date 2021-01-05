import { postMessage } from "../utils/index";

export interface IFetchLogsParam {
  id: string;
  app: string;
  pod: string;
  container: string;
  tail?: number;
}

export default function fetchLogs(param: IFetchLogsParam): void {
  const { id, app, pod, container, tail } = param;
  postMessage({
    type: "logs/fetch",
    payload: { id, app, pod, container, tail },
  });
}
