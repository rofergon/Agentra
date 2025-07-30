import { IHederaMirrornodeService } from './hedera-utils/mirrornode/hedera-mirrornode-service.interface';

export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  RETURN_BYTES = 'returnBytes',
}

// Context are settings that are applied to all requests made by the integration.
export type Context = {
  // Account is a Connected Account ID. If set, the integration will
  // make requests for this Account.
  accountId?: string;
  // Account Public Key is either passed in configuration or fetched based on the passed accountId
  accountPublicKey?: string;

  // defines if the agent executes the transactions or returns the raw transaction bytes
  mode?: AgentMode;

  // Mirrornode config
  mirrornodeService?: IHederaMirrornodeService;
};

export type Configuration = {
  //if empty, all tools will be used.
  tools?: string[];
  context?: Context;
};

// Network configuration helpers
export type HederaNetwork = 'testnet' | 'mainnet';

export const getHederaNetwork = (): HederaNetwork => {
  const network = process.env.HEDERA_NETWORK?.toLowerCase();
  if (network !== 'testnet' && network !== 'mainnet') {
    console.warn(`Invalid HEDERA_NETWORK: ${network}. Defaulting to testnet`);
    return 'testnet';
  }
  return network as HederaNetwork;
};

export const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue!;
};

export const getNetworkSpecificEnvVar = (
  prefix: string, 
  suffix: string, 
  network?: HederaNetwork,
  defaultValue?: string
): string => {
  const currentNetwork = network || getHederaNetwork();
  const networkUpper = currentNetwork.toUpperCase();
  const envVarName = `${prefix}_${networkUpper}_${suffix}`;
  return getEnvVar(envVarName, defaultValue);
};
