// income_main.circom: a main component for IncomeCommitment, so CI can build a
// witness and compare the circuit's commitment with the one core computes.
// Nothing in the product instantiates it; it exists to make the agreement
// checkable on every run instead of pinned to a number somebody copied once.

pragma circom 2.1.6;

include "../claims.circom";

component main = IncomeCommitment();
