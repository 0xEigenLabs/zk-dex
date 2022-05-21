import { Wallet, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
import {buildBabyjub} from "circomlibjs";

const { waffle, ethers}  = require("hardhat");
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const pc = require("@ieigen/anonmisc/lib/pedersen_babyJubjub");
const snarkjs = require("snarkjs");
const provider = waffle.provider

let H
let order
let babyjub
let contract
let marketplace
let bucketization
let buyer1
let seller1
let buyer2
let seller2
let marketplaceAccount
let r11
let r12
let r21
let r22
let buyRate1 = ethers.utils.parseEther("10")
let sellRate1 = ethers.utils.parseEther("9")
let buyRate2 = ethers.utils.parseEther("20")
let sellRate2 = ethers.utils.parseEther("18")
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
let buyer1Balance = ethers.utils.parseEther("100")
let seller1Balance = ethers.utils.parseEther("100")
let buyer2Balance = ethers.utils.parseEther("100")
let seller2Balance = ethers.utils.parseEther("100")
let depositBuyer1Random
let depositBuyer1r
let depositSeller1r
let depositBuyer2r
let depositSeller2r
let buyer1InitialBalanceCommX
let buyer1InitialBalanceCommY
let seller1InitialBalanceCommX
let seller1InitialBalanceCommY
let buyer2InitialBalanceCommX
let buyer2InitialBalanceCommY
let seller2InitialBalanceCommX
let seller2InitialBalanceCommY

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
        startValue = buckets[i][0]
        width = buckets[i][1]
        if (startValue.lte(buyRate) && buyRate.lt(startValue.add(width))) {
            buyerBucket = buckets[i]
            buyerBucketFound = true
        }
        if (startValue.lte(sellRate) && sellRate.lt(startValue.add(width))) {
            sellerBucket = buckets[i]
            sellerBucketFound = true
        }
        if (buyerBucketFound && sellerBucketFound) {
            break
        }
    }
    return {b:buyerBucket, s:sellerBucket}
}

async function generatePedersenProof(hx, hy, r, v, commx, commy) {
    let input = {
        "H": [
            hx,
            hy
        ],
        "r": r,
        "v": v,
        "comm": [
            commx,
            commy
        ]
    }

    let wasm = path.join(__dirname, "../circuit/pedersen_comm_babyjubjub_js", "pedersen_comm_babyjubjub.wasm");
    let zkey = path.join(__dirname, "../circuit/pedersen_comm_babyjubjub_js", "circuit_final.zkey");
    const wc = require("../circuit/pedersen_comm_babyjubjub_js/witness_calculator");
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


async function generatePedersenCommitmentPlusRangeproof(hx, hy, r, balance, commx, commy, chosenValue, initialBalance, rate) {
    // 0 < rate <= chosenValue <= balance <= initialBalance
    let input = {
        "H": [
            hx,
            hy
        ],
        "r": r,
        "balance": balance,
        "comm": [
            commx,
            commy
        ],
        "a": "0",
        "b": chosenValue,
        "c": initialBalance,
        "rate": rate
    }

    let wasm = path.join(__dirname, "../circuit/pedersen_comm_plus_range_proof_js", "pedersen_comm_plus_range_proof.wasm");
    let zkey = path.join(__dirname, "../circuit/pedersen_comm_plus_range_proof_js", "circuit_final.zkey");
    const wc = require("../circuit/pedersen_comm_plus_range_proof_js/witness_calculator");
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


describe("zkDEX test", () => {
    before(async () => {
        babyjub = await buildBabyjub();
        order = babyjub.order;
        H = await pc.generateH();
        [buyer1, seller1, buyer2, seller2, marketplaceAccount] = await hre.ethers.getSigners();

        // buyer1 = Wallet.createRandom().connect(provider)
        // seller1 = Wallet.createRandom().connect(provider)
        // buyer2 = Wallet.createRandom().connect(provider)
        // seller2 = Wallet.createRandom().connect(provider)
        // marketplace = Wallet.createRandom().connect(provider)
        console.log("buyer1 address:", buyer1.address)
        console.log("seller1 address:", seller1.address)
        console.log("buyer2 address:", buyer2.address)
        console.log("seller2 address:", seller2.address)
        console.log("marketplace account address:", marketplaceAccount.address)
        let marketplaceAccountBalance = await provider.getBalance(marketplaceAccount.address);
        console.log("marketplaceAccountBalance is:", marketplaceAccountBalance.toString())

        contract = await ethers.getContractFactory("Marketplace");
        marketplace = await contract.deploy()
        await marketplace.deployed()
        console.log("marketplace contract address:", marketplace.address)

        contract = await ethers.getContractFactory("Bucketization");
        bucketization = await contract.deploy(marketplaceAccount.address)
        await bucketization.deployed()
        console.log("bucketization contract address:", bucketization.address)        
    })

    beforeEach(async function () {
    })

    it("deposit test", async function () {
        // buyer1 deposits 100 Ether to contract address
        depositBuyer1r = await pc.generateRandom()
        depositBuyer1Random = BigNumber.from(depositBuyer1r.toString())
        let balanceComm = await pc.commitTo(H, depositBuyer1r, buyer1Balance)
        buyer1InitialBalanceCommX = babyjub.F.toString(balanceComm[0])
        buyer1InitialBalanceCommY = babyjub.F.toString(balanceComm[1])
        // This could expose the buyer1's balance
        await (await buyer1.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        let tx = await bucketization.deposit(buyer1.address, buyer1InitialBalanceCommX, buyer1InitialBalanceCommY)
        await tx.wait()

        // seller1 deposits 100 Ether to contract address
        depositSeller1r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, depositSeller1r, seller1Balance)
        seller1InitialBalanceCommX = babyjub.F.toString(balanceComm[0])
        seller1InitialBalanceCommY = babyjub.F.toString(balanceComm[1])
        await (await seller1.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller1.address, seller1InitialBalanceCommX, seller1InitialBalanceCommY)
        await tx.wait()

        // buyer2 deposits 100 Ether to contract address
        depositBuyer2r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, depositBuyer2r, buyer2Balance)
        buyer2InitialBalanceCommX = babyjub.F.toString(balanceComm[0])
        buyer2InitialBalanceCommY = babyjub.F.toString(balanceComm[1])
        await (await buyer2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(buyer2.address, buyer2InitialBalanceCommX, buyer2InitialBalanceCommY)
        await tx.wait()

        // seller2 deposits 100 Ether to contract address
        depositSeller2r = await pc.generateRandom()
        balanceComm = await pc.commitTo(H, depositSeller2r, seller2Balance)
        seller2InitialBalanceCommX = babyjub.F.toString(balanceComm[0])
        seller2InitialBalanceCommY = babyjub.F.toString(balanceComm[1])
        await (await seller2.sendTransaction({to: bucketization.address, value: ethers.utils.parseEther("100")})).wait()
        tx = await bucketization.deposit(seller2.address, seller2InitialBalanceCommX, seller2InitialBalanceCommY)
        await tx.wait()
    })

    it("submitOrder test", async function () {
        let hx = babyjub.F.toString(H[0])
        let hy = babyjub.F.toString(H[1])

        // buyer1 sends order to marketplace
        r11 = await pc.generateRandom();
        let rateComm = await pc.commitTo(H, r11, buyRate1)
        let x = babyjub.F.toString(rateComm[0])
        let y = babyjub.F.toString(rateComm[1])

        // just choose a value that greater than rate and lesser than current balance
        let chosenValue = ethers.utils.parseEther("15")
        let initialBalance = buyer1Balance
        let rate = buyRate1
        var {proof, publicSignals} = await generatePedersenCommitmentPlusRangeproof(hx, hy, depositBuyer1r.toString(), buyer1Balance.toString(), buyer1InitialBalanceCommX, buyer1InitialBalanceCommY, chosenValue.toString(), initialBalance.toString(), rate.toString());
        var {a, b, c} = parseProof(proof)

        buyOrder1Id = await bucketization.callStatic.submitOrder(buyer1.address, a, b, c, publicSignals, x, y, 0)
        await bucketization.submitOrder(buyer1.address, a, b, c, publicSignals, x, y, 0)
        expect(buyOrder1Id).eq(1)

        // seller1 sends order to marketplace
        r12 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r12, sellRate1)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])

        // just choose a value that greater than rate and lesser than current balance
        chosenValue = ethers.utils.parseEther("15")
        initialBalance = seller1Balance
        rate = sellRate1
        var {proof, publicSignals} = await generatePedersenCommitmentPlusRangeproof(hx, hy, depositSeller1r.toString(), seller1Balance.toString(), seller1InitialBalanceCommX, seller1InitialBalanceCommY, chosenValue.toString(), initialBalance.toString(), rate.toString());
        var {a, b, c} = parseProof(proof)

        sellOrder1Id = await bucketization.callStatic.submitOrder(seller1.address, a, b, c, publicSignals, x, y, 1)
        await bucketization.submitOrder(seller1.address, a, b, c, publicSignals, x, y, 1)
        expect(sellOrder1Id).eq(2)

        // buyer2 sends order to marketplace
        r21 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r21, buyRate2)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])

        // just choose a value that greater than rate and lesser than current balance
        chosenValue = ethers.utils.parseEther("30")
        initialBalance = buyer2Balance
        rate = buyRate2
        var {proof, publicSignals} = await generatePedersenCommitmentPlusRangeproof(hx, hy, depositBuyer2r.toString(), buyer2Balance.toString(), buyer2InitialBalanceCommX, buyer2InitialBalanceCommY, chosenValue.toString(), initialBalance.toString(), rate.toString());
        var {a, b, c} = parseProof(proof)

        buyOrder2Id = await bucketization.callStatic.submitOrder(buyer2.address, a, b, c, publicSignals, x, y, 0)
        await bucketization.submitOrder(buyer2.address, a, b, c, publicSignals, x, y, 0)
        expect(buyOrder2Id).eq(3) 

        // seller2 sends order to marketplace
        r22 = await pc.generateRandom();
        rateComm = await pc.commitTo(H, r22, sellRate2)
        x = babyjub.F.toString(rateComm[0])
        y = babyjub.F.toString(rateComm[1])

        // just choose a value that greater than rate and lesser than current balance
        chosenValue = ethers.utils.parseEther("30")
        initialBalance = seller2Balance
        rate = sellRate2
        var {proof, publicSignals} = await generatePedersenCommitmentPlusRangeproof(hx, hy, depositSeller2r.toString(), seller2Balance.toString(), seller2InitialBalanceCommX, seller2InitialBalanceCommY, chosenValue.toString(), initialBalance.toString(), rate.toString());
        var {a, b, c} = parseProof(proof)

        sellOrder2Id = await bucketization.callStatic.submitOrder(seller2.address, a, b, c, publicSignals, x, y, 1)
        await bucketization.submitOrder(seller2.address, a, b, c, publicSignals, x, y, 1)
        expect(sellOrder2Id).eq(4)
    })

    it("receive buckets from marketplace and send generated proof to marketplace", async function () {
        // buyer receive buckets from marketplace 
        let buckets = await marketplace.chooseBuckets()
        await marketplace.chooseBuckets()
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

    it("matching test", async function () {
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

    it("settlement test", async function () {
        // settle buyer1 and seller1
        // Calculate fees
        let fees = buyRate1.sub(sellRate1)
        //let feesEther = ethers.utils.parseEther(fees.toString())
        let rSub;
        if (r11 > r12) {
            rSub = BigInt(r11 - r12) % order
        } else {
            rSub = BigInt(r11 - r12) + order
        }
        //console.log("rSub:", rSub)
        let feesComm = await pc.commitTo(H, rSub, BigInt(fees)) // notice that umod is a must or sometimes the onchain check won't pass
        let x = babyjub.F.toString(feesComm[0])
        let y = babyjub.F.toString(feesComm[1])
        // console.log("feesCommX:", x)
        // console.log("feesCommY:", y)
        // let r1 = BigNumber.from(r11.toString())
        // let r2 = BigNumber.from(r12.toString())
        let hx = babyjub.F.toString(H[0])
        let hy = babyjub.F.toString(H[1])
        // let subComm = await pc.subCommitment(H, r11, r12, BigInt(buyRate1), BigInt(sellRate1))
        // console.log("subCommX", babyjub.F.toString(subComm[0]))
        // console.log("subCommY", babyjub.F.toString(subComm[1]))

        let marketplaceAccountBefore = await provider.getBalance(marketplaceAccount.address);
        console.log("start:", marketplaceAccountBefore.toString())
        console.log("fees:", fees)
        // send to the marketplace  
        let tx = await bucketization.confirmRound(fees, x, y, pairId1.toNumber(), hx, hy)
        await tx.wait()
        let marketplaceAccountAfter = await provider.getBalance(marketplaceAccount.address); 
        console.log("end:", marketplaceAccountAfter.toString())
        expect(marketplaceAccountAfter).eq(marketplaceAccountBefore.add(fees))
        buyer1Balance = buyer1Balance.sub(buyRate1)
        seller1Balance = seller1Balance.add(sellRate1)
        

        // settle buyer2 and seller2
        // Calculate fees    
        fees = buyRate2.sub(sellRate2)
        //feesEther = ethers.utils.parseEther(fees.toString())
        if (r21 > r22) {
            rSub = BigInt(r21 - r22) % order
        } else {
            rSub = BigInt(r21 - r22) + order
        }
        //console.log("rSub:", rSub)
        feesComm = await pc.commitTo(H, rSub, BigInt(fees)) // notice that umod is a must or sometimes the onchain check won't pass
        x = babyjub.F.toString(feesComm[0])
        y = babyjub.F.toString(feesComm[1])
        // r1 = BigNumber.from(r21.toString())
        // r2 = BigNumber.from(r22.toString())

        marketplaceAccountBefore = await provider.getBalance(marketplaceAccount.address)
        console.log("start:", marketplaceAccountBefore.toString())
        console.log("fees:", fees)
        // send to the marketplace 
        tx = await bucketization.confirmRound(fees, x, y, pairId2.toNumber(), hx, hy)
        await tx.wait()
        marketplaceAccountAfter = await provider.getBalance(marketplaceAccount.address)
        console.log("end:", marketplaceAccountAfter.toString())
        expect(marketplaceAccountAfter).eq(marketplaceAccountBefore.add(fees))
        buyer2Balance = buyer2Balance.sub(buyRate2)
        seller2Balance = seller2Balance.add(sellRate2) 
    })

    it("withdraw test", async function () {
        // buyer1 withdraw
        // let buyer1BalanceBefore = await provider.getBalance(buyer1.address)
        // console.log(buyer1BalanceBefore)
        let withdrawR
        if (depositBuyer1r > r11) {
            withdrawR = BigInt(depositBuyer1r - r11) % order
        } else {
            withdrawR = BigInt(depositBuyer1r - r11) + order
        }

        let withdrawBalanceCommm = await pc.commitTo(H, withdrawR, BigInt(buyer1Balance))
        let x = babyjub.F.toString(withdrawBalanceCommm[0])
        let y = babyjub.F.toString(withdrawBalanceCommm[1])

        let hx = babyjub.F.toString(H[0])
        let hy = babyjub.F.toString(H[1])
        let {proof, publicSignals} = await generatePedersenProof(hx, hy, withdrawR.toString(), buyer1Balance.toString(), x, y);
        var {a, b, c} = parseProof(proof)
        
        let tx = await bucketization.connect(buyer1).withdraw(buyer1.address, a, b, c, publicSignals)
        await tx.wait()

        // let buyer1BalanceAfter = await provider.getBalance(buyer1.address)
        // console.log(buyer1BalanceAfter)
        // expect(buyer1BalanceBefore.add(ethers.utils.parseEther(buyer1Balance.toString()))).eq(buyer1BalanceAfter)
    })

    it("submit order again", async function () {
        let currentR
        if (depositBuyer2r > r21) {
            currentR = BigInt(depositBuyer2r - r21) % order
        } else {
            currentR = BigInt(depositBuyer2r - r21) + order
        }

        let hx = babyjub.F.toString(H[0])
        let hy = babyjub.F.toString(H[1])

        let curBalanceCommm = await pc.commitTo(H, currentR, BigInt(buyer2Balance))
        let commx = babyjub.F.toString(curBalanceCommm[0])
        let commy = babyjub.F.toString(curBalanceCommm[1])

        // just choose a value that greater than rate and lesser than current balance
        let chosenValue = ethers.utils.parseEther("30")
        let initialBalance = ethers.utils.parseEther("100")
        let rate = buyRate2
        let {proof, publicSignals} = await generatePedersenCommitmentPlusRangeproof(hx, hy, currentR.toString(), buyer2Balance.toString(), commx, commy, chosenValue, initialBalance, rate);
        var {a, b, c} = parseProof(proof)

        // buyer1 sends his second order to marketplace
        let rr = await pc.generateRandom();
        let rateComm = await pc.commitTo(H, rr, buyRate2)
        let x = babyjub.F.toString(rateComm[0])
        let y = babyjub.F.toString(rateComm[1])
        let buyer2Order2Id = await bucketization.callStatic.submitOrder(buyer2.address, a, b, c, publicSignals, x, y, 0)
        await bucketization.submitOrder(buyer2.address, a, b, c, publicSignals, x, y, 0)
        expect(buyer2Order2Id).eq(5)
    })
});
