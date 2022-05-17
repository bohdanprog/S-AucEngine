import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { AucEngine } from "../typechain";
// eslint-disable-next-line node/no-missing-import
import { delay, getTimestamp } from "./Utils";

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

  describe("create auction", () => {
    const txData = {
      _startingPrice: ethers.utils.parseEther("0.03"),
      _discountRate: 3,
      _item: "fake item",
      _duration: 60,
    };
    const txBadData = {
      _startingPrice: ethers.utils.parseEther("0.000000000003"),
      _discountRate: 1000,
      _item: "fake item",
      _duration: 6000,
    };

    it("Create auction correctly", async () => {
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

    it("Should not create auction reverted with incorrect starting price", async () => {
      await expect(
        ctx.token.createAuction(
          txBadData._startingPrice,
          txBadData._discountRate,
          txBadData._item,
          txBadData._duration
        )
      ).to.revertedWith("incorrect starting price");
    });

    // it("Get price Auction", async () => {
    //   await ctx.token.createAuction(
    //     txData._startingPrice,
    //     txData._discountRate,
    //     txData._item,
    //     600
    //   );
    //   await delay(2000);
    //   await expect(
    //     ctx.token.connect(ctx.buyer).buy(0, { value: txData._startingPrice })
    //   ).revertedWith("stopped!");
    //   // await ctx.token.connect(ctx.buyer).getPriceFor(0);
    //   // await expect(ctx.token.connect(ctx.buyer).getPriceFor(0)).revertedWith(
    //   //   "stopped!"
    //   // );
    // });
  });

  describe("buy", () => {
    const txData = {
      _startingPrice: ethers.utils.parseEther("0.0003"),
      _discountRate: 3,
      _item: "fake item",
      _duration: 60,
    };
    const txBadDataForBuy = {
      _startingPrice: ethers.utils.parseEther("0.00003"),
      _discountRate: 10,
      _item: "fake item",
      _duration: 6000,
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
      console.log(finalPrice);

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

    it("Shoud be reverted with not enough funds", async () => {
      await ctx.token
        .connect(ctx.seller)
        .createAuction(
          txData._startingPrice,
          txData._discountRate,
          txData._item,
          6000
        );
      await delay(2000);
      await expect(
        ctx.token
          .connect(ctx.buyer)
          .buy(0, { value: txBadDataForBuy._startingPrice })
      ).revertedWith("not enough funds!");
    });

    it("Shoud be reverted with ended!", async () => {
      await ctx.token
        .connect(ctx.seller)
        .createAuction(
          txData._startingPrice,
          txData._discountRate,
          txData._item,
          1
        );
      await delay(5000);
      expect(
        ctx.token.connect(ctx.buyer).buy(0, { value: txData._startingPrice })
      ).revertedWith("ended!");
      expect(ctx.token.connect(ctx.buyer).getPriceFor(0)).revertedWith(
        "stopped"
      );
    });

    it("Shoud be refund payment", async () => {
      await ctx.token
        .connect(ctx.seller)
        .createAuction(
          txData._startingPrice,
          txData._discountRate,
          txData._item,
          6000
        );
      delay(2000);
      await ctx.token
        .connect(ctx.buyer)
        .buy(0, { value: ethers.utils.parseEther("0.003") });
    });
  });
});
