const path = require("path");
const { waffle, ethers } = require("hardhat");
const fs = require("fs");
const snarkjs = require("snarkjs");

const Scalar = require("ffjavascript").Scalar;
import {expect} from "chai";

const buildBabyjub = require("circomlibjs").buildBabyjub;

import { ContractFactory, BigNumberish } from "ethers";
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

describe("Pedersen Commitment & Range Proof Test", function() {
    let circuit;
    let zkey
    let contract
    before( async() => {
        let wasm = path.join(__dirname, "../circuit/pedersen_comm_plus_range_proof_js", "pedersen_comm_plus_range_proof.wasm");
        zkey = path.join(__dirname, "../circuit/pedersen_comm_plus_range_proof_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/pedersen_comm_plus_range_proof_js", "verification_key.json");
        const wc = require("../circuit/pedersen_comm_plus_range_proof_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        circuit = await wc(buffer);

        let factory = await ethers.getContractFactory("Verifier");
        contract = await factory.deploy();
        await contract.deployed();
    });

    // refer: https://github.com/iden3/circomlib/blob/master/test/pedersen.js
    it("Should verify pedersen commitment and range proof correctly", async () => {
        const input = {
            "H": [
                "6230554789957970145215337505398881261822212318664924668379426670874097221003",
                "5398230348265168451715249421208726036420771114427148549530635721570527592474"
            ],
            "r": "15234991401612976859424945774878329190532666920322606448273387428648700648199",
            "v": "805",
            "comm": [
            "5434698982234190249305374094631383876778256933564855719986344407296692881880",
            "15114311991195134539210677959285812356643640052349155301332867067573555804389"
            ],
            "a": "0",
            "b": "1000",
            "c": "10000",
            "balance": "2000"
        }
        const witnessBuffer = await circuit.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        console.log("proof:", proof)
        console.log("publicSignals:", publicSignals)

        const {a, b, c} = parseProof(proof);
        let ok = await contract.verifyProof(
            a, b, c,
            publicSignals
        )
        expect(ok).to.eq(true)
    });
});
