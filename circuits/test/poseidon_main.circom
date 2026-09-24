// poseidon_main.circom: a main component for PoseidonKnowni2, so CI can build a
// witness and compare the circuit's digest with the one core computes. Nothing
// in the product instantiates it; it exists to make the agreement checkable.

pragma circom 2.1.6;

include "poseidon_knowni.circom";

component main = PoseidonKnowni2();
