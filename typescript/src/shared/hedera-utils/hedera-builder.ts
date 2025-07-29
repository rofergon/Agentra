import {
  TokenAirdropTransaction,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from '@hashgraph/sdk';
import Long from 'long';
import {
  airdropFungibleTokenParametersNormalised,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
} from '../parameter-schemas/hts.zod';
import z from 'zod';
import { transferHbarParametersNormalised } from '../parameter-schemas/has.zod';
import {
  createTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
} from '../parameter-schemas/hcs.zod';

export default class HederaBuilder {
  static createFungibleToken(
    params: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>,
  ) {
    return new TokenCreateTransaction(params);
  }

  static createNonFungibleToken(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>,
  ) {
    return new TokenCreateTransaction(params);
  }

  static transferHbar(params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>) {
    return new TransferTransaction(params);
  }

  static airdropFungibleToken(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParametersNormalised>>,
  ) {
    return new TokenAirdropTransaction(params as any);
  }

  static createTopic(params: z.infer<ReturnType<typeof createTopicParametersNormalised>>) {
    return new TopicCreateTransaction(params);
  }

  static submitTopicMessage(
    params: z.infer<ReturnType<typeof submitTopicMessageParametersNormalised>>,
  ) {
    return new TopicMessageSubmitTransaction(params);
  }

  static associateWhbarToken(params: { accountId: string; tokenIds: string[] }) {
    return new TokenAssociateTransaction()
      .setAccountId(params.accountId)
      .setTokenIds(params.tokenIds);
  }

  static bonzoDeposit(params: { 
    contractId: string; 
    gas: number; 
    payableAmount: string; 
    asset: string; 
    amount: string; 
    onBehalfOf: string; 
    referralCode: number;
  }) {
    const functionParameters = new ContractFunctionParameters()
      .addAddress(params.asset)
      .addUint256(Long.fromString(params.amount))
      .addAddress(params.onBehalfOf)
      .addUint16(params.referralCode);

    return new ContractExecuteTransaction()
      .setContractId(params.contractId)
      .setGas(params.gas)
      .setPayableAmount(Hbar.fromTinybars(Long.fromString(params.payableAmount)))
      .setFunction('deposit', functionParameters);
  }
}
