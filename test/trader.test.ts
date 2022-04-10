const { waffle, ethers}  = require("hardhat");
import { Wallet, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
import { commitmentForBlindSignRequest } from '@mattrglobal/node-bbs-signatures/lib/bbsSignature';
import { parse } from "dotenv";
const fs = require("fs");
const path = require("path");
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

import {buildBabyjub} from "circomlibjs";
import { BabyJub } from "../typechain";

const hre = require("hardhat");

const provider = waffle.provider

const pc = require("@ieigen/anonmisc/lib/pedersen");

const snarkjs = require("snarkjs");

const p = BigNumber.from("21888242871839275222246405745257275088548364400416034343698204186575808495617")


const MarketplaceABI = [
    "funciton chooseBuckets()"
]

const BucketizationABI = [
    "function submitOrder(address account, uint256 rateCommX, uint256 rateCommY, uint kind) returns(uint)"
]

const MaxBalance = 1000000

const babyJubOrder = BigInt("21888242871839275222246405745257275088614511777268538073601725287587578984328")

let H
let babyjub
let contract
let marketplace
let bucketization
let buyer1
let seller1
let buyer2
let seller2
let r11
let r12
let r21
let r22
let buyRate1 = 10;
let sellRate1 = 9;
let buyRate2 = 20;
let sellRate2 = 18;
let buyOrder1Id
let sellOrder1Id
let buyOrder2Id
let sellOrder2Id
let buyer1Bucket
let seller1Bucket
let buyer2Bucket
let seller2Bucket
let pairId1
let pairId2
let buyer1Balance = 100
let seller1Balance = 100
let buyer2Balance = 100
let seller2Balance = 100
let depositBuyer1Random
let tmp

interface Proof {
    a: [BigNumberish, BigNumberish];
    b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
    c: [BigNumberish, BigNumberish];
}

function parseProof(proof: any): Proof {
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
    };
}

function buff2hex(buff) {
    function i2hex(i) {
      return ('0' + i.toString(16)).slice(-2);
    }
    return Array.from(buff).map(i2hex).join('');
}

async function generateRangeProof(l, r, m) {
    let input = {
        "a": l,
        "b": r,
        "m": m
    }
    let wasm = path.join(__dirname, "../circuit/range_proof_js", "range_proof.wasm");
    let zkey = path.join(__dirname, "../circuit/range_proof_js", "circuit_final.zkey");
    let vkeypath = path.join(__dirname, "../circuit/range_proof_js", "verification_key.json");
    const wc = require("../circuit/range_proof_js/witness_calculator");
    const buffer = fs.readFileSync(wasm);
    const witnessCalculator = await wc(buffer);

    let witnessBuffer = await witnessCalculator.calculateWTNSBin(
        input,
        0
    );
    var {proof, publicSignals} = await snarkjs.groth16.prove(zkey, witnessBuffer);
    return proof;
}

function choooseBuckets(buckets, buyRate, sellRate) {
    let startValue
    let width
    let buyerBucketFound = false
    let sellerBucketFound = false
    let buyerBucket
    let sellerBucket
    for (var i = 0; i < 11; i++) {
        startValue = buckets[i][0].toNumber()
        width = buckets[i][1].toNumber()
        if (startValue <= buyRate && buyRate < startValue + width) {
            buyerBucket = buckets[i]
            buyerBucketFound = true
        }
        if (startValue <= sellRate && sellRate < startValue + width) {
            sellerBucket = buckets[i]
            sellerBucketFound = true
        }
        if (buyerBucketFound && sellerBucketFound) {
            break
        }
    }
    return {b:buyerBucket, s:sellerBucket}
}

async function generatePedersenProof(r, v) {
    let input = {
        "in": [r, v]
    }

    let wasm = path.join(__dirname, "../circuit/pedersen_bjj_js", "pedersen_bjj.wasm");
    let zkey = path.join(__dirname, "../circuit/pedersen_bjj_js", "circuit_final.zkey");
    let vkeypath = path.join(__dirname, "../circuit/pedersen_bjj_js", "verification_key.json");
    const wc = require("../circuit/pedersen_bjj_js/witness_calculator");
    const buffer = fs.readFileSync(wasm);
    let circuit = await wc(buffer);
    const witnessBuffer = await circuit.calculateWTNSBin(
        input,
        0
    );
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
    console.log("publicSignals:", publicSignals)
    return {proof, publicSignals}
}

describe.only("zkDEX test", () => {
    before(async () => {
        babyjub = await buildBabyjub();
        H = await pc.generateH();
        [buyer1, seller1, buyer2, seller2, marketplace] = await hre.ethers.getSigners();

        // buyer1 = Wallet.createRandom().connect(provider)
        // seller1 = Wallet.createRandom().connect(provider)
        // buyer2 = Wallet.createRandom().connect(provider)
        // seller2 = Wallet.createRandom().connect(provider)
        // marketplace = Wallet.createRandom().connect(provider)
        console.log("buyer1 address:", buyer1.address)
        // let balance = await provider.getBalance(buyer1.address)
        // let etherString = ethers.utils.formatEther(balance)
        // let etherNumber = Number(etherString)
        // console.log(etherNumber)
        // console.log("buyer balance:", etherString)
        console.log("seller1 address:", seller1.address)
        console.log("buyer2 address:", buyer2.address)
        console.log("seller2 address:", seller2.address)
        console.log("marketplace account address:", marketplace.address)

        contract = await ethers.getContractFactory("Marketplace");
        marketplace = await contract.deploy()
        await marketplace.deployed()
        console.log("marketplace contract address:", marketplace.address)

        contract = await ethers.getContractFactory("Bucketization");
        bucketization = await contract.deploy()
        await bucketization.deployed()
        console.log("bucketization contract address:", bucketization.address)        
    })

    beforeEach(async function () {
    })

    it.only("deposit test", async function () {
        // buyer1 deposits 100 Ether to contract address
        tmp = await pc.generateRandom()
        depositBuyer1Random = BigNumber.from(tmp.toString())
        let balanceComm = await pc.commitTo(H, tmp, buyer1Balance)
        let x = babyjub.F.toString(balanceComm[0])
        let y = babyjub.F.toString(balanceComm[1])
        // let x = BigNumber.from(balanceComm[0])
        // let y = BigNumber.from(balanceComm[1])
        // This could expose the buyer1's balance
        let res = await bucketization.transferToMarketplace({ value: ethers.utils.parseEther("100") })
        await res.wait()
        //await (await buyer1.sendTransaction({to: bucketization.getAddress(), value: ethers.utils.parseEther("100")})).wait()
        let tx = await bucketization.deposit(buyer1.address, depositBuyer1Random, x, y)
        await tx.wait()

        // seller1 deposits 100 Ether to contract address
        let r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, r, seller1Balance)
        x = babyjub.F.toString(balanceComm[0])
        y = babyjub.F.toString(balanceComm[1])
        // x = BigNumber.from(balanceComm[0])
        // y = BigNumber.from(balanceComm[1])
        //await (await seller1.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller1.address, r, x, y)
        await tx.wait()

        // buyer2 deposits 100 Ether to contract address
        r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, r, buyer2Balance)
        x = babyjub.F.toString(balanceComm[0])
        y = babyjub.F.toString(balanceComm[1])
        //await (await buyer2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(buyer2.address, r, x, y)
        await tx.wait()

        // seller2 deposits 100 Ether to contract address
        r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, r, seller2Balance)
        x = babyjub.F.toString(balanceComm[0])
        y = babyjub.F.toString(balanceComm[1])
        //await (await seller2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller2.address, r, x, y)
        await tx.wait()
    })

    it.only("submitOrder test", async function () {
        // buyer1 sends order to marketplace
        r11 = await pc.generateRandom();
        let rateComm = await pc.commitTo(H, r11, buyRate1)
        //console.dir(rateComm)
        let x = babyjub.F.toString(rateComm[0])
        let y = babyjub.F.toString(rateComm[1])
        // let x = BigNumber.from(rateComm[0])
        // let y = BigNumber.from(rateComm[1])
        console.log("buy 1 rateComm x,y:")
        console.log(x)
        console.log(y)
        // make sure the trader has enough balance to submit order, we can do the check in the backend
        // let proof = generateRangeProof(0, buyer1Balance, buyRate1) // generate proof: 0 <= buyerRate1 < buyer1Balance, buyRate1 is private and buyer1Balace is public
        // const {a, b, c} = parseProof(proof)
        buyOrder1Id = await bucketization.callStatic.submitOrder(buyer1.address, x, y, 0)
        await bucketization.submitOrder(buyer1.address, x, y, 0)
        expect(buyOrder1Id).eq(1)

        // seller1 sends order to marketplace
        r12 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r12, sellRate1)
        //console.dir(rateComm)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])
        // x = BigNumber.from(rateComm[0])
        // y = BigNumber.from(rateComm[1])
        console.log("sell 1 rateComm x,y:")
        console.log(x)
        console.log(y)
        sellOrder1Id = await bucketization.callStatic.submitOrder(seller1.address, x, y, 1)
        await bucketization.submitOrder(seller1.address, x, y, 1)
        expect(sellOrder1Id).eq(2)

        // buyer2 sends order to marketplace
        r21 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r21, buyRate2)
        //console.dir(rateComm)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])
        // x = BigNumber.from(rateComm[0])
        // y = BigNumber.from(rateComm[1])
        // console.log("buy 2 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        buyOrder2Id = await bucketization.callStatic.submitOrder(buyer2.address, x, y, 0)
        await bucketization.submitOrder(buyer2.address, x, y, 0)
        expect(buyOrder2Id).eq(3) 

        // seller2 sends order to marketplace
        r22 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r22, sellRate2)
        //console.dir(rateComm)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])
        // x = BigNumber.from(rateComm[0])
        // y = BigNumber.from(rateComm[1])
        // console.log("sell 1 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        sellOrder2Id = await bucketization.callStatic.submitOrder(seller2.address, x, y, 1)
        await bucketization.submitOrder(seller2.address, x, y, 1)
        expect(sellOrder2Id).eq(4)
    })

    it.only("receive buckets from marketplace and send generated proof to marketplace", async function () {
        // buyer receive buckets from marketplace 
        let buckets = await marketplace.chooseBuckets()
        await marketplace.chooseBuckets()
        //console.log(buckets)
        var keyArr = Object.keys(buckets)
        expect(keyArr.length).eq(11)

        // buyer1 and seller1 choose buckets
        const {b:buyer1Bucket, s:seller1Bucket} = choooseBuckets(buckets, buyRate1, sellRate1)
        expect(buyer1Bucket[2]).eq(1)
        expect(seller1Bucket[2]).eq(0)

        // buyer2 and seller2 choose buckets
        const {b:buyer2Bucket, s:seller2Bucket} = choooseBuckets(buckets, buyRate2, sellRate2)
        expect(buyer2Bucket[2]).eq(2)
        expect(seller2Bucket[2]).eq(1)

        // buyer1 generates range proof and then send to marketplace
        // console.log(buyer1Bucket)
        // let tmp = buyer1Bucket[0]
        // console.log(tmp)
        let proof = await generateRangeProof(buyer1Bucket[0], buyer1Bucket[0].add(buyer1Bucket[1]), buyRate1)
        var {a, b, c} = parseProof(proof);
        let tx = await bucketization.attachOrderBook(buyOrder1Id, buyer1Bucket, a, b, c);
        await tx.wait()

        // seller1 generates range proof and then send to marketplace
        proof = await generateRangeProof(seller1Bucket[0], seller1Bucket[0].add(seller1Bucket[1]), sellRate1)
        var {a, b, c} = parseProof(proof);
        tx = await bucketization.attachOrderBook(sellOrder1Id, seller1Bucket, a, b, c);
        await tx.wait()

        // buyer2 generates range proof and then send to marketplace
        proof = await generateRangeProof(buyer2Bucket[0], buyer2Bucket[0].add(buyer2Bucket[1]), buyRate2)
        var {a, b, c} = parseProof(proof);
        tx = await bucketization.attachOrderBook(buyOrder2Id, buyer2Bucket, a, b, c);
        await tx.wait()

        // seller2 generates range proof and then send to marketplace
        proof = await generateRangeProof(seller2Bucket[0], seller2Bucket[0].add(seller2Bucket[1]), sellRate2)
        var {a, b, c} = parseProof(proof);
        tx = await bucketization.attachOrderBook(sellOrder2Id, seller2Bucket, a, b, c);
        await tx.wait()
    })

    it.only("matching test", async function () {
        // simulate marketplace matching 
        let tx = await bucketization.tradeRound()
        await tx.wait()

        // buyer1 and seller1 receive matching from marketplace
        let res = await bucketization.findMatchedSeller(buyOrder1Id, buyer1.address)
        let matchedSeller = res[0]
        pairId1 = res[1]
        expect(matchedSeller).eq(seller1.address)

        res = await bucketization.findMatchedBuyer(sellOrder1Id, seller1.address)
        let matchedBuyer = res[0]
        let samePairId1 = res[1]
        expect(matchedBuyer).eq(buyer1.address) 

        expect(pairId1).eq(samePairId1)

        // buyer2 and seller2 receive matching from marketplace
        res = await bucketization.findMatchedSeller(buyOrder2Id, buyer2.address)
        matchedSeller = res[0]
        pairId2 = res[1]
        expect(matchedSeller).eq(seller2.address)

        res = await bucketization.findMatchedBuyer(sellOrder2Id, seller2.address)
        matchedBuyer = res[0]
        let samePairId2 = res[1]
        expect(matchedBuyer).eq(buyer2.address) 

        expect(pairId2).eq(samePairId2)
    })

    // Omit the verification process between buyers and sellers

    it.only("settlement test", async function () {
        // settle buyer1 and seller1
        // Calculate fees
        let fees = buyRate1 - sellRate1
        //console.log(r11.sub(r12).umod(ec.n).toString()) 
        let rSub;
        if (r11 > r12) {
            rSub = BigInt(r11 - r12) % babyJubOrder
        } else {
            rSub = BigInt(r11 - r12) + babyJubOrder
        }
        console.log("rSub:", rSub)
        let feesComm = await pc.commitTo(H, rSub, fees) // notice that umod is a must or sometimes the onchain check won't pass
        let x = babyjub.F.toString(feesComm[0])
        let y = babyjub.F.toString(feesComm[1])
        // let x = BigNumber.from(feesComm[0])
        // let y = BigNumber.from(feesComm[1])
        console.log("feesCommX:", x)
        console.log("feesCommY:", y)
        let r1 = BigNumber.from(r11.toString())
        let r2 = BigNumber.from(r12.toString())
        let hx = babyjub.F.toString(H[0])
        let hy = babyjub.F.toString(H[1])
        // let hx = BigNumber.from(H[0])
        // let hy = BigNumber.from(H[1])
        let subComm = await pc.subCommitment(H, r11, r12, BigInt(buyRate1), BigInt(sellRate1))
        console.log("subCommX", babyjub.F.toString(subComm[0]))
        console.log("subCommY", babyjub.F.toString(subComm[1]))
        // let x = BigNumber.from(subComm[0])
        // let y = BigNumber.from(subComm[1])

        // send to the marketplace 
        let tx = await bucketization.confirmRound(r1, r2, fees, x, y, pairId1.toNumber(), hx, hy)
        await tx.wait()
        buyer1Balance -= buyRate1
        seller1Balance += sellRate1


        // settle buyer2 and seller2
        // Calculate fees    
        fees = buyRate2 - sellRate2
        //console.log(r11.sub(r12).umod(ec.n).toString()) 
        if (r21 > r22) {
            rSub = BigInt(r21 - r22) % babyJubOrder
        } else {
            rSub = BigInt(r21 - r22) + babyJubOrder
        }
        console.log("rSub:", rSub)
        feesComm = await pc.commitTo(H, rSub, fees) // notice that umod is a must or sometimes the onchain check won't pass
        x = babyjub.F.toString(feesComm[0])
        y = babyjub.F.toString(feesComm[1])
        r1 = BigNumber.from(r21.toString())
        r2 = BigNumber.from(r22.toString())

        // send to the marketplace 
        tx = await bucketization.confirmRound(r1, r2, fees, x, y, pairId2.toNumber(), hx, hy)
        await tx.wait()
        buyer2Balance -= buyRate2
        seller2Balance += sellRate2
    })

    it.only("withdraw test", async function () {
        // buyer1 withdraw
        // let buyer1BalanceBefore = await provider.getBalance(buyer1.address)
        // console.log(buyer1BalanceBefore)
        // console.log(ethers.utils.parseEther(buyer1BalanceBefore.toString()))
        let withdrawR
        if (tmp > r11) {
            withdrawR = BigInt(tmp - r11) % babyJubOrder
        } else {
            withdrawR = BigInt(tmp - r11) + babyJubOrder
        }
        //let withdrawR = tmp - r11//depositBuyer1Random.sub(r11).umod(ec.n)
        
        let {proof, publicSignals} = await generatePedersenProof(withdrawR, buyer1Balance);
        var {a, b, c} = parseProof(proof)
        let tx = await bucketization.withdraw(buyer1.address, a, b, c, publicSignals, buyer1Balance)
        //let tx = await bucketization.withdraw(buyer1.address, a, b, c, withdrawR, buyer1Balance)
        await tx.wait()

        // let buyer1BalanceAfter = await provider.getBalance(buyer1.address)
        // console.log(buyer1BalanceAfter)
        // console.log(ethers.utils.parseEther(buyer1BalanceAfter.toString()))
        // expect(buyer1BalanceBefore.add(ethers.utils.parseEther(buyer1Balance.toString()))).eq(buyer1BalanceAfter)
    })
});
