// src/token.ts

import { Token } from "../../generated/schema";
import { ERC20 } from "../../generated/Factory/ERC20";
import { fetchTokenData } from "./utils";
import { Address } from "@graphprotocol/graph-ts";

export function handleNewToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress.toString());
  if (token == null) {
    token = new Token(tokenAddress.toString());
    let tokenData = fetchTokenData(tokenAddress);
    token.symbol = tokenData.symbol;
    token.name = tokenData.name;
    token.decimals = tokenData.decimals;
    token.save();
  }
  return token as Token;
}
