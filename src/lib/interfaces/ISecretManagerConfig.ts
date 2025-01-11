import type { EnvironmentVariable } from "../common/Aliases";
import { IHttpHeaders } from "./IHttpHeaders";

export interface ISecretManagerConfig {
    secretName: string;
    region: string;
    headerMappings: { [K in keyof IHttpHeaders]: EnvironmentVariable };
  }