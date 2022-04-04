const { waffle, ethers}  = require("hardhat");
import { ContractFactory, BigNumber, BigNumberish } from "ethers";
import { expect } from "chai";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

const cls = require("circomlibjs");

const secp256k1 = require('@noble/secp256k1')
const CURVE = secp256k1.CURVE
const Point = secp256k1.Point
var G = new Point(CURVE.Gx, CURVE.Gy)

const pc = require("@ieigen/anonmisc/lib/pedersen");
var H = pc.generateH();


// var EC = require('elliptic').ec;
// var ec = new EC('secp256k1');
// var G = ec.g;

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

const circom_tester = require('circom_tester');
const wasm_tester = circom_tester.wasm;

const F1Field = require("ffjavascript").F1Field;
const Scalar = require("ffjavascript").Scalar;
exports.p = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const Fr = new F1Field(exports.p);

function bigint_to_array(n: number, k: number, x: bigint) {
    let mod: bigint = 1n;
    for (var idx = 0; idx < n; idx++) {
        mod = mod * 2n;
    }

    let ret: bigint[] = [];
    var x_temp: bigint = x;
    for (var idx = 0; idx < k; idx++) {
        ret.push(x_temp % mod);
        x_temp = x_temp / mod;
    }
    return ret;
}

describe.only("Pedersen Commitment Proof", () => {
    let contract
    before(async() => {
        let F = await ethers.getContractFactory("PedersenComm");
        contract = await F.deploy();
    })

    it.only("Test pedersen commitment proof should equal", async() => {
        let r = pc.generateRandom()
        let v = BigInt(5)
        var r_array: bigint[] = bigint_to_array(64, 4, r)
        var v_array: bigint[] = bigint_to_array(64, 4, v)

        let x = H.x
        let y = H.y
        var hx_array: bigint[] = bigint_to_array(64, 4, x)
        var hy_array: bigint[] = bigint_to_array(64, 4, y)
        var h = [hx_array, hy_array]

        x = G.x
        y = G.y
        var gx_array: bigint[] = bigint_to_array(64, 4, x)
        var gy_array: bigint[] = bigint_to_array(64, 4, y)
        var g = [gx_array, gy_array]
        
        let res = pc.commitTo(H, r, v)
        x = res.x
        y = res.y
        var comm_x_array: bigint[] = bigint_to_array(64, 4, x)
        var comm_y_array: bigint[] = bigint_to_array(64, 4, y)
        var comm = [comm_x_array, comm_y_array]

        let input = {
            "r": r_array,
            "v": v_array,
            "H": h,
            "G": g,
            "comm": comm
        }
        
        let wasm = path.join(__dirname, "../circuit/pedersen_comm_js", "pedersen_comm.wasm");
        let zkey = path.join(__dirname, "../circuit/pedersen_comm_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/pedersen_comm_js", "verification_key.json");
        const wc = require("../circuit/pedersen_comm_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = parseProof(proof);

        expect(await contract.check(
            a, b, c,
            [v_array, h, g, comm]
        )).to.eq(true)
    })

    it("Test pedersen commitment proof should fail", async() => {
        let r = pc.generateRandom()
        let v = BigInt(5)
        let diff_v = BigInt(6)
        var r_array: bigint[] = bigint_to_array(64, 4, r)
        var v_array: bigint[] = bigint_to_array(64, 4, v)
        var diff_v_array: bigint[] = bigint_to_array(64, 4, diff_v)

        let x = H.x
        let y = H.y
        var hx_array: bigint[] = bigint_to_array(64, 4, x)
        var hy_array: bigint[] = bigint_to_array(64, 4, y)
        var h = [hx_array, hy_array]

        x = G.x
        y = G.y
        var gx_array: bigint[] = bigint_to_array(64, 4, x)
        var gy_array: bigint[] = bigint_to_array(64, 4, y)
        var g = [gx_array, gy_array]
        
        let res = pc.commitTo(H, r, v)
        x = res.x
        y = res.y
        var comm_x_array: bigint[] = bigint_to_array(64, 4, x)
        var comm_y_array: bigint[] = bigint_to_array(64, 4, y)
        var comm = [comm_x_array, comm_y_array]

        let input = {
            "r": r_array,
            "v": v_array,
            "H": h,
            "G": g,
            "comm": comm
        }
        
        let wasm = path.join(__dirname, "../circuit/pedersen_comm_js", "pedersen_comm.wasm");
        let zkey = path.join(__dirname, "../circuit/pedersen_comm_js", "circuit_final.zkey");
        let vkeypath = path.join(__dirname, "../circuit/pedersen_comm_js", "verification_key.json");
        const wc = require("../circuit/pedersen_comm_js/witness_calculator");
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = parseProof(proof);

        expect(await contract.check(
            a, b, c,
            [diff_v_array, h, g, comm]
        )).to.eq(false)
    })
})
