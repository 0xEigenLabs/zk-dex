const { waffle, ethers}  = require("hardhat");
import { ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const cls = require("circomlibjs");

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

describe("Range Proof", () => {
    let contract
    before(async() => {
        let F = await ethers.getContractFactory("RangeProofVerifier");
        contract = await F.deploy();
        await contract.deployed();
    })

    it("Test default proof", async () => {
        const proof = require("../circuit/range_proof_js/proof.json");

        const {a, b, c} = parseProof(proof)
        expect(await contract.verifyProof(
            a, b, c,
            [1, 10000]
        )).to.eq(true)
    })

    it("Test dynamic proof should equal", async() => {
        // m is secret, a, b is the range
        let input = {
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

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = parseProof(proof);

        //a, b
        expect(await contract.verifyProof(
            a, b, c,
            [1, 20]
        )).to.eq(true)
    })

    it("Test dynamic proof should fail", async() => {
        // m is secret, a, b is the range
        let input = {
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

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = parseProof(proof);

        //a, b
        expect(await contract.verifyProof(
            a, b, c,
            [1, 41]
        )).to.eq(false)
    })
})
