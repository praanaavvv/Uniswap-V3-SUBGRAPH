// src/utils.ts

import { ERC20 } from '../../generated/Factory/ERC20';
import { Address, BigDecimal, BigInt, log, TypedMap } from '@graphprotocol/graph-ts';
import { Swap as SwapEvent } from '../../generated/templates/Pool/Pool';
import { Pool, Token } from '../../generated/schema';

export const ZERO_BD = BigDecimal.zero();
export const ZERO_BI = BigInt.zero();
export const ONE_BD = BigDecimal.fromString('1');
export const TWO_BI = BigInt.fromI32(2);
export const Q96 = BigInt.fromI32(2).pow(96);

export class TokenData {
  symbol: string;
  name: string;
  decimals: i32;

  constructor(symbol: string, name: string, decimals: i32) {
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }
}

export function fetchTokenData(tokenAddress: Address): TokenData {
  let contract = ERC20.bind(tokenAddress);
  let symbol = 'UNKNOWN';
  let name = 'Unknown Token';
  let decimals: i32 = 18; // Default to 18

  // Attempt to fetch token symbol
  let symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    symbol = symbolResult.value;
  } else {
    log.warning('Failed to fetch symbol for token {}', [tokenAddress.toHexString()]);
  }

  // Attempt to fetch token name
  let nameResult = contract.try_name();
  if (!nameResult.reverted) {
    name = nameResult.value;
  } else {
    log.warning('Failed to fetch name for token {}', [tokenAddress.toHexString()]);
  }

  // Attempt to fetch token decimals
  let decimalsResult = contract.try_decimals();
  if (!decimalsResult.reverted) {
    let decimalsBigInt = decimalsResult.value;
    if (decimalsBigInt.ge(BigInt.fromI32(0)) && decimalsBigInt.le(BigInt.fromI32(255))) {
      decimals = decimalsBigInt.toI32();
    } else {
      log.warning('Decimals value {} out of range for token {}. Using default of 18.', [
        decimalsBigInt.toString(),
        tokenAddress.toHexString(),
      ]);
      decimals = 18; // Default to 18
    }
  } else {
    log.warning('Failed to fetch decimals for token {}', [tokenAddress.toHexString()]);
  }

  // Create and return TokenData instance with all properties
  return new TokenData(symbol, name, decimals);
}

export function exponentToBigDecimal(decimals: i32): BigDecimal {
  // Limit the maximum decimals to prevent overflow
  if (decimals > 255) {
    decimals = 255;
    log.warning('Decimals value too high, limiting to 255.', []);
  }

  let exponent = BigInt.fromI32(10).pow(<u8>decimals);
  return exponent.toBigDecimal();
}

export function calculateProfit(
  event: SwapEvent,
  walletId: string,
  pool: Pool
): TypedMap<string, BigDecimal> {
  // Create a TypedMap to store profit per token
  let profitPerToken = new TypedMap<string, BigDecimal>();

  // Determine if the wallet is the sender or recipient
  let isSender = event.params.sender.toHexString() == walletId;
  let isRecipient = event.params.recipient.toHexString() == walletId;

  // If the wallet is neither sender nor recipient, return empty map
  if (!isSender && !isRecipient) {
    return profitPerToken;
  }

  // Load tokens
  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);
  if (token0 == null || token1 == null) {
    log.warning('Token data missing for pool {}', [pool.id]);
    return profitPerToken;
  }

  // Adjust amounts for decimals
  let amount0 = event.params.amount0
    .toBigDecimal()
    .div(exponentToBigDecimal(token0.decimals));
  let amount1 = event.params.amount1
    .toBigDecimal()
    .div(exponentToBigDecimal(token1.decimals));

  if (isSender) {
    // Sender loses amount0 and gains amount1
    let profit0 = amount0.neg();
    let profit1 = amount1;

    // Update profit per token
    profitPerToken.set(token0.id, profit0);
    profitPerToken.set(token1.id, profit1);
  }

  if (isRecipient) {
    // Recipient gains amount0 and loses amount1
    let profit0 = amount0;
    let profit1 = amount1.neg();

    // Update profit per token
    // If the wallet is both sender and recipient, sum the profits
    if (profitPerToken.isSet(token0.id)) {
      profitPerToken.set(token0.id, profitPerToken.get(token0.id)!.plus(profit0));
    } else {
      profitPerToken.set(token0.id, profit0);
    }

    if (profitPerToken.isSet(token1.id)) {
      profitPerToken.set(token1.id, profitPerToken.get(token1.id)!.plus(profit1));
    } else {
      profitPerToken.set(token1.id, profit1);
    }
  }

  return profitPerToken;
}

function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: BigInt,
  decimals0: i32,
  decimals1: i32
): BigDecimal {
  // Convert sqrtPriceX96 to BigDecimal
  let sqrtPriceX96Decimal = sqrtPriceX96.toBigDecimal();

  // Calculate price: (sqrtPriceX96^2 * 10^decimals0) / (2^192 * 10^decimals1)
  let numerator = sqrtPriceX96Decimal
    .times(sqrtPriceX96Decimal)
    .times(exponentToBigDecimal(decimals0));
  let denominator = Q96.times(Q96).toBigDecimal().times(exponentToBigDecimal(decimals1));

  if (denominator.equals(ZERO_BD)) {
    return ZERO_BD;
  }

  return numerator.div(denominator);
}
