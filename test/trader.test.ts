const { waffle, ethers}  = require("hardhat");
import { Wallet, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
import { commitmentForBlindSignRequest } from '@mattrglobal/node-bbs-signatures/lib/bbsSignature';
import { parse } from "dotenv";
const fs = require("fs");
const path = require("path");
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

const hre = require("hardhat");

const provider = waffle.provider

const pc = require("@ieigen/anonmisc/lib/pedersen");
var H = pc.generateH();

const snarkjs = require("snarkjs");


const MarketplaceABI = [
    "funciton chooseBuckets()"
]

const BucketizationABI = [
    "function submitOrder(address account, uint256 rateCommX, uint256 rateCommY, uint kind) returns(uint)"
]

const MaxBalance = 1000000

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
let buyOrder1Id
let sellOrder1Id
let buyOrder2Id
let sellOrder2Id
let buyer1Bucket
let seller1Bucket
let buyer2Bucket
let seller2Bucket
let pairId
let buyer1Balance = 100
let seller1Balance = 100
let buyer2Balance = 100
let seller2Balance = 100

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

async function generatePedersenProof() {
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

describe.only("zkDEX test", () => {
    before(async () => {
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
        bucketization = await contract.deploy(marketplace.address)
        await bucketization.deployed()
        console.log("bucketization contract address:", bucketization.address)        
    })

    beforeEach(async function () {
    })

    it("deposit test", async function () {
        let r = pc.generateRandom()
        let balanceComm = pc.commitTo(H, r, buyer1Balance)
        let x = BigNumber.from(balanceComm.getX().toString())
        let y = BigNumber.from(balanceComm.getY().toString())
        await (await buyer1.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        let tx = await bucketization.deposit(buyer1.addresss, r, x, y)
        await tx.wait()

        r = pc.generateRandom()
        balanceComm = pc.commitTo(H, r, seller1Balance)
        x = BigNumber.from(balanceComm.getX().toString())
        y = BigNumber.from(balanceComm.getY().toString())
        await (await seller1.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller1.addresss, r, x, y)
        await tx.wait()

        r = pc.generateRandom()
        balanceComm = pc.commitTo(H, r, buyer2Balance)
        x = BigNumber.from(balanceComm.getX().toString())
        y = BigNumber.from(balanceComm.getY().toString())
        await (await buyer2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(buyer2.addresss, r, x, y)
        await tx.wait()

        r = pc.generateRandom()
        balanceComm = pc.commitTo(H, r, seller2Balance)
        x = BigNumber.from(balanceComm.getX().toString())
        y = BigNumber.from(balanceComm.getY().toString())
        await (await seller2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller2.addresss, r, x, y)
        await tx.wait()
    })

    it("submitOrder test", async function () {
        // buyer1 sends order to marketplace
        r11 = pc.generateRandom();
        let rateComm = pc.commitTo(H, r11, buyRate1)
        //console.dir(rateComm)
        let x = BigNumber.from(rateComm.getX().toString())
        let y = BigNumber.from(rateComm.getY().toString())
        // console.log("buy 1 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        // we can do the check in the backend
        // let proof = generateRangeProof(0, buyer1Balance, buyRate1) // generate proof: 0 <= buyerRate1 < buyer1Balance, buyRate1 is private and buyer1Balace is public
        // const {a, b, c} = parseProof(proof)
        buyOrder1Id = await bucketization.callStatic.submitOrder(buyer1.address, x, y, 0)
        await bucketization.submitOrder(buyer1.address, x, y, 0)
        expect(buyOrder1Id).eq(1)

        // seller1 sends order to marketplace
        r12 = pc.generateRandom();
        rateComm = pc.commitTo(H, r12, sellRate1)
        //console.dir(rateComm)
        x = BigNumber.from(rateComm.getX().toString())
        y = BigNumber.from(rateComm.getY().toString())
        // console.log("sell 1 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        sellOrder1Id = await bucketization.callStatic.submitOrder(seller1.address, x, y, 1)
        await bucketization.submitOrder(seller1.address, x, y, 1)
        expect(sellOrder1Id).eq(2)

        // buyer2 sends order to marketplace
        let buyRate2 = 20;
        r21 = pc.generateRandom();
        rateComm = pc.commitTo(H, r21, buyRate2)
        //console.dir(rateComm)
        x = BigNumber.from(rateComm.getX().toString())
        y = BigNumber.from(rateComm.getY().toString())
        // console.log("buy 2 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        buyOrder2Id = await bucketization.callStatic.submitOrder(buyer2.address, x, y, 0)
        await bucketization.submitOrder(buyer2.address, x, y, 0)
        expect(buyOrder2Id).eq(3) 

        // seller2 sends order to marketplace
        let sellRate2 = 18;
        r22 = pc.generateRandom();
        rateComm = pc.commitTo(H, r22, sellRate2)
        //console.dir(rateComm)
        x = BigNumber.from(rateComm.getX().toString())
        y = BigNumber.from(rateComm.getY().toString())
        // console.log("sell 1 rateComm x,y:")
        // console.log(x)
        // console.log(y)
        sellOrder2Id = await bucketization.callStatic.submitOrder(seller2.address, x, y, 1)
        await bucketization.submitOrder(seller2.address, x, y, 1)
        expect(sellOrder2Id).eq(4)
    })

    it("receive buckets from marketplace", async function () {
        // buyer receive buckets from marketplace 
        let buckets = await marketplace.chooseBuckets()
        await marketplace.chooseBuckets()
        //console.log(buckets)
        var keyArr = Object.keys(buckets)
        expect(keyArr.length).eq(11)

        // buyer1 and seller1 choose buckets
        let startValue
        let width
        let buyerBucketFound = false
        let sellerBucketFound = false
        for (var i = 0; i < 11; i++) {
            startValue = buckets[i][0].toNumber()
            width = buckets[i][1].toNumber()
            if (startValue <= buyRate1 && buyRate1 < startValue + width) {
                buyer1Bucket = buckets[i]
                buyerBucketFound = true
            }
            if (startValue <= sellRate1 && sellRate1 < startValue + width) {
                seller1Bucket = buckets[i]
                sellerBucketFound = true
            }
            if (buyerBucketFound && sellerBucketFound) {
                break
            }
        }
        //expect(buyer1Bucket[2]).eq(1)
        expect(seller1Bucket[2]).eq(0)
    })

    it("generate proof and send to marketplace", async function () {
        // buyer1 generate range proof and then send to marketplace
        // let buyer1Input = {
        //     "a": buyer1Bucket[0],
        //     "b": buyer1Bucket[0].add(buyer1Bucket[1]), // we get BigNumber in bucket object, so we can't just use + to add two BigNumbers, or some wired thing happens.
        //     "m": buyRate1
        // }
        // let wasm = path.join(__dirname, "../circuit/range_proof_js", "range_proof.wasm");
        // let zkey = path.join(__dirname, "../circuit/range_proof_js", "circuit_final.zkey");
        // let vkeypath = path.join(__dirname, "../circuit/range_proof_js", "verification_key.json");
        // const wc = require("../circuit/range_proof_js/witness_calculator");
        // const buffer = fs.readFileSync(wasm);
        // const witnessCalculator = await wc(buffer);

        // let witnessBuffer = await witnessCalculator.calculateWTNSBin(
        //     buyer1Input,
        //     0
        // );
        // var {proof, publicSignals} = await snarkjs.groth16.prove(zkey, witnessBuffer);
        // var {a, b, c} = parseProof(proof);

        let proof = generateRangeProof(buyer1Bucket[0], buyer1Bucket[0].add(buyer1Bucket[1]), buyRate1)
        var {a, b, c} = parseProof(proof);
        
        let tx = await bucketization.attachOrderBook(buyOrder1Id, buyer1Bucket, a, b, c);
        await tx.wait()

        // seller1 generate range proof and then send to marketplace
        // let seller1Input = {
        //     "a": seller1Bucket[0],
        //     "b": seller1Bucket[0].add(seller1Bucket[1]),
        //     "m": sellRate1
        // }

        // witnessBuffer = await witnessCalculator.calculateWTNSBin(
        //     seller1Input,
        //     0
        // );
        // var {proof, publicSignals} = await snarkjs.groth16.prove(zkey, witnessBuffer);
        // var {a, b, c} = parseProof(proof);

        proof = generateRangeProof(seller1Bucket[0], seller1Bucket[0].add(seller1Bucket[1]), sellRate1)
        var {a, b, c} = parseProof(proof);

        tx = await bucketization.attachOrderBook(sellOrder1Id, seller1Bucket, a, b, c);
        await tx.wait()
    })

    it("matching test", async function () {
        // simulate marketplace matching 
        let tx = await bucketization.tradeRound()
        await tx.wait()

        // buyer1 receive matching from marketplace
        let res = await bucketization.findMatchedSeller(buyOrder1Id, buyer1.address)
        let matchedSeller = res[0]
        pairId = res[1]
        expect(matchedSeller).eq(seller1.address)

        // seller1 receive matching from marketplace
        res = await bucketization.findMatchedBuyer(sellOrder1Id, seller1.address)
        let matchedBuyer = res[0]
        let pairId1 = res[1]
        expect(matchedBuyer).eq(buyer1.address) 

        expect(pairId).eq(pairId1)
    })

    // Omit the verification process between buyers and sellers

    it("settlement test", async function () {
        // Calculate fees
        let fees = buyRate1 - sellRate1
        //console.log(r11.sub(r12).umod(ec.n).toString()) 
        let feesComm = pc.commitTo(H, r11.sub(r12).umod(ec.n), fees) // notice that umod is a must or sometimes the onchain check won't pass
        let x = BigNumber.from(feesComm.getX().toString())
        let y = BigNumber.from(feesComm.getY().toString())
        let r1 = BigNumber.from(r11.toString())
        let r2 = BigNumber.from(r12.toString())
        let hx = BigNumber.from(H.getX().toString())
        let hy = BigNumber.from(H.getY().toString())

        // send to the marketplace 
        // let buyer1BalanceBefore = await provider.getBalance(buyer1.address)
        // let seller1BalanceBefore = await provider.getBalance(seller1.address)
        
        let tx = await bucketization.confirmRound(r1, r2, fees, x, y, pairId.toNumber(), hx, hy)
        await tx.wait()

        buyer1Balance -= buyRate1
        seller1Balance += sellRate1

        // let buyer1BalanceAfter = await provider.getBalance(buyer1.address)
        // let seller1BalanceAfter = await provider.getBalance(seller1.address)
        // expect(buyer1BalanceAfter.add(buyRate1)).eq(buyer1BalanceBefore)
        // expect(seller1BalanceAfter).eq(seller1BalanceBefore.add(sellRate1))
    })

    it("withdraw test", async function () {

    })
});
