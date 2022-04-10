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

describe("Double Pedersen test", function() {
    let circuit;
    let zkey
    let contract
    before( async() => {
        let wasm = path.join(__dirname, "../circuit/pedersen_bjj_js", "pedersen_bjj.wasm");
        zkey = path.join(__dirname, "../circuit/pedersen_bjj_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/pedersen_bjj_js", "verification_key.json");
        const wc = require("../circuit/pedersen_bjj_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        circuit = await wc(buffer);

        let factory = await ethers.getContractFactory("PedersenComm");
        contract = await factory.deploy();
        await contract.deployed();
    });

    // refer: https://github.com/iden3/circomlib/blob/master/test/pedersen.js
    it("Should pedersen at zero", async () => {
        const input = {
            "in": ["11111", "01212121212"]
        }
        const witnessBuffer = await circuit.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        console.log(proof)
        const res = await snarkjs.groth16.exportSolidityCallData(proof, "");
        //let result = res.substring(0, res.length - 3);
        //console.log(res)

        const {a, b, c} = parseProof(proof);
        let ok = await contract.verifyPedersenComm(
            a, b, c,
            publicSignals
        )
        console.log(publicSignals)
        expect(ok).to.eq(true)
    });
});
