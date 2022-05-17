import { ethers } from "hardhat";

export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getTimestamp = async (bn: number) => {
  return (await ethers.provider.getBlock(bn)).timestamp;
};
