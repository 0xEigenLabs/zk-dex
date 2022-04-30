pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template PedersenCommitmentPlusRangeProof(n) {
    signal input H[2];
    signal input r;
    signal input v;
    signal input comm[2];
    
    signal input a;
    signal input b;
    signal input c;
    signal input balance;


    var G[2] = [
        995203441582195749578291179787384436505546430278305826713579947235728471134,
        5472060717959818805561601436314318772137091100104008585924551046643952123905
    ];
    var i;

    component r2bits = Num2Bits(256);
    component v2bits = Num2Bits(256);
    component escalarMulr = EscalarMulFix(256, G);
    component escalarMulv = EscalarMulAny(256);
    component adder = BabyAdd();

    component lessor = LessThan(n);
    component greater1 = GreaterEqThan(n);
    component greater2 = GreaterEqThan(n);
    component greater3 = GreaterEqThan(n);

    r ==> r2bits.in;
    v ==> v2bits.in;

    for (i=0; i<256; i++) {
        r2bits.out[i] ==> escalarMulr.e[i];
        v2bits.out[i] ==> escalarMulv.e[i];
    }

    H[0] ==> escalarMulv.p[0];
    H[1] ==> escalarMulv.p[1];

    escalarMulr.out[0] ==> adder.x1;
    escalarMulr.out[1] ==> adder.y1;
    escalarMulv.out[0] ==> adder.x2;
    escalarMulv.out[1] ==> adder.y2;

    adder.xout === comm[0];
    adder.yout === comm[1];

    // range proof
    // balance <= c
    greater1.in[0] <== c;
    greater1.in[1] <== balance;
    1 === greater1.out;

    // b <= balance
    greater2.in[0] <== balance;
    greater2.in[1] <== b;
    1 === greater2.out;

    // v <= b
    greater3.in[0] <== b;
    greater3.in[1] <== v;
    1 === greater3.out;

    lessor.in[0] <== a;
    lessor.in[1] <== v;
    lessor.out === 1;
}

component main { public[H, comm, a, b, c] } = PedersenCommitmentPlusRangeProof(252);
