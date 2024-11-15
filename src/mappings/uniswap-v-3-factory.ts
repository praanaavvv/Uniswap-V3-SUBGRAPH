// src/factory.ts

import { BigInt, log } from "@graphprotocol/graph-ts";
import { PoolCreated } from "../../generated/Factory/Factory";
import { Pool, Token } from "../../generated/schema";
import { Pool as PoolTemplate } from "../../generated/templates";
import { fetchTokenData } from "./utils";

export function handlePoolCreated(event: PoolCreated): void {
  let poolAddress = event.params.pool.toHexString();

  // Create Pool entity
  let pool = new Pool(poolAddress);
  pool.token0 = event.params.token0.toHexString();
  pool.token1 = event.params.token1.toHexString();
  pool.fee = BigInt.fromI32(event.params.fee);
  pool.createdTimestamp = event.block.timestamp; // Ensure this field is set
  pool.save();

  // Start indexing events from the new pool
  PoolTemplate.create(event.params.pool);

  // Create Token entities if they don't exist
  let token0Id = event.params.token0.toHexString();
  let token0 = Token.load(token0Id);
  if (token0 == null) {
    let token0Data = fetchTokenData(event.params.token0);
    token0 = new Token(token0Id);
    token0.symbol = token0Data.symbol;
    token0.name = token0Data.name;
    token0.decimals = token0Data.decimals;
    // Removed usdPrice as it's no longer applicable
    token0.save();
  }

  let token1Id = event.params.token1.toHexString();
  let token1 = Token.load(token1Id);
  if (token1 == null) {
    let token1Data = fetchTokenData(event.params.token1);
    token1 = new Token(token1Id);
    token1.symbol = token1Data.symbol;
    token1.name = token1Data.name;
    token1.decimals = token1Data.decimals;
    // Removed usdPrice as it's no longer applicable
    token1.save();
  }

  log.info("Pool created: {}", [poolAddress]);
}
