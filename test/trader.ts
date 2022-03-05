const { waffle, ethers}  = require("hardhat");
import { ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
const fs = require("fs");
const path = require("path");

const pc = require("@ieigen/pedersencommitment");
const H = pc.generateH();

let contract
let buyer
let seller

const initOrder = async () => {
    let contract = await ethers.getContractFactory("Bucketization");
    await contract.deployed()
}

const trade = async (rate: BigNumber, trader: string, buyOrSell: number) =>{
    let rateComm = pc.commitTo(H, buyRate)
    let tx = await contrract.submitOrder(trader, rateComm, buyOrSell)
    await tx.wait()

    //TODO
}

trade().then(() => {
    console.log("done")
})
