// src/pool.ts

import {
  Swap as SwapEvent,
} from '../../generated/templates/Pool/Pool';
import {
  Pool,
  Swap,
  Token,
  Wallet,
  WalletTokenProfit,
  WalletTokenDayData,
} from '../../generated/schema';
import {
  ZERO_BD,
  calculateProfit,
} from './utils';
import { BigInt, log, TypedMap, BigDecimal } from '@graphprotocol/graph-ts';

export function handleSwap(event: SwapEvent): void {
  let poolId = event.address.toHexString();
  let pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found for id {}. Skipping Swap event.', [poolId]);
    return;
  }

  // Load tokens associated with the pool
  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);

  if (token0 == null || token1 == null) {
    log.warning('Token data missing for pool {}', [poolId]);
    return;
  }

  // Create Swap entity
  let swapId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
  let swap = new Swap(swapId);
  swap.pool = poolId;
  swap.token0 = token0.id;
  swap.token1 = token1.id;
  swap.sender = event.params.sender.toHexString();
  swap.recipient = event.params.recipient.toHexString();
  swap.amount0 = event.params.amount0;
  swap.amount1 = event.params.amount1;
  swap.sqrtPriceX96 = event.params.sqrtPriceX96;
  swap.liquidity = event.params.liquidity;
  swap.tick = BigInt.fromI32(event.params.tick);
  swap.timestamp = event.block.timestamp;
  swap.transactionHash = event.transaction.hash.toHexString();
  swap.save();

  // Update or create Wallet entities
  let senderId = event.params.sender.toHexString();
  let recipientId = event.params.recipient.toHexString();

  let sender = Wallet.load(senderId);
  if (sender == null) {
    sender = new Wallet(senderId);
    sender.save();
  }

  let recipient = Wallet.load(recipientId);
  if (recipient == null) {
    recipient = new Wallet(recipientId);
    recipient.save();
  }

  // Calculate profit per token for sender and recipient
  let senderProfits = calculateProfit(event, senderId, pool);
  let recipientProfits = calculateProfit(event, recipientId, pool);

  // Update cumulative profit per token for sender
  let senderProfitEntries = senderProfits.entries;
  for (let i = 0; i < senderProfitEntries.length; i++) {
    let entry = senderProfitEntries[i];
    let tokenId = entry.key;
    let profitAmount = entry.value;

    updateWalletTokenProfit(senderId, tokenId, profitAmount);
    updateWalletTokenDayData(senderId, profitAmount, tokenId, event.block.timestamp.toI32());
  }

  // Update cumulative profit per token for recipient
  let recipientProfitEntries = recipientProfits.entries;
  for (let i = 0; i < recipientProfitEntries.length; i++) {
    let entry = recipientProfitEntries[i];
    let tokenId = entry.key;
    let profitAmount = entry.value;

    updateWalletTokenProfit(recipientId, tokenId, profitAmount);
    updateWalletTokenDayData(recipientId, profitAmount, tokenId, event.block.timestamp.toI32());
  }
}

function updateWalletTokenProfit(walletId: string, tokenId: string, profitAmount: BigDecimal): void {
  let id = walletId + '-' + tokenId;
  let walletTokenProfit = WalletTokenProfit.load(id);
  if (walletTokenProfit == null) {
    walletTokenProfit = new WalletTokenProfit(id);
    walletTokenProfit.wallet = walletId;
    walletTokenProfit.token = tokenId;
    walletTokenProfit.cumulativeProfit = ZERO_BD;
  }
  walletTokenProfit.cumulativeProfit = walletTokenProfit.cumulativeProfit.plus(profitAmount);
  walletTokenProfit.save();
}

function updateWalletTokenDayData(
  walletId: string,
  amount: BigDecimal,
  tokenId: string,
  timestamp: i32
): void {
  let dayTimestamp = (timestamp / 86400) * 86400;
  let id = walletId + '-' + tokenId + '-' + dayTimestamp.toString();
  let walletTokenDayData = WalletTokenDayData.load(id);
  if (walletTokenDayData == null) {
    walletTokenDayData = new WalletTokenDayData(id);
    walletTokenDayData.date = dayTimestamp;
    walletTokenDayData.wallet = walletId;
    walletTokenDayData.token = tokenId;
    walletTokenDayData.amountBought = ZERO_BD;
    walletTokenDayData.dailyProfit = ZERO_BD;
    walletTokenDayData.cumulativeProfit = ZERO_BD;
  }

  // Update amountBought if amount is positive
  if (amount.gt(ZERO_BD)) {
    walletTokenDayData.amountBought = walletTokenDayData.amountBought.plus(amount);
  }

  // Update daily and cumulative profit
  walletTokenDayData.dailyProfit = walletTokenDayData.dailyProfit.plus(amount);
  walletTokenDayData.cumulativeProfit = walletTokenDayData.cumulativeProfit.plus(amount);

  walletTokenDayData.save();
}
