pragma circom 2.0.0;
include "../circomlib/circuits/comparators.circom";

// check if a <= m < b;
template RangeProof (n) {
    signal input a; // [a,
    signal input b; // b)
    signal input m;
    signal output out;

    component lessor = LessThan(n);
    lessor.in[0] <== m;
    lessor.in[1] <== b;

    lessor.out === 1;
    out <-- lessor.out;

    component greater = GreaterEqThan(n);
    greater.in[0] <== m;
    greater.in[1] <== a;

    1 === greater.out;
    out === 1;
}

component main { public[a, b] } = RangeProof(252);
