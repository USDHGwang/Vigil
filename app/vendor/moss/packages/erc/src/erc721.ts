import {
  type ActionCtx,
  Address,
  type AddressValue,
  BooleanFlag,
  Capability,
  type Change,
  createHandle,
  type Hex,
  type InferParams,
  type ReceiptResult as MossReceipt,
  type MossRuntime,
  type ParamsSpec,
  Protocol,
  Query,
  Receipt,
  UnsignedIntegerString,
} from "@themoss/core";
import { decodeEventLog } from "viem";
import { ierc721Abi } from "./abis/erc.js";

const tokenParams = {
  collection: { type: Address, description: "Collection containing the requested token." },
  tokenId: { type: UnsignedIntegerString, description: "Token selected within the collection." },
} satisfies ParamsSpec;

const transferParams = {
  ...tokenParams,
  to: { type: Address, description: "Address that receives the NFT." },
} satisfies ParamsSpec;

const balanceParams = {
  collection: { type: Address, description: "Collection whose balance is requested." },
  owner: { type: Address, description: "Address whose collection balance is read." },
} satisfies ParamsSpec;

const approvalParams = {
  collection: { type: Address, description: "Collection to manage operator approval for." },
  operator: { type: Address, description: "Address authorized to manage the caller's tokens." },
  approved: {
    type: BooleanFlag,
    description:
      "true to grant the operator approval over the caller's tokens, false to revoke it.",
  },
} satisfies ParamsSpec;

const approvalCheckParams = {
  collection: { type: Address, description: "Collection whose approval is checked." },
  owner: { type: Address, description: "Address that may have granted approval." },
  operator: { type: Address, description: "Operator whose approval is checked." },
} satisfies ParamsSpec;

export type ERC721TransferOutcome = {
  operation: "transfer";
  collection: AddressValue;
  from: AddressValue;
  to: AddressValue;
  tokenId: string;
};

export type ERC721ApprovalOutcome = {
  operation: "approvalForAll";
  collection: AddressValue;
  account: AddressValue;
  operator: AddressValue;
  approved: boolean;
};

@Protocol({
  name: "erc721",
  category: "nft",
  description: "Generic ERC-721 transfers, ownership, and balance queries.",
  contracts: {},
})
export class ERC721 {
  declare runtime: MossRuntime;

  #handle(collection: AddressValue, account: AddressValue) {
    return createHandle(ierc721Abi, collection, this.runtime.client, account);
  }

  @Capability<ERC721, typeof transferParams>({
    intent: "Transfer an ERC-721 token",
    verb: "transfer",
    params: transferParams,
    receipt: "transferReceipt",
    risk: ["fundOut"],
    tags: ["nft", "payment"],
  })
  async transfer(params: InferParams<typeof transferParams>, ctx: ActionCtx) {
    return [
      this.#handle(params.collection, ctx.account).safeTransferFrom([
        ctx.account,
        params.to,
        BigInt(params.tokenId),
      ]),
    ];
  }

  @Query({ intent: "Read the owner of an ERC-721 token", params: tokenParams })
  async ownerOf(params: InferParams<typeof tokenParams>, ctx: ActionCtx) {
    const owner = await this.#handle(params.collection, ctx.account).read.ownerOf([
      BigInt(params.tokenId),
    ]);
    return { ...params, owner };
  }

  @Query({ intent: "Read an ERC-721 collection balance", params: balanceParams, tags: ["balance"] })
  async balanceOf(params: InferParams<typeof balanceParams>, ctx: ActionCtx) {
    const balance = await this.#handle(params.collection, ctx.account).read.balanceOf([
      params.owner,
    ]);
    return { ...params, balance: balance.toString() };
  }

  @Capability<ERC721, typeof approvalParams>({
    intent: "Set or revoke an ERC-721 operator approval",
    verb: "approve",
    params: approvalParams,
    receipt: "approvalReceipt",
    risk: ["approval"],
    tags: ["approval"],
  })
  async approve(params: InferParams<typeof approvalParams>, ctx: ActionCtx) {
    return [
      this.#handle(params.collection, ctx.account).setApprovalForAll([
        params.operator,
        params.approved,
      ]),
    ];
  }

  @Query({
    intent: "Check whether an operator is approved for an ERC-721 collection",
    params: approvalCheckParams,
  })
  async isApprovedForAll(params: InferParams<typeof approvalCheckParams>, ctx: ActionCtx) {
    const approved = await this.#handle(params.collection, ctx.account).read.isApprovedForAll([
      params.owner,
      params.operator,
    ]);
    return { ...params, approved };
  }

  @Receipt()
  approvalReceipt(changes: readonly Change[]): MossReceipt<ERC721ApprovalOutcome> {
    if (changes.length !== 1 || changes[0]?.kind !== "event") {
      throw new Error("ERC721 approval Receipt requires exactly one ApprovalForAll event");
    }
    const change = changes[0];
    let decoded: ReturnType<typeof decodeEventLog<typeof ierc721Abi>>;
    try {
      decoded = decodeEventLog({
        abi: ierc721Abi,
        topics: change.topics as [Hex, ...Hex[]],
        data: change.data,
        strict: true,
      });
    } catch {
      throw new Error(`Unexpected Change: ${change.address} emitted an unsupported ERC-721 event`);
    }
    if (decoded.eventName !== "ApprovalForAll") {
      throw new Error(`Unexpected Change: expected ERC721 ApprovalForAll, received ${decoded.eventName}`);
    }
    const outcome: ERC721ApprovalOutcome = {
      operation: "approvalForAll",
      collection: change.address,
      // ERC-721 的事件欄位名是 owner（ERC-1155 才是 account）——欄位不互通
      account: decoded.args.owner,
      operator: decoded.args.operator,
      approved: decoded.args.approved,
    };
    const text = `ERC721 ApprovalForAll: ${outcome.collection} grants ${outcome.operator} ${outcome.approved ? "unlimited" : "no"} authority over ${outcome.account}'s tokens`;
    return {
      kind: "receipt",
      outcome,
      text,
      changes: [{ kind: "change", change, data: outcome, text }],
    };
  }

  @Receipt()
  transferReceipt(changes: readonly Change[]): MossReceipt<ERC721TransferOutcome> {
    if (changes.length !== 1 || changes[0]?.kind !== "event") {
      throw new Error("ERC721 transfer Receipt requires exactly one Transfer event");
    }
    const change = changes[0];
    let decoded: ReturnType<typeof decodeEventLog<typeof ierc721Abi>>;
    try {
      decoded = decodeEventLog({
        abi: ierc721Abi,
        topics: change.topics as [Hex, ...Hex[]],
        data: change.data,
        strict: true,
      });
    } catch {
      throw new Error(`Unexpected Change: ${change.address} emitted an unsupported ERC-721 event`);
    }
    if (decoded.eventName !== "Transfer") {
      throw new Error(`Unexpected Change: expected ERC721 Transfer, received ${decoded.eventName}`);
    }
    const outcome: ERC721TransferOutcome = {
      operation: "transfer",
      collection: change.address,
      from: decoded.args.from,
      to: decoded.args.to,
      tokenId: decoded.args.tokenId.toString(),
    };
    const text = `ERC721 Transfer: ${outcome.collection} #${outcome.tokenId} from ${outcome.from} to ${outcome.to}`;
    return {
      kind: "receipt",
      outcome,
      text,
      changes: [{ kind: "change", change, data: outcome, text }],
    };
  }
}
