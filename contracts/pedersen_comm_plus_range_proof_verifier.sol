//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Pairing.sol";

contract PedersenCommPlusRangeProofVerifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }
    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.IC = new Pairing.G1Point[](8);
        
        vk.IC[0] = Pairing.G1Point( 
            7579175395391688379398395323013202694007001545339256089305709202612110264132,
            4853790390775997485366782761191461629072985963208610992792344360937830940803
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            7356028417109592083834943120348665153184912086589307173033248340057766662644,
            1463843327491206764686165579398405105429932493979597036838170667033234439778
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            7962043616756285827286012156094987851969337104531458462999065574295751537841,
            388894652237139296829970750852195485380706319383189111752539836224769708507
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            5257151407608963204433564562691211812749838836784825695159546427350036005204,
            14084500685308875521549496929253777290584986872803882325685049357705247969849
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            14205838475647068877585317998488145534681202535894911454760204063681818356305,
            20151042296209216662871016862973824722248864682198340203941959837593056224708
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            15608842859376916008927940377714274747663941149080456256713219368262566606281,
            19955387308582145577831510350863879545334622126178365327583471465022010194286
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            20081120825731540740180638484546493558973475321835102943077315076277197414787,
            10102952758864149637359211273949021187040759495191759708521109255824276740561
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            1713441464804381612299016463949196995479387640697736603497305517059186498022,
            2861253845586673282251315277438512351118265361278891993545709486934819002490
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[7] memory input
        ) public view returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
