# HBAR (WHBAR) Deposit Flow in Bonzo Finance

## Context: Bonzo Finance and WHBAR Usage

Bonzo Finance is a lending protocol on Hedera based on Aave v2, adapted to work with Hedera's EVM and its Hedera Token Service (HTS). In Bonzo (like in Aave), to deposit HBAR, a wrapped token called **WHBAR (Wrapped HBAR)** is used.

WHBAR is an ERC-20 token that represents HBAR 1:1; this allows HBAR (which is normally not an ERC-20) to integrate into smart contracts like any other token. Essentially, when depositing HBAR into the protocol, it gets converted (or "wrapped") into WHBAR, and then the user receives an aToken (aWHBAR) that represents their deposit within the platform.

Below is the complete workflow for making a "supply" (deposit) of HBAR in Bonzo Finance.

## LendingPool Contract: Proxy and Implementation

The Bonzo LendingPool contract on mainnet is a proxy contract located at the address:
```
0x236897c518996163E7b313aD21D1C9fCC7BA1afc
```

This means that this address does not contain the logic directly, but rather delegates calls to an implementation contract (LendingPoolImpl).

HashScan shows that `0x2368...` is an `InitializableImmutableAdminUpgradeabilityProxy` (an upgradeable proxy); that's why it only exposes functions like `admin()`, `upgradeTo()`, etc., and not the read/write functions of the pool itself.

The real logic of `deposit()` resides in the associated implementation contract (for example, the LendingPoolImpl address on mainnet is `0x5290b075d737606fccccA2f745D7337E0fCe633B` according to the documentation).

When interacting with the LendingPool (for example, calling `deposit`), the proxy actually forwards the call to the implementation where the real function execution occurs.

## WHBAR Token Association Before Deposit

Before making a HBAR/WHBAR deposit, it's necessary to associate the WHBAR token to the user's account on the Hedera network. Hedera requires accounts to explicitly "accept" (associate) each HTS token they will own.

In this case, WHBAR is an HTS token (ID `0.0.1456986` on Hedera), so the Bonzo interface first requests the user to make an association transaction. This association allows the user's account to receive and own WHBAR or aWHBAR without transfers failing.

> **Note**: The aWHBAR aToken of Bonzo is implemented as an ERC-20 smart contract, not as a native HTS token, so it probably doesn't require association. However, WHBAR association is mandatory to interact with wrapped HBAR.

Once the user signs and sends the WHBAR association, they are ready to deposit HBAR into the protocol.

## Execution of the deposit() Function (HBAR Supply Flow)

When a user makes a "supply" of HBAR in Bonzo (for example, 1.01 HBAR), the following steps occur internally:

### 1. Deposit Call from Front-end

The user initiates the deposit transaction through the UI or tool, which invokes:
```solidity
LendingPool.deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
```

For the HBAR case:
- **asset**: the WHBAR address (for example, `0x0000000000000000000000000000000000163b5a` corresponds to the WHBAR token)
- **amount**: the amount in tinybars (HBAR has 8 decimals in HTS)
- **onBehalfOf**: usually the same user's address (unless depositing on behalf of another account)
- **referralCode**: typically 0

> **Important**: Since HBAR is the native currency, the user attaches HBAR as value (`msg.value`) in the transaction for the specified amount. For example, to deposit 1.01 HBAR, `amount = 101,000,000` (since 1 HBAR = 100,000,000 tinybars) and 1.01 ℏ is sent as value in the contract call.

### 2. Wrapping HBAR to WHBAR (WHBAR mint)

When the call is received, the `deposit()` implementation detects that the deposited asset is WHBAR (the HBAR wrapper). Consequently, the contract proceeds to convert the sent HBAR into equivalent WHBAR tokens.

Basically, the protocol uses the special WHBAR contract to mint the corresponding amount of WHBAR from the received HBAR. Each deposited HBAR results in 1 minted WHBAR, maintaining a 1:1 parity.

Internally, this is achieved through HTS precompiles: the LendingPool/WHBAR contract invokes the mint function of the WHBAR token (for which it has supply permissions) creating, for example, 1.01 WHBAR if the user sent 1.01 HBAR.

> **Figure**: Illustrative diagram of how HBAR to WHBAR wrapping works and its subsequent unwrapping. When depositing HBAR into the WHBAR contract, the same amount of WHBAR tokens are minted; when withdrawing, WHBAR is burned and the underlying HBAR is released.

In the Bonzo context, this step occurs within the `deposit()` execution. The transaction on Hedera shows a `Token Mint` event of the WHBAR token (ID `0.0.1456986`) for the deposited amount (e.g., 1.01000000 WHBAR), which confirms that new WHBAR tokens equivalent to the delivered HBAR were created.

### 3. WHBAR Transfer to Pool (Reserve)

After minting the WHBAR, the protocol needs to store these tokens as pool liquidity. In Aave/Bonzo, deposits are custodied in the aToken contract, which acts as the asset reserve.

Therefore, the next sub-step is to transfer the newly minted WHBAR to the aWHBAR address (the aToken corresponding to HBAR). In the transaction record, this appears as a `Crypto Transfer` of WHBAR: for example, a transfer of 1.01 WHBAR was observed from the issuing account (the treasury or WHBAR contract) to account `0.0.7308509`, which corresponds to the aWHBAR contract on mainnet.

In other words, the 1.01 WHBAR generated were moved to the contract that maintains WHBAR liquidity in the protocol (i.e., the aToken acts as the "vault" of the underlying). After this step, those WHBAR remain under protocol control (pool reserve), not the user's.

### 4. aToken Mint (aWHBAR) for the User

Now that the protocol has 1.01 additional WHBAR in its reserve, it issues the user their deposit receipts in the form of aWHBAR. The aWHBAR is an interest-bearing ERC-20 token (with yield) that represents the user's participation in the WHBAR pool.

The aWHBAR contract mints exactly the amount equivalent to the deposit (1.01 aWHBAR) and assigns it to the user. In the transaction, this is reflected in aWHBAR contract events, typically a `Transfer` event (ERC20) from address `0x0` (indicating mint) to the user's address, for the value 1.01 aWHBAR, and an internal `Mint` event in the aToken that records the action.

In this way, the user becomes the holder of aWHBAR tokens, while the pool maintains the underlying WHBAR.

> **It's worth noting** that in Bonzo's documentation, both the WHBAR token and its corresponding aToken are listed: for example, WHBAR has address `0x...163b5a` and its aToken is `0x6e96...15af32`, which coincides with account `0.0.7308509` where the WHBAR were deposited.

### 5. Deposit Events and Confirmation

Finally, the LendingPool contract emits a `Deposit` event to record the operation. This event includes information such as the deposited asset (WHBAR), the user who made the deposit (or onBehalfOf if applicable), the amount, and the referral code.

In the logs provided by HashScan, an event associated with the LendingPool address (proxy) can be seen with a topic that corresponds to the hash of the `Deposit` event. This event shows as an indexed parameter the WHBAR token address (`...163b5a`), indicating that it was a WHBAR deposit, and very likely includes the user's address and the deposited amount in the data fields (not indexed).

Along with this, the transaction shows a `SUCCESS` result, confirming that the deposit was performed correctly. From this point, the user has aWHBAR in their account (which will grow in value as they generate interest), and can eventually withdraw their deposit by requesting the inverse operation (burning aWHBAR to recover HBAR, which will involve unwrapping WHBAR back to HBAR by the protocol).

## How to Replicate the Deposit in Another Front-end or Application

To replicate this flow in your own tool (for example, an AI agent or script), you must follow the key steps described above:

### Token Association
Ensure that the account from which the deposit will be made has the WHBAR token associated (`0.0.1456986`). This involves sending a token association transaction to the Hedera network before the first deposit. Without this association, any attempt to transfer or receive WHBAR will fail due to network rules.

### LendingPool Contract Call
Invoke the `deposit` function of the LendingPool proxy on Hedera Mainnet (`0x236897c518996163E7b313aD21D1C9fCC7BA1afc`). The parameters must be:

- **asset**: the address of the token to deposit. For HBAR, use the ERC20 address of WHBAR `0x0000000000000000000000000000000000163b5a` (which represents ID `0.0.1456986`).
- **amount**: the amount to deposit in the token's minimum unit. For HBAR, calculate the necessary tinybars (e.g., 1 HBAR = 100,000,000, so 1.01 HBAR = 101,000,000).
- **onBehalfOf**: the beneficiary address of the deposit. Usually the same address as the user making the deposit, unless you want to deposit to another account.
- **referralCode**: a referral code (in Bonzo normally 0 if there's no active referral program).

### Send HBAR with the Transaction
When executing the call, include the HBAR amount equivalent to the `amount` as the native value of the transaction (for example, in Hedera EVM SDKs, this is specified as `payableAmount`). This is essential since the contract will take those HBAR and convert them to WHBAR internally. If HBAR is not sent (or if a different amount than the specified `amount` is sent), the transaction could revert for not having funds to mint the WHBAR.

### Internal Processing
The contract will handle the internal steps (WHBAR mint, transfer to reserve, aToken mint, etc.) automatically. It's not necessary for the application to handle them manually, it just needs to handle the call correctly. After successful confirmation, the application can verify that the user's aWHBAR balance increased by the deposited amount and/or that the `Deposit` event was emitted.

## Summary

The flow of an HBAR deposit in Bonzo involves converting HBAR to WHBAR under the hood and giving the user aWHBAR tokens as a receipt for their liquidity contribution. The platform handles the wrapping logic and aToken issuance transparently, so when replicating it in another frontend, it's crucial to prepare the transaction correctly (prior associations and adequate parameters) so that the LendingPool contract can execute the deposit as observed on the official platform.

With these steps, an external agent can interact with the Bonzo protocol on Hedera and perform deposits correctly, obtaining the corresponding aTokens for each supply made.

---

**Sources**: Bonzo Finance Docs and Hedera Docs (flow analysis based on official documentation and transaction records on HashScan).

- [Overview | Bonzo Finance Documentation](https://docs.bonzo.finance/hub/)
- [Wrapped HBAR (WHBAR) | Hedera](https://docs.hedera.com/hedera/core-concepts/smart-contracts/wrapped-hbar-whbar)
- [Protocol Contracts | Bonzo Finance Documentation](https://docs.bonzo.finance/hub/developer/protocol-contracts) 