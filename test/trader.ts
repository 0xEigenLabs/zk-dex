const { waffle, ethers}  = require("hardhat");
import { Wallet, ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
const fs = require("fs");
const path = require("path");

const provider = waffle.provider

const pc = require("@ieigen/pedersencommitment");
const H = pc.generateH();

const snarkjs = require("snarkjs");

const zkrp = require("./zkrp");

let contract
let marketplace
let bucketization
let buyer
let seller

const initOrder = async () => {
    let contract = await ethers.getContractFactory("Bucketization");
    await contract.deployed()
}

describe("zkDEX test", () => {
    before(async () => {
        contract = await ethers.getContractFactory("Marketplace");
        marketplace = await contract.deploy()
        await marketplace.deployed()

        contract = await ethers.getContractFactory("Bucketization");
        bucketization = await contract.deploy()
        await bucketization.deployed()

        buyer = Wallet.createRandom().connect(provider)
        seller = Wallet.createRandom().connect(provider)
    })

    beforeEach(async function () {

    })

    it("trader test", async function () {
        // buyer sends order to marketplace
        let buyRate = 10;
        let r = pc.generateRandom();
        let rateComm = pc.commitTo(H, r, buyRate)
        let buyOrderId = await bucketization.submitOrder(buyer.address, rateComm, 0)
        expect(buyOrderId).to.be.at.least(0)

        // seller sends order to marketplace
        let sellRate = 9;
        let r1 = pc.generateRandom();
        rateComm = pc.commitTo(H, r1, sellRate)
        let sellOrderId = await bucketization.submitOrder(seller.address, rateComm, 1)
        expect(sellOrderId).to.be.at.least(0)

        // buyer receive buckets from marketplace @TODO
        let buckets = await marketplace.chooseBuckets()  

        let buyerBucket = 111;

        // seller receive buckets from marketplace @TODO
        buckets = await marketplace.chooseBuckets()

        let sellerBucket = 222;


        // buyer generate range proof and then send to marketplace
        let buyerInput = {
            "a": 1,
            "b": 20,
            "m": 2
        }
        let wasm = path.join(__dirname, "../circuit/range_proof_js", "range_proof.wasm");
        let zkey = path.join(__dirname, "../circuit/range_proof_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/range_proof_js", "verification_key.json");
        const wc = require("../circuit/range_proof_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        let witnessBuffer = await witnessCalculator.calculateWTNSBin(
            buyerInput,
            0
        );
        const {buyProof, publicSignals} = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = zkrp.parseProof(buyProof);
        
        bucketization.attachOrderBook(buyOrderId, buyerBucket, a, b, c);

        // seller generate range proof and then send to marketplace
        let sellerInput = {
            "a": 1,
            "b": 20,
            "m": 2
        }

        witnessBuffer = await witnessCalculator.calculateWTNSBin(
            sellerInput,
            0
        );
        const {sellProof, _} = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a1, b1, c1} = zkrp.parseProof(sellProof);
        
        bucketization.attachOrderBook(sellOrderId, sellerBucket, a1, b1, c1);
        
        // simulate marketplace matching 
        await bucketization.tradeRound()

        // buyer receive matching from marketplace
        let matchedSeller, pairId = await bucketization.findMatchedSeller(buyOrderId, buyer.address)
        expect(matchedSeller).eq(seller.address)

        // seller receive matching from marketplace
        let matchedBuyer, pairId1 = await bucketization.findMatchedBuyer(sellOrderId, seller.address)
        expect(matchedBuyer).eq(buyer.address)

        expect(pairId).eq(pairId1)

        // Omit the verification process between buyers and sellers

        // Calculate fees
        let fees = buyRate - sellRate
        let feesComm = pc.commitTo(H, r - r1, fees)
        
        // send to the marketplace 
        let buyerBalanceBefore = buyer.address.balance
        let sellerBalanceBefore = seller.address.balance
        await bucketization.confirmRound(fees, feesComm, pairId)

        expect(buyer.address.balance).eq(buyerBalanceBefore - buyRate)
        expect(seller.address.balance).eq(sellerBalanceBefore - sellRate)
    })
});
