pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";

template PedersenCommitment() {
    signal input H[2];
    signal input r;
    signal input v;
    signal input comm[2];

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
}

component main { public[H, v, comm] } = PedersenCommitment();
