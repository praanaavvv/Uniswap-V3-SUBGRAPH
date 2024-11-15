// tests/uniswap-v-3-factory.test.ts

import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";
import { Address, BigInt, ByteArray } from "@graphprotocol/graph-ts";
import { handlePoolCreated } from ".././src/mappings/uniswap-v-3-factory";
import { createPoolCreatedEvent } from "./uniswap-v-3-factory-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Test handlePoolCreated function", () => {
  beforeAll(() => {
    // Create mock data
    let token0 = Address.fromString("0x0000000000000000000000000000000000000001");
    let token1 = Address.fromString("0x0000000000000000000000000000000000000002");
    let fee = 3000;
    let tickSpacing = 60;
    let pool = Address.fromString("0x0000000000000000000000000000000000000003");
    let timestamp = BigInt.fromI32(1638316800); // Example timestamp
    let blockNumber = BigInt.fromI32(13700000); // Example block number
    let transactionHash = ByteArray.fromHexString(
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    );

    // Create mock event
    let event = createPoolCreatedEvent(
      token0,
      token1,
      fee,
      tickSpacing,
      pool,
      timestamp,
      blockNumber,
      transactionHash
    );

    // Call the handler with the mock event
    handlePoolCreated(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("Pool entity created and stored", () => {
    // Assert that one Pool entity is created
    assert.entityCount("Pool", 1);

    // The Pool entity's ID is the pool address
    let poolId = "0x0000000000000000000000000000000000000003";

    // Assert that the Pool entity has the correct data
    assert.fieldEquals("Pool", poolId, "id", poolId);
    assert.fieldEquals("Pool", poolId, "token0", "0x0000000000000000000000000000000000000001");
    assert.fieldEquals("Pool", poolId, "token1", "0x0000000000000000000000000000000000000002");
    assert.fieldEquals("Pool", poolId, "fee", "3000");
    assert.fieldEquals("Pool", poolId, "createdTimestamp", "1638316800");
    // Add more asserts for other fields if necessary

    // Assert that Token entities are created
    assert.entityCount("Token", 2);

    // Token0
    let token0Id = "0x0000000000000000000000000000000000000001";
    assert.fieldEquals("Token", token0Id, "id", token0Id);
    // You can add more asserts for token fields like symbol, name, decimals, etc.

    // Token1
    let token1Id = "0x0000000000000000000000000000000000000002";
    assert.fieldEquals("Token", token1Id, "id", token1Id);
    // Add more asserts for token1 fields as needed
  });
});
