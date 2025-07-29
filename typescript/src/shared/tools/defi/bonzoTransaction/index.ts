// Export main tool
export { default as bonzoDepositTool } from './api-client';

// Export API client functions and constants
export {
  BONZO_DEPOSIT_TOOL,
  BONZO_DEPOSIT_CONFIG,
  BONZO_DEPOSIT_OPERATIONS,
  bonzoDepositFlow,
  executeBonzoDeposit,
  executeBonzoDepositOnly,
  associateWhbarToken,
} from './api-client';

// Export LangChain tools
export {
  createBonzoDepositLangchainTool,
  createBonzoDepositLangchainTools,
} from './langchain-tools';

// Export configuration and schemas
export {
  bonzoDepositParameters,
  bonzoDepositParametersNormalised,
  BONZO_CONFIG,
} from '../../../parameter-schemas/bonzo.zod'; 