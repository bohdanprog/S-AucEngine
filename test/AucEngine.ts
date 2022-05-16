import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { AucEngine } from "../typechain";

interface AucEngineContext {
  token: AucEngine;
  owner: SignerWithAddress;
  seller: SignerWithAddress;
  buyer: SignerWithAddress;
}

describe("AucEngine", () => {
  let ctx: AucEngineContext;

  beforeEach(async function () {
    const [owner, seller, buyer] = await ethers.getSigners();
    const AucEngine = await ethers.getContractFactory("AucEngine", owner);
    const aucEngine = await AucEngine.deploy();
    ctx = { token: aucEngine, owner, seller, buyer };
  });
  it("sets owner", async () => {
    const currentOwner = await ctx.token.owner();
    expect(currentOwner).to.eq(ctx.owner.address);
  });

  const getTimestamp = async (bn: number) => {
    return (await ethers.provider.getBlock(bn)).timestamp;
  };
  describe("create auction", () => {
    it("create auction correctly", async () => {
      const txData = {
        _startingPrice: ethers.utils.parseEther("0.03"),
        _discountRate: 3,
        _item: "fake item",
        _duration: 60,
      };
      const tx = await ctx.token.createAuction(
        txData._startingPrice,
        txData._discountRate,
        txData._item,
        txData._duration
      );
      const currentAuction = await ctx.token.auctions(0);
      expect(currentAuction.item).to.eq("fake item");
      const ts = await getTimestamp(tx.blockNumber!);
      expect(currentAuction.endsAt).to.eq(ts + txData._duration);
    });
  });

  const delay = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  describe("buy", () => {
    const txData = {
      _startingPrice: ethers.utils.parseEther("0.0001"),
      _discountRate: 3,
      _item: "fake item",
      _duration: 60,
    };
    it("allows to buy", async () => {
      await ctx.token
        .connect(ctx.seller)
        .createAuction(
          txData._startingPrice,
          txData._discountRate,
          txData._item,
          txData._duration
        );
      await delay(2000);
      const buyTx = await ctx.token
        .connect(ctx.buyer)
        .buy(0, { value: txData._startingPrice });

      const currentAuction = await ctx.token.auctions(0);
      const finalPrice = currentAuction.finalPrice.toNumber();

      await expect(() => buyTx).to.changeEtherBalance(
        ctx.seller,
        finalPrice - Math.floor((finalPrice * 10) / 100)
      );

      await expect(buyTx)
        .to.emit(ctx.token, "AuctionEnded")
        .withArgs(0, finalPrice, ctx.buyer.address);

      await expect(
        ctx.token
          .connect(ctx.buyer)
          .buy(0, { value: ethers.utils.parseEther("0.0001") })
      ).revertedWith("stopped!");
    });
  });
});
